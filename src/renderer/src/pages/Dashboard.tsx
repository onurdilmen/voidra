/**
 * VOIDRA — Dashboard Sayfası
 * İstatistikler, son aktiviteler, sistem durumu — gerçek verilerle
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Database,
    Activity,
    Zap,
    Globe,
    Clock,
    CheckCircle,
    Loader2
} from 'lucide-react';

// İstatistik verisi
interface Stats {
    totalProfiles: number;
    activeSessions: number;
    poolCount: number;
    autoFillCount: number;
}

// Aktivite log öğesi
interface LogEntry {
    timestamp: string;
    level: string;
    module: string;
    message: string;
}

function Dashboard() {
    const [stats, setStats] = useState<Stats>({
        totalProfiles: 0,
        activeSessions: 0,
        poolCount: 0,
        autoFillCount: 0
    });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Verileri yükle
    const loadData = useCallback(async () => {
        try {
            // İstatistikler
            const statsResult = await window.voidra?.stats?.get();
            if (statsResult) {
                setStats(statsResult);
            }

            // Log geçmişi
            const logResult = await window.voidra?.log?.getHistory();
            if (logResult) {
                // Son 8 log kaydını al, ters sırada
                setLogs(logResult.slice(-8).reverse());
            }
        } catch (err) {
            console.error('Dashboard veri yükleme hatası:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        // Olaylar geldiğinde istatistikleri güncelle
        const cleanup = window.voidra?.onEvent(() => {
            loadData();
        });

        // Her 5 saniyede bir güncelle
        const interval = setInterval(loadData, 5000);

        return () => {
            cleanup?.();
            clearInterval(interval);
        };
    }, [loadData]);

    // Log seviyesine göre dot rengi
    const getLogDotClass = (level: string) => {
        switch (level) {
            case 'ERROR': return 'timeline__dot--error';
            case 'WARN': return 'timeline__dot--warning';
            case 'INFO': return 'timeline__dot--info';
            default: return 'timeline__dot--success';
        }
    };

    if (loading) {
        return (
            <div className="empty-state">
                <Loader2 size={32} className="spin" style={{ color: 'var(--color-accent-secondary)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Sayfa Başlığı */}
            <div className="page-header">
                <h1 className="page-header__title">Dashboard</h1>
                <p className="page-header__subtitle">
                    VOIDRA kontrol paneli — profiller, oturumlar ve sistem durumu
                </p>
            </div>

            {/* İstatistik Kartları */}
            <div className="stats-grid animate-stagger">
                <div className="stat-card animate-fadeIn">
                    <div className="stat-card__icon stat-card__icon--purple">
                        <Shield size={24} />
                    </div>
                    <div className="stat-card__info">
                        <span className="stat-card__value">{stats.totalProfiles}</span>
                        <span className="stat-card__label">Toplam Profil</span>
                    </div>
                </div>

                <div className="stat-card animate-fadeIn">
                    <div className="stat-card__icon stat-card__icon--green">
                        <Activity size={24} />
                    </div>
                    <div className="stat-card__info">
                        <span className="stat-card__value">{stats.activeSessions}</span>
                        <span className="stat-card__label">Aktif Oturum</span>
                    </div>
                </div>

                <div className="stat-card animate-fadeIn">
                    <div className="stat-card__icon stat-card__icon--orange">
                        <Database size={24} />
                    </div>
                    <div className="stat-card__info">
                        <span className="stat-card__value">{stats.poolCount}</span>
                        <span className="stat-card__label">Havuzdaki Kişi</span>
                    </div>
                </div>

                <div className="stat-card animate-fadeIn">
                    <div className="stat-card__icon stat-card__icon--blue">
                        <Zap size={24} />
                    </div>
                    <div className="stat-card__info">
                        <span className="stat-card__value">{stats.autoFillCount}</span>
                        <span className="stat-card__label">Auto-Fill</span>
                    </div>
                </div>
            </div>

            {/* İki kolonlu layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                {/* Son Aktiviteler */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <Clock size={16} style={{ color: 'var(--color-accent-secondary)' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Son Aktiviteler</h3>
                    </div>
                    <div className="timeline">
                        {logs.length > 0 ? logs.map((log, i) => (
                            <div key={i} className="timeline__item">
                                <div className={`timeline__dot ${getLogDotClass(log.level)}`} />
                                <div className="timeline__content">
                                    <div className="timeline__message">
                                        <span style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--color-text-tertiary)',
                                            marginRight: 'var(--spacing-xs)'
                                        }}>
                                            [{log.module}]
                                        </span>
                                        {log.message}
                                    </div>
                                    <div className="timeline__time">{log.timestamp}</div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', padding: 'var(--spacing-md) 0' }}>
                                Henüz aktivite yok
                            </div>
                        )}
                    </div>
                </div>

                {/* Sistem Durumu */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <Globe size={16} style={{ color: 'var(--color-accent-secondary)' }} />
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Sistem Durumu</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Globe size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    🦊 Firefox (Stealth)
                                </span>
                            </div>
                            <span className="badge badge--active">
                                <CheckCircle size={10} style={{ marginRight: 4 }} />
                                Hazır
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Zap size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    Script Injector
                                </span>
                            </div>
                            <span className="badge badge--active">
                                <CheckCircle size={10} style={{ marginRight: 4 }} />
                                Hazır
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Database size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    Veri Dizini
                                </span>
                            </div>
                            <span className="badge badge--active">
                                <CheckCircle size={10} style={{ marginRight: 4 }} />
                                Hazır
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Shield size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                    Profil Yöneticisi
                                </span>
                            </div>
                            <span className="badge badge--active">
                                <CheckCircle size={10} style={{ marginRight: 4 }} />
                                {stats.totalProfiles} profil
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
