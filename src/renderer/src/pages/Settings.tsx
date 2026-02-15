/**
 * VOIDRA — Ayarlar Sayfası (Tam İşlevsel)
 * Config okuma/yazma, Telegram, VFS, Stealth, Tarayıcı ayarları
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Settings as SettingsIcon,
    Globe,
    Bell,
    Shield,
    Monitor,
    Palette,
    Save,
    RotateCcw,
    CheckCircle,
    AlertCircle,
    Loader2,
    Send,
    Clock,
    Zap,
    Eye
} from 'lucide-react';

// Config tipleri
interface VfsSettings {
    baseUrl: string;
    defaultCountry: string;
    language: 'en' | 'tr';
    slotCheckInterval: number;
    slotCheckMinInterval: number;
    slotCheckMaxInterval: number;
    sessionTimeoutWarning: number;
    autoRefreshSession: boolean;
    maxRetries: number;
    retryDelay: number;
    retryBackoffMultiplier: number;
}

interface NotificationSettings {
    telegramEnabled: boolean;
    telegramBotToken: string;
    telegramChatId: string;
    desktopEnabled: boolean;
    soundEnabled: boolean;
}

interface StealthSettings {
    cleanWebdriver: boolean;
    cleanAutomationVars: boolean;
    forceVisible: boolean;
    hideCdpTraces: boolean;
    canvasNoise: boolean;
    audioNoise: boolean;
    blockWebrtcLeak: boolean;
}

interface FullConfig {
    app: { version: string; debug: boolean; logLevel: string; };
    browser: { channel: string; fallbackChannel: string; headless: boolean; };
    vfs: VfsSettings;
    notification: NotificationSettings;
    stealth: StealthSettings;
    human: { clickDelayMin: number; clickDelayMax: number; typingDelayMin: number; typingDelayMax: number; };
    proxy: { enabled: boolean; };
}

function Settings() {
    const [config, setConfig] = useState<FullConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Config'i backend'den yükle
    const loadConfig = useCallback(async () => {
        try {
            const result = await window.voidra.settings.get();
            if (result.success && result.data) {
                setConfig(result.data as FullConfig);
            }
        } catch (err) {
            console.error('Config yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    // Bildirim göster
    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    // Tek bir ayarı kaydet
    const saveSetting = async (path: string, value: any) => {
        setSaving(true);
        try {
            const result = await window.voidra.settings.set(path, value);
            if (result.success) {
                // Local state güncelle
                setConfig(prev => {
                    if (!prev) return prev;
                    const copy = JSON.parse(JSON.stringify(prev));
                    const keys = path.split('.');
                    let obj = copy;
                    for (let i = 0; i < keys.length - 1; i++) {
                        obj = obj[keys[i]];
                    }
                    obj[keys[keys.length - 1]] = value;
                    return copy;
                });
                showNotification('success', 'Ayar kaydedildi ✓');
            } else {
                showNotification('error', result.error || 'Kayıt başarısız');
            }
        } catch {
            showNotification('error', 'Bağlantı hatası');
        } finally {
            setSaving(false);
        }
    };

    // Toggle bileşeni
    const Toggle = ({ checked, onChange, label, description }: {
        checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
    }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-sm) 0' }}>
            <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{label}</div>
                {description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{description}</div>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none',
                    background: checked ? 'var(--color-accent-primary)' : 'var(--glass-bg)',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    boxShadow: checked ? '0 0 8px rgba(108, 92, 231, 0.4)' : 'none',
                }}
            >
                <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', position: 'absolute', top: 3,
                    left: checked ? 23 : 3, transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
            </button>
        </div>
    );

    // Sayı input bileşeni
    const NumberInput = ({ label, description, value, onChange, min, max, unit }: {
        label: string; description?: string; value: number;
        onChange: (v: number) => void; min?: number; max?: number; unit?: string;
    }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-sm) 0' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{label}</div>
                {description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{description}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    onChange={e => onChange(Number(e.target.value))}
                    style={{
                        width: 80, padding: '6px 10px', borderRadius: 8,
                        border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
                        color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)',
                        textAlign: 'center', outline: 'none',
                    }}
                />
                {unit && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{unit}</span>}
            </div>
        </div>
    );

    // Metin input bileşeni
    const TextInput = ({ label, description, value, onChange, placeholder, type }: {
        label: string; description?: string; value: string;
        onChange: (v: string) => void; placeholder?: string; type?: string;
    }) => (
        <div style={{ padding: 'var(--spacing-sm) 0' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
            {description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{description}</div>}
            <input
                type={type || 'text'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
                    color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)',
                    outline: 'none', boxSizing: 'border-box',
                }}
            />
        </div>
    );

    if (loading || !config) {
        return (
            <div className="animate-fadeIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <Loader2 className="spin" size={32} style={{ color: 'var(--color-accent-primary)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Bildirim */}
            {notification && (
                <div style={{
                    position: 'fixed', top: 60, right: 20, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 12,
                    background: notification.type === 'success'
                        ? 'rgba(0, 184, 148, 0.15)' : 'rgba(214, 48, 49, 0.15)',
                    border: `1px solid ${notification.type === 'success' ? 'rgba(0, 184, 148, 0.3)' : 'rgba(214, 48, 49, 0.3)'}`,
                    color: notification.type === 'success' ? '#00B894' : '#D63031',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)',
                    backdropFilter: 'blur(10px)', animation: 'slideIn 0.3s ease',
                }}>
                    {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {notification.message}
                </div>
            )}

            {/* Sayfa Başlığı */}
            <div className="page-header">
                <h1 className="page-header__title">Ayarlar</h1>
                <p className="page-header__subtitle">
                    VOIDRA konfigürasyonu — tarayıcı, bildirim, VFS ve stealth ayarları
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>

                {/* ═══ Tarayıcı Ayarları ═══ */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                        <Monitor size={18} style={{ color: 'var(--color-accent-secondary)' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Tarayıcı</h3>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Tarayıcı Motoru</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                Profiller bu tarayıcı ile açılır
                            </div>
                        </div>
                        <div className="badge badge--active">
                            <Globe size={10} style={{ marginRight: 4 }} />
                            🦊 Firefox (Stealth)
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Yedek Tarayıcı</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                    Firefox bulunamazsa kullanılır
                                </div>
                            </div>
                            <div className="badge badge--inactive">
                                <Globe size={10} style={{ marginRight: 4 }} />
                                Microsoft Edge
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ Telegram Bildirimleri ═══ */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                        <Send size={18} style={{ color: '#0088cc' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Telegram Bildirimleri</h3>
                    </div>

                    <Toggle
                        label="Telegram Bildirimleri"
                        description="Randevu bulunduğunda Telegram'a bildirim gönder"
                        checked={config.notification.telegramEnabled}
                        onChange={v => saveSetting('notification.telegramEnabled', v)}
                    />

                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                        <TextInput
                            label="Bot Token"
                            description="@BotFather'dan alınan bot token"
                            value={config.notification.telegramBotToken}
                            onChange={v => saveSetting('notification.telegramBotToken', v)}
                            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                        />
                        <TextInput
                            label="Chat ID"
                            description="Bildirimin gönderileceği chat/group ID"
                            value={config.notification.telegramChatId}
                            onChange={v => saveSetting('notification.telegramChatId', v)}
                            placeholder="-1001234567890"
                        />
                    </div>

                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                        <Toggle
                            label="Desktop Bildirimleri"
                            description="İşletim sistemi bildirimleri"
                            checked={config.notification.desktopEnabled}
                            onChange={v => saveSetting('notification.desktopEnabled', v)}
                        />
                        <Toggle
                            label="Sesli Uyarı"
                            description="Randevu bulunduğunda ses çal"
                            checked={config.notification.soundEnabled}
                            onChange={v => saveSetting('notification.soundEnabled', v)}
                        />
                    </div>

                    {/* Test Bildirimi Butonu */}
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                        <button
                            id="btn-test-notification"
                            onClick={async () => {
                                try {
                                    const result = await window.voidra.notification.test();
                                    if (result.success) {
                                        const d = result.data;
                                        const parts = [];
                                        if (d.telegram) parts.push('Telegram ✓');
                                        if (d.desktop) parts.push('Desktop ✓');
                                        if (d.sound) parts.push('Ses ✓');
                                        showNotification('success', `Test gönderildi: ${parts.join(', ') || 'Hiçbir kanal aktif değil'}`);
                                    } else {
                                        showNotification('error', result.error || 'Test başarısız');
                                    }
                                } catch {
                                    showNotification('error', 'Bağlantı hatası');
                                }
                            }}
                            style={{
                                width: '100%', padding: '10px 16px', borderRadius: 10,
                                border: '1px solid rgba(0, 136, 204, 0.3)',
                                background: 'rgba(0, 136, 204, 0.1)',
                                color: '#0088cc', fontSize: 'var(--font-size-sm)',
                                fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 136, 204, 0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0, 136, 204, 0.1)')}
                        >
                            <Bell size={14} />
                            Test Bildirimi Gönder
                        </button>
                    </div>
                </div>

                {/* ═══ VFS Ayarları ═══ */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                        <Clock size={18} style={{ color: 'var(--color-accent-primary)' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>VFS Zamanlama</h3>
                    </div>

                    <NumberInput
                        label="Slot Kontrol Aralığı"
                        description="Müsait randevu kontrolü ne sıklıkla yapılır"
                        value={config.vfs.slotCheckInterval}
                        onChange={v => saveSetting('vfs.slotCheckInterval', v)}
                        min={5} max={300} unit="sn"
                    />
                    <NumberInput
                        label="Minimum Kontrol Aralığı"
                        description="Rate limit koruması — daha hızlı kontrol yapılmaz"
                        value={config.vfs.slotCheckMinInterval}
                        onChange={v => saveSetting('vfs.slotCheckMinInterval', v)}
                        min={5} max={120} unit="sn"
                    />
                    <NumberInput
                        label="Session Timeout Uyarısı"
                        description="VFS oturumunun kapanmasına kaç saniye kala uyarı verilir"
                        value={config.vfs.sessionTimeoutWarning}
                        onChange={v => saveSetting('vfs.sessionTimeoutWarning', v)}
                        min={60} max={900} unit="sn"
                    />
                    <Toggle
                        label="Otomatik Session Yenileme"
                        description="Oturum süresi dolmadan önce otomatik yenile"
                        checked={config.vfs.autoRefreshSession}
                        onChange={v => saveSetting('vfs.autoRefreshSession', v)}
                    />

                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                        <NumberInput
                            label="Hata Sonrası Yeniden Deneme"
                            description="Başarısız isteklerde kaç kez tekrar denenir"
                            value={config.vfs.maxRetries}
                            onChange={v => saveSetting('vfs.maxRetries', v)}
                            min={0} max={10} unit="kez"
                        />
                        <NumberInput
                            label="Yeniden Deneme Bekleme"
                            description="Denemeler arası bekleme süresi"
                            value={config.vfs.retryDelay}
                            onChange={v => saveSetting('vfs.retryDelay', v)}
                            min={1} max={60} unit="sn"
                        />
                    </div>
                </div>

                {/* ═══ Stealth Ayarları ═══ */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                        <Eye size={18} style={{ color: '#e17055' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Stealth (Gizlilik)</h3>
                    </div>

                    <Toggle
                        label="WebDriver Temizleme"
                        description="navigator.webdriver = undefined"
                        checked={config.stealth.cleanWebdriver}
                        onChange={v => saveSetting('stealth.cleanWebdriver', v)}
                    />
                    <Toggle
                        label="Otomasyon Değişkenleri"
                        description="__webdriver_evaluate, __selenium_unwrapped gibi izleri temizle"
                        checked={config.stealth.cleanAutomationVars}
                        onChange={v => saveSetting('stealth.cleanAutomationVars', v)}
                    />
                    <Toggle
                        label="Canvas Noise"
                        description="Canvas fingerprint'e rastgele gürültü ekle"
                        checked={config.stealth.canvasNoise}
                        onChange={v => saveSetting('stealth.canvasNoise', v)}
                    />
                    <Toggle
                        label="Audio Noise"
                        description="AudioContext fingerprint'e gürültü ekle"
                        checked={config.stealth.audioNoise}
                        onChange={v => saveSetting('stealth.audioNoise', v)}
                    />
                    <Toggle
                        label="WebRTC Leak Koruması"
                        description="Gerçek IP'nin WebRTC üzerinden sızmasını engelle"
                        checked={config.stealth.blockWebrtcLeak}
                        onChange={v => saveSetting('stealth.blockWebrtcLeak', v)}
                    />
                    <Toggle
                        label="CDP İzlerini Gizle"
                        description="Chrome DevTools Protocol izlerini temizle"
                        checked={config.stealth.hideCdpTraces}
                        onChange={v => saveSetting('stealth.hideCdpTraces', v)}
                    />
                </div>

                {/* ═══ Proxy ═══ */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                        <Shield size={18} style={{ color: 'var(--color-accent-secondary)' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Proxy Yönetimi</h3>
                    </div>
                    <div className="empty-state" style={{ padding: 'var(--spacing-lg)' }}>
                        <Globe className="empty-state__icon" style={{ width: 40, height: 40 }} />
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
                            Proxy yönetimi yakında eklenecek
                        </p>
                    </div>
                </div>

                {/* ═══ Tema & Versiyon ═══ */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                        <Palette size={18} style={{ color: 'var(--color-accent-secondary)' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Tema & Sistem</h3>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Koyu Tema</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                VOIDRA koyu mod kullanır
                            </div>
                        </div>
                        <div className="badge badge--active">Aktif</div>
                    </div>
                    <div style={{
                        borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--spacing-md)',
                        marginTop: 'var(--spacing-md)', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            VOIDRA v{config.app.version} — Anti-Detect Browser & VFS Automation Engine
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                            "Görünmeden Geç."
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
