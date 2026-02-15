/**
 * VOIDRA — Profil Modeli
 * Her profil benzersiz bir dijital kimlik temsil eder.
 * Kendi çerezleri, parmak izi, proxy ve oturum verilerine sahiptir.
 */

// Profil durumu
export type ProfileStatus = 'idle' | 'launching' | 'active' | 'closing' | 'error';

// Proxy tipi
export interface ProxyConfig {
    type: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
}

// Parmak izi ayarları (Aşama 3'te genişletilecek)
export interface FingerprintConfig {
    userAgent: string;
    platform: string;
    language: string;
    timezone: string;
    screenResolution: {
        width: number;
        height: number;
    };
    colorDepth: number;
    hardwareConcurrency: number;
    deviceMemory: number;
    webglVendor: string;
    webglRenderer: string;
}

// Profil veri modeli
export interface Profile {
    id: string;
    name: string;
    color: string;
    status: ProfileStatus;
    notes: string;

    // Tarayıcı ayarları
    browserChannel: 'firefox' | 'msedge' | 'chrome';
    startUrl: string;
    vfsCountry: string;     // VFS ülke kodu (nld, deu, fra...)

    // Parmak izi (ileride otomatik oluşturulacak)
    fingerprint: FingerprintConfig;

    // Proxy (opsiyonel)
    proxy?: ProxyConfig;

    // İstatistikler
    createdAt: string;      // ISO 8601
    lastUsedAt: string | null;
    totalSessions: number;

    // Etiketler (filtreleme için)
    tags: string[];
}

// Profil oluşturma parametreleri (kullanıcıdan gelen minimal veri)
export interface CreateProfileParams {
    name: string;
    color?: string;
    browserChannel?: 'firefox' | 'msedge' | 'chrome';
    startUrl?: string;
    vfsCountry?: string;
    notes?: string;
    proxy?: ProxyConfig;
    tags?: string[];
}

// Profil güncelleme parametreleri
export interface UpdateProfileParams {
    name?: string;
    color?: string;
    browserChannel?: 'firefox' | 'msedge' | 'chrome';
    startUrl?: string;
    vfsCountry?: string;
    notes?: string;
    proxy?: ProxyConfig;
    tags?: string[];
}

// Profil özet bilgisi (listeleme için — hafif veri)
export interface ProfileSummary {
    id: string;
    name: string;
    color: string;
    status: ProfileStatus;
    browserChannel: 'firefox' | 'msedge' | 'chrome';
    lastUsedAt: string | null;
    totalSessions: number;
    tags: string[];
    hasProxy: boolean;
    vfsCountry: string;
}
