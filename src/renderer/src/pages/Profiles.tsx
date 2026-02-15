/**
 * VOIDRA — Profiller Sayfası
 * Gerçek profil CRUD + tarayıcı başlatma/kapatma
 * VFS Global ülke seçimi ile otomatik login URL oluşturma
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Shield,
    Plus,
    Globe,
    Fingerprint,
    Play,
    Square,
    Trash2,
    X,
    Loader2,
    AlertTriangle,
    Clock,
    Hash,
    Search,
    MapPin,
    Link2,
    CheckCircle2,
    LogIn,
    Zap,
    RefreshCw,
    Terminal,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

// VFS ülke tanımı (Constants'tan birebir)
interface VFSCountryItem {
    code: string;
    name: string;
    nameEn: string;
    flag: string;
}

// Ülke listesi (renderer'da kullanmak için)
const VFS_COUNTRIES: VFSCountryItem[] = [
    { code: 'nld', name: 'Hollanda', nameEn: 'Netherlands', flag: '🇳🇱' },
    { code: 'deu', name: 'Almanya', nameEn: 'Germany', flag: '🇩🇪' },
    { code: 'fra', name: 'Fransa', nameEn: 'France', flag: '🇫🇷' },
    { code: 'ita', name: 'İtalya', nameEn: 'Italy', flag: '🇮🇹' },
    { code: 'esp', name: 'İspanya', nameEn: 'Spain', flag: '🇪🇸' },
    { code: 'gbr', name: 'İngiltere', nameEn: 'United Kingdom', flag: '🇬🇧' },
    { code: 'aut', name: 'Avusturya', nameEn: 'Austria', flag: '🇦🇹' },
    { code: 'bel', name: 'Belçika', nameEn: 'Belgium', flag: '🇧🇪' },
    { code: 'che', name: 'İsviçre', nameEn: 'Switzerland', flag: '🇨🇭' },
    { code: 'cze', name: 'Çekya', nameEn: 'Czech Republic', flag: '🇨🇿' },
    { code: 'dnk', name: 'Danimarka', nameEn: 'Denmark', flag: '🇩🇰' },
    { code: 'fin', name: 'Finlandiya', nameEn: 'Finland', flag: '🇫🇮' },
    { code: 'grc', name: 'Yunanistan', nameEn: 'Greece', flag: '🇬🇷' },
    { code: 'hrv', name: 'Hırvatistan', nameEn: 'Croatia', flag: '🇭🇷' },
    { code: 'hun', name: 'Macaristan', nameEn: 'Hungary', flag: '🇭🇺' },
    { code: 'irl', name: 'İrlanda', nameEn: 'Ireland', flag: '🇮🇪' },
    { code: 'ltu', name: 'Litvanya', nameEn: 'Lithuania', flag: '🇱🇹' },
    { code: 'lux', name: 'Lüksemburg', nameEn: 'Luxembourg', flag: '🇱🇺' },
    { code: 'nor', name: 'Norveç', nameEn: 'Norway', flag: '🇳🇴' },
    { code: 'pol', name: 'Polonya', nameEn: 'Poland', flag: '🇵🇱' },
    { code: 'prt', name: 'Portekiz', nameEn: 'Portugal', flag: '🇵🇹' },
    { code: 'rou', name: 'Romanya', nameEn: 'Romania', flag: '🇷🇴' },
    { code: 'svk', name: 'Slovakya', nameEn: 'Slovakia', flag: '🇸🇰' },
    { code: 'svn', name: 'Slovenya', nameEn: 'Slovenia', flag: '🇸🇮' },
    { code: 'swe', name: 'İsveç', nameEn: 'Sweden', flag: '🇸🇪' },
    { code: 'usa', name: 'ABD', nameEn: 'United States', flag: '🇺🇸' },
    { code: 'can', name: 'Kanada', nameEn: 'Canada', flag: '🇨🇦' },
    { code: 'aus', name: 'Avustralya', nameEn: 'Australia', flag: '🇦🇺' },
    { code: 'zaf', name: 'Güney Afrika', nameEn: 'South Africa', flag: '🇿🇦' },
    { code: 'tha', name: 'Tayland', nameEn: 'Thailand', flag: '🇹🇭' },
    { code: 'est', name: 'Estonya', nameEn: 'Estonia', flag: '🇪🇪' },
    { code: 'lva', name: 'Letonya', nameEn: 'Latvia', flag: '🇱🇻' },
    { code: 'mlt', name: 'Malta', nameEn: 'Malta', flag: '🇲🇹' },
    { code: 'bgr', name: 'Bulgaristan', nameEn: 'Bulgaria', flag: '🇧🇬' },
];

// Ülke kodundan bilgi al
function getCountryInfo(code: string): VFSCountryItem | undefined {
    return VFS_COUNTRIES.find(c => c.code === code);
}

// ProfileSummary tipi (main process'ten gelen veri)
interface ProfileSummary {
    id: string;
    name: string;
    color: string;
    status: 'idle' | 'launching' | 'active' | 'closing' | 'error';
    browserChannel: 'firefox' | 'msedge' | 'chrome';
    lastUsedAt: string | null;
    totalSessions: number;
    tags: string[];
    hasProxy: boolean;
    vfsCountry: string;
}

// Profil renk paleti
const PROFILE_COLORS = [
    '#6C5CE7', '#00B894', '#E17055', '#0984E3',
    '#FDCB6E', '#E84393', '#00CEC9', '#D63031',
    '#A29BFE', '#55EFC4'
];

// Log girişi tipi
interface LogEntry {
    timestamp: string;
    level: string;
    source: string;
    message: string;
}

function Profiles() {
    const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    // ★ Oturum fazları (waiting_login, active, vb.)
    const [sessionPhases, setSessionPhases] = useState<Record<string, string>>({});
    // ★ Hata mesajları — profil bazında
    const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({});
    // ★ Canlı log akışı
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showLogs, setShowLogs] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Profilleri yükle
    const loadProfiles = useCallback(async () => {
        try {
            const result = await window.voidra?.profile.list();
            if (result?.success) {
                setProfiles(result.data as ProfileSummary[]);
            }
        } catch (err) {
            console.error('Profil yükleme hatası:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // İlk yükleme
    useEffect(() => {
        loadProfiles();

        // Event bridge — profil/oturum güncelleme olaylarını dinle
        const cleanup = window.voidra?.onEvent((payload) => {
            const profileEvents = [
                'profile:created', 'profile:updated', 'profile:deleted',
                'session:started', 'session:ended', 'session:error',
                'session:phase:changed'
            ];
            if (profileEvents.includes(payload.event)) {
                loadProfiles();
            }

            // ★ Oturum faz bilgisini güncelle
            if (payload.event === 'session:started' && payload.data?.status) {
                setSessionPhases(prev => ({
                    ...prev,
                    [payload.data.profileId]: payload.data.status,
                }));
                // Hata durumunu temizle
                if (payload.data.status === 'active') {
                    setSessionErrors(prev => {
                        const next = { ...prev };
                        delete next[payload.data.profileId];
                        return next;
                    });
                }
            }
            if (payload.event === 'session:ended' && payload.data?.profileId) {
                setSessionPhases(prev => {
                    const next = { ...prev };
                    delete next[payload.data.profileId];
                    return next;
                });
            }

            // ★ Oturum hatalarını yakala ve göster
            if (payload.event === 'session:error' && payload.data?.profileId) {
                setSessionErrors(prev => ({
                    ...prev,
                    [payload.data.profileId]: payload.data.error || 'Bilinmeyen hata',
                }));
                setSessionPhases(prev => {
                    const next = { ...prev };
                    delete next[payload.data.profileId];
                    return next;
                });
            }

            // ★ Canlı log akışı
            if (payload.event === 'LOG' && payload.data) {
                setLogs(prev => {
                    const newLogs = [...prev, payload.data as LogEntry];
                    // Son 500 log tut
                    return newLogs.length > 500 ? newLogs.slice(-500) : newLogs;
                });
            }
        });

        return () => cleanup?.();
    }, [loadProfiles]);

    // Log scroll — yeni log geldiğinde en alta kaydır
    useEffect(() => {
        if (logContainerRef.current && showLogs) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, showLogs]);

    // Profil oluştur
    const handleCreate = async (name: string, browserChannel: 'firefox' | 'msedge' | 'chrome', vfsCountry: string) => {
        try {
            const result = await window.voidra?.profile.create({ name, browserChannel, vfsCountry });
            if (result?.success) {
                setShowCreateModal(false);
                await loadProfiles();
            }
        } catch (err) {
            console.error('Profil oluşturma hatası:', err);
        }
    };

    // Tarayıcı aç (Aşama 1 — saf tarayıcı)
    const handleOpen = async (id: string) => {
        setActionLoading(id);
        try {
            await window.voidra?.profile.open(id);
            // Firefox stealth modda doğrudan active — CDP bağlantısı gerekmez
            const profile = profiles.find(p => p.id === id);
            const isFirefox = profile?.browserChannel === 'firefox';
            setSessionPhases(prev => ({ ...prev, [id]: isFirefox ? 'active' : 'waiting_login' }));
            await loadProfiles();
        } catch (err) {
            console.error('Oturum açma hatası:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // ★ Login tamamlandı — CDP bağlantısı kur (Aşama 2)
    const handleConnect = async (id: string) => {
        setActionLoading(id);
        setSessionPhases(prev => ({ ...prev, [id]: 'connecting' }));
        try {
            const result = await window.voidra?.profile.connect(id);
            if (result?.success) {
                setSessionPhases(prev => ({ ...prev, [id]: 'active' }));
            } else {
                console.error('CDP bağlantı hatası:', result?.error);
                setSessionPhases(prev => ({ ...prev, [id]: 'waiting_login' }));
            }
            await loadProfiles();
        } catch (err) {
            console.error('CDP bağlantı hatası:', err);
            setSessionPhases(prev => ({ ...prev, [id]: 'waiting_login' }));
        } finally {
            setActionLoading(null);
        }
    };

    // Tarayıcı kapat
    const handleClose = async (id: string) => {
        setActionLoading(id);
        try {
            await window.voidra?.profile.close(id);
            setSessionPhases(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            await loadProfiles();
        } catch (err) {
            console.error('Oturum kapatma hatası:', err);
        } finally {
            setActionLoading(null);
        }
    };

    // Profil sil
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`"${name}" profilini silmek istediğinize emin misiniz?`)) return;
        try {
            await window.voidra?.profile.delete(id);
            await loadProfiles();
        } catch (err) {
            console.error('Profil silme hatası:', err);
        }
    };

    // ★ Temiz Oturum: Reset + Cookie temizle + DNS flush + Taş browser aç
    const handleLaunchClean = async (id: string) => {
        setActionLoading(id);
        setSessionPhases(prev => ({ ...prev, [id]: 'resetting' }));
        try {
            const result = await window.voidra?.profile.launchClean(id);
            if (result?.success) {
                // Firefox stealth modda doğrudan active
                const profile = profiles.find(p => p.id === id);
                const isFirefox = profile?.browserChannel === 'firefox';
                setSessionPhases(prev => ({ ...prev, [id]: isFirefox ? 'active' : 'waiting_login' }));
                console.log('Temiz oturum başlatıldı:', result.data);
            } else {
                console.error('Temiz oturum hatası:', result?.error);
                setSessionPhases(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            }
            await loadProfiles();
        } catch (err) {
            console.error('Temiz oturum hatası:', err);
            setSessionPhases(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Durum badge renkleri — 3 Aşamalı Hibrit faz desteği
    const getStatusBadge = (status: ProfileSummary['status'], profileId: string) => {
        const phase = sessionPhases[profileId];

        // ★ Hibrit fazları kontrol et
        if (phase === 'resetting') {
            return { className: 'badge badge--warning', label: '🔄 Reset Yapılıyor...', icon: <Loader2 size={10} className="spin" /> };
        }
        if (phase === 'waiting_login') {
            return { className: 'badge badge--warning', label: '⏳ Login Bekleniyor', icon: <LogIn size={10} /> };
        }
        if (phase === 'transitioning') {
            return { className: 'badge badge--active', label: '🔄 Oturum Aktarılıyor...', icon: <Loader2 size={10} className="spin" /> };
        }
        if (phase === 'connecting') {
            return { className: 'badge badge--active', label: 'CDP Bağlanıyor...', icon: <Loader2 size={10} className="spin" /> };
        }

        switch (status) {
            case 'active':
                if (phase === 'active') {
                    return { className: 'badge badge--active', label: '⚡ Otomasyon Aktif', icon: <Zap size={10} /> };
                }
                return { className: 'badge badge--active', label: '● Aktif', icon: null };
            case 'launching':
                return { className: 'badge badge--active', label: 'Başlatılıyor...', icon: <Loader2 size={10} className="spin" /> };
            case 'closing':
                return { className: 'badge badge--inactive', label: 'Kapanıyor...', icon: <Loader2 size={10} className="spin" /> };
            case 'error':
                return { className: 'badge badge--error', label: 'Hata', icon: <AlertTriangle size={10} /> };
            default:
                return { className: 'badge badge--inactive', label: 'Pasif', icon: null };
        }
    };

    // Zaman formatla
    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return 'Hiç kullanılmadı';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Az önce';
        if (diffMins < 60) return `${diffMins} dk önce`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} saat önce`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} gün önce`;
    };

    if (loading) {
        return (
            <div className="empty-state">
                <Loader2 size={32} className="spin" style={{ color: 'var(--color-accent-secondary)' }} />
                <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>Profiller yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Sayfa Başlığı */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-header__title">Profiller</h1>
                    <p className="page-header__subtitle">
                        İzole tarayıcı profilleri — her biri farklı dijital kimlik taşır
                    </p>
                </div>
                <button
                    className="btn btn--primary btn--lg"
                    id="btn-create-profile"
                    onClick={() => setShowCreateModal(true)}
                >
                    <Plus size={18} />
                    Yeni Profil
                </button>
            </div>

            {/* Profil Kartları */}
            {profiles.length > 0 ? (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 'var(--spacing-md)'
                }} className="animate-stagger">
                    {profiles.map((profile) => {
                        const statusBadge = getStatusBadge(profile.status, profile.id);
                        const isLoading = actionLoading === profile.id;
                        const isActive = profile.status === 'active';
                        const phase = sessionPhases[profile.id];
                        const isWaitingLogin = phase === 'waiting_login';
                        const isConnecting = phase === 'connecting' || phase === 'transitioning';
                        const isAutomationActive = phase === 'active';
                        const isTransitioning = profile.status === 'launching' || profile.status === 'closing';
                        const country = getCountryInfo(profile.vfsCountry);

                        return (
                            <div key={profile.id} className="glass-card animate-fadeIn" style={{ padding: 'var(--spacing-lg)' }}>
                                {/* Üst kısım — isim ve durum */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 'var(--radius-md)',
                                            background: `${profile.color}18`,
                                            border: `1px solid ${profile.color}35`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all var(--transition-base)'
                                        }}>
                                            <Shield size={20} style={{ color: profile.color }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', lineHeight: 1.2 }}>
                                                {profile.name}
                                            </div>
                                            <span className={statusBadge.className} style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                {statusBadge.icon}
                                                {statusBadge.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detaylar */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                                    {/* VFS Ülke bilgisi */}
                                    {country && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                                            <MapPin size={12} style={{ flexShrink: 0, color: 'var(--color-accent-secondary)' }} />
                                            <span style={{ fontSize: '14px' }}>{country.flag}</span>
                                            <span style={{ fontWeight: 500 }}>{country.name}</span>
                                            <span style={{
                                                marginLeft: 'auto',
                                                fontSize: '9px',
                                                fontFamily: 'monospace',
                                                padding: '1px 6px',
                                                background: 'rgba(108, 92, 231, 0.12)',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--color-accent-secondary)',
                                                letterSpacing: '0.5px'
                                            }}>
                                                VFS
                                            </span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                        <Globe size={12} style={{ flexShrink: 0 }} />
                                        <span>{profile.browserChannel === 'firefox' ? '🦊 Firefox' : profile.browserChannel === 'msedge' ? 'Microsoft Edge' : 'Google Chrome'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                        <Fingerprint size={12} style={{ flexShrink: 0 }} />
                                        <span>Parmak izi atandı</span>
                                        {profile.hasProxy && (
                                            <span className="badge badge--active" style={{ marginLeft: 'auto', fontSize: '9px', padding: '1px 5px' }}>PROXY</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                                        <Clock size={12} style={{ flexShrink: 0 }} />
                                        <span>{formatTime(profile.lastUsedAt)}</span>
                                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Hash size={10} /> {profile.totalSessions} oturum
                                        </span>
                                    </div>
                                </div>
                                {/* ★ Hata mesajı banner'ı */}
                                {sessionErrors[profile.id] && (
                                    <div
                                        style={{
                                            padding: 'var(--spacing-sm)',
                                            marginBottom: 'var(--spacing-sm)',
                                            background: 'rgba(255, 59, 48, 0.1)',
                                            border: '1px solid rgba(255, 59, 48, 0.3)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-xs)',
                                            color: '#ff6b6b',
                                            lineHeight: 1.5,
                                            cursor: 'pointer',
                                        }}
                                        title="Tıklayarak kapatın"
                                        onClick={() => setSessionErrors(prev => {
                                            const next = { ...prev };
                                            delete next[profile.id];
                                            return next;
                                        })}
                                    >
                                        <strong style={{ color: '#ff4d4f' }}>❌ Hata</strong><br />
                                        {sessionErrors[profile.id]}
                                        <br />
                                        <span style={{ fontSize: '10px', opacity: 0.7 }}>Tıklayarak kapatın</span>
                                    </div>
                                )}

                                {/* ★ Akış Aksiyonları */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {/* Login bekleme durumunda — SADECE Edge/Chrome (CDP akışı) */}
                                    {isWaitingLogin && profile.browserChannel !== 'firefox' && (
                                        <div style={{
                                            padding: 'var(--spacing-sm)',
                                            background: 'rgba(255, 149, 0, 0.08)',
                                            border: '1px solid rgba(255, 149, 0, 0.2)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-secondary)',
                                            lineHeight: 1.5,
                                        }}>
                                            <strong style={{ color: '#FF9500' }}>⏳ Login Bekleniyor</strong><br />
                                            Tarayıcıda VFS sitesine login olun, sonra aşağıdaki butona tıklayın.
                                        </div>
                                    )}

                                    {/* Firefox aktif durumda bilgi kutusu */}
                                    {isAutomationActive && profile.browserChannel === 'firefox' && (
                                        <div style={{
                                            padding: 'var(--spacing-sm)',
                                            background: 'rgba(46, 213, 115, 0.08)',
                                            border: '1px solid rgba(46, 213, 115, 0.2)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-secondary)',
                                            lineHeight: 1.5,
                                        }}>
                                            <strong style={{ color: '#2ed573' }}>🦊 Stealth Firefox Aktif</strong><br />
                                            Violentmonkey + VFS Bot Pro çalışıyor.
                                            <span style={{ fontSize: '10px', opacity: 0.7 }}> Debug port yok — Cloudflare tespit edemez.</span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        {/* Faza göre ana buton */}
                                        {isWaitingLogin && profile.browserChannel !== 'firefox' ? (
                                            <button
                                                className="btn btn--success"
                                                style={{ flex: 1 }}
                                                onClick={() => handleConnect(profile.id)}
                                                disabled={isLoading || isConnecting}
                                                id={`btn-connect-${profile.id}`}
                                            >
                                                {isConnecting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                                                {isConnecting ? 'CDP Bağlanıyor...' : '✅ Login Tamamlandı'}
                                            </button>
                                        ) : isActive || isAutomationActive ? (
                                            <button
                                                className="btn btn--ghost"
                                                style={{ flex: 1 }}
                                                onClick={() => handleClose(profile.id)}
                                                disabled={isLoading || isTransitioning}
                                            >
                                                {isLoading ? <Loader2 size={14} className="spin" /> : <Square size={14} />}
                                                Kapat
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn btn--primary"
                                                    style={{ flex: 1 }}
                                                    onClick={() => handleOpen(profile.id)}
                                                    disabled={isLoading || isTransitioning}
                                                    title="Normal oturum aç (hızlı)"
                                                >
                                                    {isLoading || isTransitioning ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                                                    {isTransitioning ? 'Başlatılıyor...' : 'Aç'}
                                                </button>
                                                <button
                                                    className="btn btn--warning"
                                                    style={{ flex: 1.5 }}
                                                    onClick={() => handleLaunchClean(profile.id)}
                                                    disabled={isLoading || isTransitioning}
                                                    title="Modem restart + Cookie temizle + DNS flush + Temiz tarayıcı aç"
                                                    id={`btn-clean-${profile.id}`}
                                                >
                                                    {isLoading || isTransitioning ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                                    🚀 Temiz Oturum
                                                </button>
                                            </>
                                        )}
                                        <button
                                            className="btn btn--danger btn--sm"
                                            onClick={() => handleDelete(profile.id, profile.name)}
                                            disabled={isActive || isTransitioning || isWaitingLogin}
                                            title="Profili sil"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Boş durum */
                <div className="empty-state">
                    <Shield className="empty-state__icon" />
                    <h3 className="empty-state__title">Henüz profil yok</h3>
                    <p className="empty-state__description">
                        İlk profilinizi oluşturarak başlayın. Her profil benzersiz bir dijital
                        kimlik taşır — kendi çerezleri, parmak izi ve proxy ayarlarıyla.
                    </p>
                    <button
                        className="btn btn--primary btn--lg"
                        id="btn-create-profile-empty"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus size={18} />
                        İlk Profili Oluştur
                    </button>
                </div>
            )}

            {/* ★ Canlı Log Paneli — Kapsamlı */}
            <div className="glass-card" style={{ marginTop: 'var(--spacing-lg)', padding: 0, overflow: 'hidden' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        cursor: 'pointer',
                        borderBottom: showLogs ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                    onClick={() => setShowLogs(!showLogs)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <Terminal size={14} style={{ color: 'var(--color-accent-primary)' }} />
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Canlı Log</span>
                        <span className="badge badge--active" style={{ fontSize: '9px', padding: '1px 5px' }}>
                            {logs.length}
                        </span>
                        {logs.filter(l => l.level === 'ERROR').length > 0 && (
                            <span style={{
                                fontSize: '9px',
                                padding: '1px 5px',
                                background: 'rgba(255,59,48,0.2)',
                                color: '#ff4d4f',
                                borderRadius: '4px',
                                fontWeight: 600,
                            }}>
                                {logs.filter(l => l.level === 'ERROR').length} HATA
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={(e) => { e.stopPropagation(); setLogs([]); }}
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                        >
                            Temizle
                        </button>
                        {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                </div>

                {showLogs && (
                    <div
                        ref={logContainerRef}
                        style={{
                            maxHeight: '320px',
                            overflowY: 'auto',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                            fontSize: '11px',
                            lineHeight: 1.7,
                            background: 'rgba(0,0,0,0.35)',
                        }}
                    >
                        {logs.length === 0 ? (
                            <div style={{
                                color: 'var(--color-text-tertiary)',
                                padding: 'var(--spacing-lg) var(--spacing-md)',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                            }}>
                                <Terminal size={24} style={{ opacity: 0.3 }} />
                                <div>Henüz log yok — tarayıcı başlatıldığında loglar burada görünecek</div>
                                <div style={{ fontSize: '10px', opacity: 0.5 }}>
                                    Tüm loglar ayrıca data/logs/ klasörüne kaydedilir
                                </div>
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        gap: '6px',
                                        padding: '2px 4px',
                                        borderBottom: '1px solid rgba(255,255,255,0.015)',
                                        borderRadius: '2px',
                                        background: log.level === 'ERROR'
                                            ? 'rgba(255,59,48,0.06)'
                                            : log.level === 'WARN'
                                                ? 'rgba(250,173,20,0.04)'
                                                : 'transparent',
                                    }}
                                >
                                    <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontSize: '10px', minWidth: '72px' }}>
                                        {log.timestamp}
                                    </span>
                                    <span style={{
                                        flexShrink: 0,
                                        fontWeight: 700,
                                        fontSize: '10px',
                                        minWidth: '40px',
                                        textAlign: 'center',
                                        padding: '0 2px',
                                        borderRadius: '2px',
                                        color: log.level === 'ERROR' ? '#ff4d4f'
                                            : log.level === 'WARN' ? '#faad14'
                                                : log.level === 'INFO' ? '#52c41a'
                                                    : 'rgba(255,255,255,0.35)',
                                        background: log.level === 'ERROR' ? 'rgba(255,59,48,0.12)'
                                            : log.level === 'WARN' ? 'rgba(250,173,20,0.1)'
                                                : 'transparent',
                                    }}>
                                        {log.level}
                                    </span>
                                    <span style={{
                                        color: '#b388ff',
                                        flexShrink: 0,
                                        fontSize: '10px',
                                        minWidth: '100px',
                                    }}>
                                        [{log.source}]
                                    </span>
                                    <span style={{
                                        color: log.level === 'ERROR' ? '#ff7875'
                                            : log.level === 'WARN' ? '#ffd666'
                                                : 'var(--color-text-secondary)',
                                        wordBreak: 'break-all',
                                    }}>
                                        {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Profil Oluşturma Modal */}
            {showCreateModal && (
                <CreateProfileModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreate}
                />
            )}
        </div>
    );
}

// ─── Profil Oluşturma Modal Bileşeni ────────────────────────

interface CreateProfileModalProps {
    onClose: () => void;
    onCreate: (name: string, browserChannel: 'firefox' | 'msedge' | 'chrome', vfsCountry: string) => Promise<void>;
}

function CreateProfileModal({ onClose, onCreate }: CreateProfileModalProps) {
    const [name, setName] = useState('');
    const [browserChannel, setBrowserChannel] = useState<'firefox' | 'msedge' | 'chrome'>('firefox');
    const [vfsCountry, setVfsCountry] = useState('nld');
    const [countrySearch, setCountrySearch] = useState('');
    const [creating, setCreating] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setCreating(true);
        await onCreate(name.trim(), browserChannel, vfsCountry);
        setCreating(false);
    };

    // Seçili ülke bilgisi
    const selectedCountry = getCountryInfo(vfsCountry);

    // Filtrelenmiş ülkeler
    const filteredCountries = VFS_COUNTRIES.filter(c => {
        if (!countrySearch) return true;
        const q = countrySearch.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.code.includes(q);
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content modal-content--large"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Başlık */}
                <div className="modal-header">
                    <h2>Yeni Profil Oluştur</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body modal-body--scroll">
                        {/* Profil Adı */}
                        <div className="form-section">
                            <h3 className="form-section__title">Profil Bilgileri</h3>
                            <div className="form-group">
                                <label>Profil Adı *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Örn: VFS İstanbul, Kişi 1..."
                                    autoFocus
                                    id="input-profile-name"
                                />
                            </div>
                        </div>

                        {/* VFS Ülke Seçimi */}
                        <div className="form-section">
                            <h3 className="form-section__title">
                                <MapPin size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                                VFS Global Hedef Ülke *
                            </h3>

                            {/* Seçili ülke gösterimi */}
                            {selectedCountry && (
                                <div className="vfs-selected-country">
                                    <span className="vfs-selected-country__flag">{selectedCountry.flag}</span>
                                    <div className="vfs-selected-country__info">
                                        <strong>{selectedCountry.name}</strong>
                                        <span className="vfs-selected-country__url">
                                            visa.vfsglobal.com/tur/en/{selectedCountry.code}/
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Ülke arama */}
                            <div className="pool-toolbar__search" style={{ marginBottom: 'var(--spacing-sm)', maxWidth: '100%' }}>
                                <Search size={14} />
                                <input
                                    type="text"
                                    placeholder="Ülke ara..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                />
                            </div>

                            {/* Ülke grid */}
                            <div className="vfs-country-grid">
                                {filteredCountries.map((c) => (
                                    <button
                                        key={c.code}
                                        type="button"
                                        className={`vfs-country-btn ${vfsCountry === c.code ? 'vfs-country-btn--active' : ''}`}
                                        onClick={() => setVfsCountry(c.code)}
                                    >
                                        <span className="vfs-country-btn__flag">{c.flag}</span>
                                        <span className="vfs-country-btn__name">{c.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tarayıcı Seçimi */}
                        <div className="form-section">
                            <h3 className="form-section__title">Tarayıcı Motoru</h3>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setBrowserChannel('firefox')}
                                    className={`vfs-browser-btn ${browserChannel === 'firefox' ? 'vfs-browser-btn--active' : ''}`}
                                >
                                    <Globe size={14} />
                                    🦊 Firefox (Önerilen)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBrowserChannel('msedge')}
                                    className={`vfs-browser-btn ${browserChannel === 'msedge' ? 'vfs-browser-btn--active' : ''}`}
                                >
                                    <Globe size={14} />
                                    Microsoft Edge
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBrowserChannel('chrome')}
                                    className={`vfs-browser-btn ${browserChannel === 'chrome' ? 'vfs-browser-btn--active' : ''}`}
                                >
                                    <Globe size={14} />
                                    Google Chrome
                                </button>
                            </div>
                            <div style={{
                                marginTop: 'var(--spacing-xs)',
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                background: 'rgba(255, 149, 0, 0.06)',
                                border: '1px solid rgba(255, 149, 0, 0.15)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-text-secondary)',
                            }}>
                                🦊 Firefox önerilir — Cloudflare tespitine karşı en güçlü koruma
                            </div>
                        </div>

                        {/* Bilgi kutusu */}
                        <div style={{
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            background: 'rgba(108, 92, 231, 0.06)',
                            border: '1px solid rgba(108, 92, 231, 0.15)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.5
                        }}>
                            <Fingerprint size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
                            Benzersiz parmak izi otomatik atanacak — Tarayıcı açıldığında VFS login sayfasına yönlendirilecek.
                        </div>
                    </div>

                    {/* Butonlar */}
                    <div className="modal-footer">
                        <button type="button" className="btn btn--ghost" onClick={onClose}>
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="btn btn--primary"
                            disabled={!name.trim() || creating}
                            id="btn-submit-create-profile"
                        >
                            {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                            Oluştur
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Profiles;
