/**
 * VOIDRA — Merkezi Yapılandırma (Config)
 * 
 * Tüm ayarlar tek noktada yönetilir.
 * Runtime'da değiştirilebilir, JSON dosyasından yüklenebilir.
 * 
 * Kullanım:
 *   import { config } from '@core/Config';
 *   config.browser.channel   // 'firefox'
 *   config.vfs.baseUrl       // 'https://visa.vfsglobal.com'
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { Logger } from '@utils/Logger';

const logger = new Logger('Config');

// ═══════════════════════════════════════════════════════════════
// Ayar Tipleri
// ═══════════════════════════════════════════════════════════════

export interface BrowserConfig {
    /** Tercih edilen tarayıcı: firefox | msedge | chrome */
    channel: 'firefox' | 'msedge' | 'chrome';
    /** Yedek tarayıcı */
    fallbackChannel: 'firefox' | 'msedge' | 'chrome';
    /** Headless mod (her zaman false olmalı — bot tespitini önler) */
    headless: boolean;
    /** Tarayıcı başlatma zaman aşımı (ms) */
    launchTimeout: number;
    /** CDP bağlantı zaman aşımı (ms) */
    cdpTimeout: number;
    /** Sayfa yükleme zaman aşımı (ms) */
    pageLoadTimeout: number;
}

export interface ProxyConfig {
    /** Proxy etkin mi? */
    enabled: boolean;
    /** Varsayılan proxy tipi */
    defaultType: 'http' | 'https' | 'socks5';
    /** Proxy rotasyon aralığı (dakika, 0 = rotasyon yok) */
    rotationInterval: number;
    /** Proxy health check aralığı (saniye) */
    healthCheckInterval: number;
}

export interface StealthConfig {
    /** WebDriver temizleme */
    cleanWebdriver: boolean;
    /** Otomasyon değişkenlerini temizle */
    cleanAutomationVars: boolean;
    /** Document visibility override */
    forceVisible: boolean;
    /** CDP izlerini gizle */
    hideCdpTraces: boolean;
    /** Canvas noise enjeksiyonu */
    canvasNoise: boolean;
    /** Audio fingerprint noise */
    audioNoise: boolean;
    /** WebRTC IP leak koruması */
    blockWebrtcLeak: boolean;
}

export interface HumanConfig {
    /** Minimum tıklama gecikmesi (ms) */
    clickDelayMin: number;
    /** Maksimum tıklama gecikmesi (ms) */
    clickDelayMax: number;
    /** Minimum typing gecikmesi (karakter başı ms) */
    typingDelayMin: number;
    /** Maksimum typing gecikmesi (karakter başı ms) */
    typingDelayMax: number;
    /** Mouse hareket hızı çarpanı (1.0 = normal, 0.5 = yavaş) */
    mouseSpeedFactor: number;
    /** Scroll hızı (piksel/step) */
    scrollSpeed: number;
    /** Sayfada rastgele dolaşma (hover, scroll) */
    randomExploration: boolean;
    /** Idle duraklama aralığı (saniye) */
    idlePauseMin: number;
    idlePauseMax: number;
}

export interface VfsConfig {
    /** VFS Global ana URL */
    baseUrl: string;
    /** Varsayılan ülke kodu */
    defaultCountry: string;
    /** Dil kodu (en | tr) */
    language: 'en' | 'tr';
    /** Slot kontrol aralığı (saniye) */
    slotCheckInterval: number;
    /** Minimum slot kontrol aralığı (saniye) — rate limit koruması */
    slotCheckMinInterval: number;
    /** Maksimum slot kontrol aralığı (saniye) — backoff durumunda */
    slotCheckMaxInterval: number;
    /** Session timeout uyarısı (saniye, VFS genellikle 15 dk) */
    sessionTimeoutWarning: number;
    /** Otomatik session yenileme */
    autoRefreshSession: boolean;
    /** Hata sonrası retry sayısı */
    maxRetries: number;
    /** Retry arası bekleme (saniye) */
    retryDelay: number;
    /** Retry backoff çarpanı */
    retryBackoffMultiplier: number;
}

export interface NotificationConfig {
    /** Telegram bildirimi aktif mi? */
    telegramEnabled: boolean;
    /** Telegram bot token */
    telegramBotToken: string;
    /** Telegram chat ID */
    telegramChatId: string;
    /** Desktop bildirimi aktif mi? */
    desktopEnabled: boolean;
    /** Sesli uyarı aktif mi? */
    soundEnabled: boolean;
}

