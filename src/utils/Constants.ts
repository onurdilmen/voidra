/**
 * VOIDRA — Sabitler
 * Uygulama genelinde kullanılan sabit değerler
 */

// Uygulama bilgileri
export const APP_NAME = 'VOIDRA';
export const APP_VERSION = '0.1.0';
export const APP_DESCRIPTION = 'Anti-Detect Browser & VFS Automation Engine';
export const APP_TAGLINE = 'Görünmeden Geç.';

// Varsayılan dizinler
export const DEFAULT_DATA_DIR = './data';
export const DEFAULT_BROWSER_DATA_DIR = './browser_data';
export const PROFILES_DIR = 'profiles';
export const FINGERPRINTS_DIR = 'fingerprints';
export const SESSIONS_DIR = 'sessions';
export const POOL_DIR = 'pool';

// Tarayıcı ayarları
// ★ Firefox tercih ediliyor — CDP Runtime.enable leak riski YOK (Juggler protokolü)
// Cloudflare, Chromium botlarına karşı çok deneyimli — Firefox daha az tespit edilir
export const DEFAULT_BROWSER_CHANNEL = 'firefox';    // Birincil: Mozilla Firefox
export const FALLBACK_BROWSER_CHANNEL = 'msedge';     // Yedek: Microsoft Edge
export const DEFAULT_HEADLESS = false; // Her zaman headful (görünür pencere)

// Dosya adlandırma kalıpları
export const PROFILE_PREFIX = 'voidra_prof_';
export const FINGERPRINT_PREFIX = 'voidra_fp_';
export const SESSION_PREFIX = 'voidra_sess_';

// EventBus olay isimleri
export const EVENTS = {
    // Profil olayları
    PROFILE_CREATED: 'profile:created',
    PROFILE_UPDATED: 'profile:updated',
    PROFILE_DELETED: 'profile:deleted',
    PROFILE_OPENED: 'profile:opened',
    PROFILE_CLOSED: 'profile:closed',

    // Oturum olayları
    SESSION_STARTED: 'session:started',
    SESSION_ENDED: 'session:ended',
    SESSION_ERROR: 'session:error',
    SESSION_PHASE_CHANGED: 'session:phase:changed',

    // Fingerprint olayları
    FINGERPRINT_GENERATED: 'fingerprint:generated',
    FINGERPRINT_APPLIED: 'fingerprint:applied',

    // Havuz olayları
    POOL_APPLICANT_ADDED: 'pool:applicant:added',
    POOL_APPLICANT_UPDATED: 'pool:applicant:updated',
    POOL_APPLICANT_DELETED: 'pool:applicant:deleted',

    // Auto-fill olayları
    AUTOFILL_FORM_DETECTED: 'autofill:form:detected',
    AUTOFILL_STARTED: 'autofill:started',
    AUTOFILL_COMPLETED: 'autofill:completed',
    AUTOFILL_ERROR: 'autofill:error',

    // Ağ olayları
    PROXY_ASSIGNED: 'proxy:assigned',
    PROXY_ERROR: 'proxy:error',

    // Randevu olayları
    APPOINTMENT_FOUND: 'appointment:found',
    APPOINTMENT_BOOKED: 'appointment:booked',

    // Uygulama olayları
    APP_READY: 'app:ready',
    APP_ERROR: 'app:error',

    // Firewall Reset olayları
    FIREWALL_RESET_STARTED: 'firewall:reset:started',
    FIREWALL_RESET_COMPLETED: 'firewall:reset:completed',
    FIREWALL_RESET_STEP: 'firewall:reset:step',
    FIREWALL_RESET_ERROR: 'firewall:reset:error',

    // Slot monitor olayları
    SLOT_MONITOR_STARTED: 'slot:monitor:started',
    SLOT_MONITOR_STOPPED: 'slot:monitor:stopped',
    SLOT_MONITOR_CHECK: 'slot:monitor:check',
    SLOT_MONITOR_ERROR: 'slot:monitor:error',

    // Orchestrator olayları
    ORCHESTRATOR_STATE_CHANGED: 'orchestrator:state:changed',
    ORCHESTRATOR_CYCLE_STARTED: 'orchestrator:cycle:started',
    ORCHESTRATOR_CYCLE_COMPLETED: 'orchestrator:cycle:completed',
} as const;

