/**
 * VOIDRA — Renderer tip tanımları
 * Preload API'nin TypeScript tanımları
 */

// IPC sonuç tipi
interface IPCResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

// Profil özet tipi
interface ProfileSummaryType {
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

// İstatistikler
interface StatsType {
    totalProfiles: number;
    activeSessions: number;
    poolCount: number;
    autoFillCount: number;
}

// Log entry
interface LogEntryType {
    timestamp: string;
    level: string;
    module: string;
    message: string;
}

// Event bridge payload
interface EventBridgePayload {
    event: string;
    data: any;
}

// Oturum bilgisi tipi (Hibrit mimari)
interface SessionInfoType {
    phase: 'launching' | 'waiting_login' | 'connecting' | 'active' | 'closing' | 'error';
    debugPort: number | null;
    pageCount: number;
    cookieCount: number;
    hasAutomation: boolean;
}

// VOIDRA API — preload'dan expose edilen
interface VoidraAPI {
    // Pencere kontrolleri
    window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximized: (callback: (isMaximized: boolean) => void) => () => void;
    };

    // Profil yönetimi
    profile: {
        list: () => Promise<IPCResult<ProfileSummaryType[]>>;
        create: (data: any) => Promise<IPCResult>;
        update: (id: string, data: any) => Promise<IPCResult>;
        delete: (id: string) => Promise<IPCResult>;
        open: (id: string) => Promise<IPCResult>;
        close: (id: string) => Promise<IPCResult>;
        connect: (id: string) => Promise<IPCResult>;                 // ★ Login sonrası CDP bağlantısı
        sessionInfo: (id: string) => Promise<IPCResult<SessionInfoType>>; // Oturum durumu
        launchClean: (id: string, modemConfig?: any) => Promise<IPCResult>;  // ★ Temiz oturum: reset + temizle + aç
        onStatus: (callback: (data: any) => void) => () => void;
    };

    // İstatistikler
    stats: {
        get: () => Promise<StatsType>;
    };

    // Başvuru havuzu
    pool: {
        list: () => Promise<IPCResult>;
        get: (id: string) => Promise<IPCResult>;
        add: (data: any) => Promise<IPCResult>;
        update: (id: string, data: any) => Promise<IPCResult>;
        delete: (id: string) => Promise<IPCResult>;
        import: () => Promise<IPCResult>;
        export: (format: 'json' | 'csv') => Promise<IPCResult>;
    };

    // Auto-fill
    autofill: {
        trigger: (profileId: string, applicantId: string) => Promise<IPCResult>;
        onStatus: (callback: (data: any) => void) => () => void;
    };

    // Ayarlar
    settings: {
        get: () => Promise<IPCResult>;
        set: (path: string, value: any) => Promise<IPCResult>;
    };

    // Bildirimler
    notification: {
        test: () => Promise<IPCResult>;
        send: (type: string, payload: any) => Promise<IPCResult>;
    };

    // Firewall Reset
    firewall: {
        fullReset: (modemConfig?: any) => Promise<IPCResult>;
        quickCleanup: () => Promise<IPCResult>;
        detectGateway: () => Promise<IPCResult>;
        getIp: () => Promise<IPCResult<string>>;
        onResetEvent: (callback: (data: any) => void) => () => void;
    };

    // Log
    log: {
        getHistory: () => Promise<LogEntryType[]>;
        onEntry: (callback: (entry: LogEntryType) => void) => () => void;
    };

    // Olay köprüsü — main process olaylarını dinle
    onEvent: (callback: (payload: EventBridgePayload) => void) => () => void;
}

// Global window'a ekle
declare global {
    interface Window {
        voidra: VoidraAPI;
    }
}

export { };