export interface AppConfig {
    /** Uygulama versiyonu */
    version: string;
    /** Debug modu */
    debug: boolean;
    /** Log seviyesi */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Veri dizini yolu */
    dataPath: string;
    /** Maksimum eşzamanlı profil sayısı */
    maxConcurrentProfiles: number;
    /** Otomatik güncelleme kontrolü */
    autoUpdate: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Tam Yapılandırma Arayüzü
// ═══════════════════════════════════════════════════════════════

export interface VoidraConfig {
    app: AppConfig;
    browser: BrowserConfig;
    proxy: ProxyConfig;
    stealth: StealthConfig;
    human: HumanConfig;
    vfs: VfsConfig;
    notification: NotificationConfig;
}

// ═══════════════════════════════════════════════════════════════
// Varsayılan Değerler
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: VoidraConfig = {
    app: {
        version: '0.1.0',
        debug: false,
        logLevel: 'info',
        dataPath: './data',
        maxConcurrentProfiles: 3,
        autoUpdate: false,
    },

    browser: {
        channel: 'firefox',
        fallbackChannel: 'msedge',
        headless: false,
        launchTimeout: 30000,
        cdpTimeout: 15000,
        pageLoadTimeout: 60000,
    },

    proxy: {
        enabled: false,
        defaultType: 'http',
        rotationInterval: 0,
        healthCheckInterval: 60,
    },

    stealth: {
        cleanWebdriver: true,
        cleanAutomationVars: true,
        forceVisible: true,
        hideCdpTraces: true,
        canvasNoise: true,
        audioNoise: true,
        blockWebrtcLeak: true,
    },

    human: {
        clickDelayMin: 200,
        clickDelayMax: 800,
        typingDelayMin: 30,
        typingDelayMax: 150,
        mouseSpeedFactor: 1.0,
        scrollSpeed: 100,
        randomExploration: true,
        idlePauseMin: 2,
        idlePauseMax: 8,
    },

    vfs: {
        baseUrl: 'https://visa.vfsglobal.com',
        defaultCountry: 'nld',
        language: 'en',
        slotCheckInterval: 30,
        slotCheckMinInterval: 15,
        slotCheckMaxInterval: 120,
        sessionTimeoutWarning: 780,     // 13 dakika (VFS 15dk timeout)
        autoRefreshSession: true,
        maxRetries: 3,
        retryDelay: 5,
        retryBackoffMultiplier: 2.0,
    },

    notification: {
        telegramEnabled: false,
        telegramBotToken: '',
        telegramChatId: '',
        desktopEnabled: true,
        soundEnabled: true,
    },
};

// ═══════════════════════════════════════════════════════════════
// Config Yöneticisi
// ═══════════════════════════════════════════════════════════════

class ConfigManager {
    private _config: VoidraConfig;
    private configPath: string | null = null;

    constructor() {
        // Derin kopya ile varsayılan config
        this._config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    /**
     * Config dosyasını yükle (varsa)
     * Yoksa varsayılan değerlerle devam eder
     */
    load(dataPath: string): void {
        this.configPath = join(dataPath, 'config.json');
        this._config.app.dataPath = dataPath;

        if (existsSync(this.configPath)) {
            try {
                const raw = readFileSync(this.configPath, 'utf-8');
                const saved = JSON.parse(raw) as Partial<VoidraConfig>;

                // Derin merge — kayıtlı config'i varsayılanlar üzerine yaz
                this._config = this.deepMerge(
                    JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
                    saved
                ) as VoidraConfig;

                // dataPath her zaman parametre ile gelir
                this._config.app.dataPath = dataPath;

                logger.info(`Config yüklendi: ${this.configPath}`);
            } catch (error) {
                logger.warn(`Config dosyası okunamadı, varsayılanlar kullanılıyor: ${error}`);
            }
        } else {
            logger.info('Config dosyası bulunamadı — varsayılan ayarlar kullanılıyor');
        }
    }

    /**
     * Mevcut config'i diske kaydet
     */
    save(): void {
        if (!this.configPath) {
            logger.warn('Config kaydetmek için önce load() çağrılmalı');
            return;
        }

        try {
            const dir = dirname(this.configPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            // Hassas olmayan ayarları kaydet
            const toSave = JSON.parse(JSON.stringify(this._config));
            // dataPath ve version kaydedilmesin (runtime'da belirlenir)
            delete toSave.app.dataPath;
            delete toSave.app.version;

            writeFileSync(this.configPath, JSON.stringify(toSave, null, 2), 'utf-8');
            logger.debug('Config kaydedildi');
        } catch (error) {
            logger.error('Config kaydedilemedi', error);
        }
    }

    /**
     * Belirli bir ayarı güncelle
     * Örnek: config.set('vfs.slotCheckInterval', 45)
     */
    set<T>(path: string, value: T): void {
        const keys = path.split('.');
        let current: any = this._config;

        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
    }

    /**
     * Belirli bir ayarı oku
     * Örnek: config.get<number>('vfs.slotCheckInterval')
     */
    get<T>(path: string): T | undefined {
        const keys = path.split('.');
        let current: any = this._config;

        for (const key of keys) {
            if (current[key] === undefined) return undefined;
            current = current[key];
        }

        return current as T;
    }

    /**
     * Tam config erişimi (readonly)
     */
    get app(): AppConfig { return this._config.app; }
    get browser(): BrowserConfig { return this._config.browser; }
    get proxy(): ProxyConfig { return this._config.proxy; }
    get stealth(): StealthConfig { return this._config.stealth; }
    get human(): HumanConfig { return this._config.human; }
    get vfs(): VfsConfig { return this._config.vfs; }
    get notification(): NotificationConfig { return this._config.notification; }

    /**
     * Varsayılanlara sıfırla
     */
    reset(): void {
        this._config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        this.save();
        logger.info('Config varsayılanlara sıfırlandı');
    }

    /**
     * Config'in serileştirilebilir kopyasını döndür
     */
    toJSON(): VoidraConfig {
        return JSON.parse(JSON.stringify(this._config));
    }

    /**
     * Derin merge — kaynak objeyi hedef üzerine yaz
     */
    private deepMerge(target: any, source: any): any {
        if (source === null || source === undefined) return target;

        for (const key of Object.keys(source)) {
            if (
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                source[key] !== null
            ) {
                if (!target[key]) target[key] = {};
                target[key] = this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }

        return target;
    }
}

// ═══════════════════════════════════════════════════════════════
// Global Singleton
// ═══════════════════════════════════════════════════════════════

export const config = new ConfigManager();