// IPC kanal isimleri (Electron Main ↔ Renderer)
export const IPC_CHANNELS = {
    // Profil
    PROFILE_LIST: 'profile:list',
    PROFILE_CREATE: 'profile:create',
    PROFILE_UPDATE: 'profile:update',
    PROFILE_DELETE: 'profile:delete',
    PROFILE_OPEN: 'profile:open',
    PROFILE_CLOSE: 'profile:close',
    PROFILE_STATUS: 'profile:status',
    PROFILE_CONNECT: 'profile:connect',         // Login sonrası CDP bağlantısı
    PROFILE_SESSION_INFO: 'profile:session:info', // Oturum durumu sorgula
    PROFILE_LAUNCH_CLEAN: 'profile:launchClean', // Temiz oturum: reset + temizle + aç

    // Havuz
    POOL_LIST: 'pool:list',
    POOL_GET: 'pool:get',
    POOL_ADD: 'pool:add',
    POOL_UPDATE: 'pool:update',
    POOL_DELETE: 'pool:delete',
    POOL_IMPORT: 'pool:import',
    POOL_EXPORT: 'pool:export',

    // Auto-fill
    AUTOFILL_TRIGGER: 'autofill:trigger',
    AUTOFILL_STATUS: 'autofill:status',

    // Ayarlar
    SETTINGS_GET: 'settings:get',
    SETTINGS_SET: 'settings:set',

    // Log
    LOG_ENTRY: 'log:entry',
    LOG_HISTORY: 'log:history',

    // Firewall Reset
    FIREWALL_FULL_RESET: 'firewall:fullReset',
    FIREWALL_QUICK_CLEANUP: 'firewall:quickCleanup',
    FIREWALL_DETECT_GATEWAY: 'firewall:detectGateway',
    FIREWALL_GET_IP: 'firewall:getIp',

    // Slot Monitor
    SLOT_MONITOR_START: 'slot:monitor:start',
    SLOT_MONITOR_STOP: 'slot:monitor:stop',
    SLOT_MONITOR_STATUS: 'slot:monitor:status',

    // Bildirimler
    NOTIFICATION_TEST: 'notification:test',
    NOTIFICATION_SEND: 'notification:send',

    // İstatistikler
    STATS_GET: 'stats:get',

    // Script Server
    SCRIPT_SERVER_URL: 'script:server-url',
    SCRIPT_VIOLENTMONKEY_URL: 'script:violentmonkey-url',
} as const;

// Electron pencere boyutları
export const WINDOW_CONFIG = {
    MIN_WIDTH: 1100,
    MIN_HEIGHT: 700,
    DEFAULT_WIDTH: 1280,
    DEFAULT_HEIGHT: 800
} as const;

// Profil renk paleti (her profil farklı renk alır)
export const PROFILE_COLORS = [
    '#6C5CE7', // Mor
    '#00B894', // Yeşil
    '#E17055', // Turuncu
    '#0984E3', // Mavi
    '#FDCB6E', // Sarı
    '#E84393', // Pembe
    '#00CEC9', // Turkuaz
    '#D63031', // Kırmızı
    '#A29BFE', // Açık Mor
    '#55EFC4'  // Açık Yeşil
] as const;

// ─── VFS Global Ülke Listesi ────────────────────────────────────
// URL deseni: https://visa.vfsglobal.com/tur/tr/{code}/login
export interface VFSCountry {
    code: string;       // URL'deki ülke kodu
    name: string;       // Türkçe görünen isim
    nameEn: string;     // İngilizce isim
    flag: string;       // Emoji bayrak
}

export const VFS_COUNTRIES: VFSCountry[] = [
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
] as const;

/**
 * VFS Global URL oluştur
 * @param countryCode - Ülke kodu (örn: 'nld', 'deu')
 * @returns Tam URL (örn: https://visa.vfsglobal.com/tur/en/nld/)
 */
export function buildVfsLoginUrl(countryCode: string): string {
    return `https://visa.vfsglobal.com/tur/en/${countryCode}/`;
}
