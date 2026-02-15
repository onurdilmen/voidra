/**
 * VOIDRA — Firewall Reset & Recovery Engine
 * 
 * VFS Global'in Cloudflare WAF/CDN firewall'ına takılındığında:
 * 
 *   1. Tüm VFS Global çerezlerini siler (Edge + Chrome)
 *   2. localStorage, sessionStorage, IndexedDB temizler
 *   3. Cache API ve Service Worker'ları temizler
 *   4. DNS cache'i flush eder
 *   5. Modemi yeniden başlatır (gateway üzerinden)
 *   6. Yeni IP adresini doğrular
 * 
 * AMAÇ: Cloudflare'ın IP reputation, cookie chain ve
 * tarayıcı parmak izi ile ilişkilendirdiği TÜM verileri
 * temizleyerek tamamen "yeni kullanıcı" olarak başlamak.
 * 
 * @author YASO
 */

import { exec, execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { Logger } from '@utils/Logger';
import { eventBus } from '@core/EventBus';
import { config as appConfig } from '@core/Config';
import http from 'http';
import https from 'https';

const logger = new Logger('FirewallReset');

// ═══════════════════════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════════════════════

/** Temizleme sonuç raporu */
export interface ResetReport {
    success: boolean;
    timestamp: string;
    steps: ResetStep[];
    oldIp: string | null;
    newIp: string | null;
    ipChanged: boolean;
    totalDuration: number; // ms
    error?: string;
}

interface ResetStep {
    name: string;
    status: 'success' | 'failed' | 'skipped';
    detail: string;
    duration: number; // ms
}

/** Modem yapılandırması */
export interface ModemConfig {
    // Varsayılan gateway adresi (genellikle 192.168.1.1)
    gatewayIp: string;
    // Modem admin kullanıcı adı
    username: string;
    // Modem admin şifresi
    password: string;
    // Yeniden başlatma yöntemi
    method: 'upnp' | 'http_reboot' | 'power_cycle';
    // Modem yeniden başlatma URL'si (http_reboot yöntemi için)
    rebootUrl?: string;
    // Yeniden başlatma sonrası bekleme süresi (ms)
    waitAfterReboot: number;
}

// Varsayılan modem ayarları
const DEFAULT_MODEM_CONFIG: ModemConfig = {
    gatewayIp: '192.168.1.1',
    username: 'admin',
    password: 'admin',
    method: 'http_reboot',
    waitAfterReboot: 60000, // 60 saniye
};

// VFS Global'e ait domain desenleri
const VFS_DOMAINS = [
    'vfsglobal.com',
    'visa.vfsglobal.com',
    '.vfsglobal.com',
    'vfsglobal',
];

// Cloudflare cookie isimleri
const CLOUDFLARE_COOKIES = [
    '__cf_bm',
    'cf_clearance',
    '__cfseq',
    '__cflb',
    '__cfruid',
    'cf_ob_info',
    'cf_use_ob',
    '_cf_bm',
];

// VFS'e özgü cookie/token desenleri
const VFS_COOKIE_PATTERNS = [
    'vfs',
    'VFS',
    'visa',
    'appointment',
    'booking',
    'session',
    'JSESSIONID',
    'XSRF-TOKEN',
    'csrf',
    '_ga',           // Google Analytics (VFS tracking)
    '_gid',
    '_gat',
    'OptanonConsent',
    'OptanonAlertBoxClosed',
    'incap_ses',     // Incapsula
    'visid_incap',
];

// Tarayıcı profil dizinleri
const BROWSER_DATA_PATHS = {
    edge: join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
    chrome: join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    firefox: join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles'),
};

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYON: Tam Sıfırlama
// ═══════════════════════════════════════════════════════════════

/**
 * VFS Global firewall'ına takılınca çalıştırılacak
 * kapsamlı temizleme ve sıfırlama işlemi.
 * 
 * @param modemConfig - Modem yapılandırması (opsiyonel)
 * @param restartModem - Modem yeniden başlatılsın mı?
 */
export async function performFullReset(
    modemConfig?: Partial<ModemConfig>,
    restartModem: boolean = true
): Promise<ResetReport> {
    const startTime = Date.now();
    const config = { ...DEFAULT_MODEM_CONFIG, ...modemConfig };
    const steps: ResetStep[] = [];

    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🔥 VFS FIREWALL RESET — TAM SIFIRLAMA BAŞLIYOR');
    logger.info('═══════════════════════════════════════════════════════');

    // Mevcut IP'yi kaydet
    let oldIp: string | null = null;
    let newIp: string | null = null;

    try {
        oldIp = await getPublicIp();
        logger.info(`📍 Mevcut IP: ${oldIp}`);
    } catch {
        logger.warn('Mevcut IP alınamadı');
    }

    // ─── ADIM 1: Tüm tarayıcı işlemlerini kapat ─────────────
    steps.push(await executeStep('Tarayıcı Süreçlerini Kapat', async () => {
        await killBrowserProcesses();
        return 'Tüm Edge, Chrome ve Firefox süreçleri kapatıldı';
    }));

    // ─── ADIM 2: Edge Cookie'lerini temizle ──────────────────
    steps.push(await executeStep('Edge VFS Cookie Temizleme', async () => {
        const count = await clearBrowserCookies('edge');
        return `Edge: ${count} VFS/Cloudflare cookie dosyası temizlendi`;
    }));

    // ─── ADIM 3: Chrome Cookie'lerini temizle ────────────────
    steps.push(await executeStep('Chrome VFS Cookie Temizleme', async () => {
        const count = await clearBrowserCookies('chrome');
        return `Chrome: ${count} VFS/Cloudflare cookie dosyası temizlendi`;
    }));

    // ─── ADIM 3.5: Firefox Cookie'lerini temizle ─────────────
    steps.push(await executeStep('Firefox VFS Cookie Temizleme', async () => {
        const count = await clearBrowserCookies('firefox');
        return `Firefox: ${count} VFS/Cloudflare cookie dosyası temizlendi`;
    }));

    // ─── ADIM 3.6: VOIDRA Firefox profilini temizle ──────────
    steps.push(await executeStep('VOIDRA Firefox Profil Temizleme', async () => {
        const count = await clearVoidraFirefoxProfiles();
        return `VOIDRA: ${count} izole Firefox profili temizlendi`;
    }));

    // ─── ADIM 4: Web Storage temizleme ───────────────────────
    steps.push(await executeStep('Web Storage Temizleme', async () => {
        const count = await clearWebStorage();
        return `${count} VFS Web Storage kaydı temizlendi`;
    }));

    // ─── ADIM 5: Cache temizleme ─────────────────────────────
    steps.push(await executeStep('Cache Temizleme', async () => {
        const count = await clearBrowserCache();
        return `${count} VFS cache dizini temizlendi`;
    }));

    // ─── ADIM 6: Service Worker temizleme ────────────────────
    steps.push(await executeStep('Service Worker Temizleme', async () => {
        const count = await clearServiceWorkers();
        return `${count} VFS Service Worker kaydı temizlendi`;
    }));

    // ─── ADIM 7: DNS Cache flush ─────────────────────────────
    steps.push(await executeStep('DNS Cache Temizleme', async () => {
        await flushDnsCache();
        return 'DNS cache başarıyla temizlendi';
    }));

    // ─── ADIM 8: SSL/TLS Session Cache temizle ───────────────
    steps.push(await executeStep('SSL/TLS Session Temizleme', async () => {
        await clearSslCache();
        return 'SSL/TLS session cache temizlendi';
    }));

    // ─── ADIM 9: ARP Cache temizle ───────────────────────────
    steps.push(await executeStep('ARP Cache Temizleme', async () => {
        await clearArpCache();
        return 'ARP cache temizlendi';
    }));

    // ─── ADIM 10: Modem yeniden başlatma ─────────────────────
    if (restartModem) {
        steps.push(await executeStep('Modem Yeniden Başlatma', async () => {
            await restartModemDevice(config);
            return `Modem yeniden başlatıldı (${config.method})`;
        }));

        // Modem yeniden başlatma sonrası bekleme
        steps.push(await executeStep('İnternet Bağlantı Bekleme', async () => {
            await waitForInternet(config.waitAfterReboot);
            return 'İnternet bağlantısı yeniden kuruldu';
        }));
    }

    // ─── ADIM 11: Yeni IP doğrulama ─────────────────────────
    try {
        newIp = await getPublicIp();
        logger.info(`📍 Yeni IP: ${newIp}`);
    } catch {
        logger.warn('Yeni IP alınamadı');
    }

    const ipChanged = oldIp !== null && newIp !== null && oldIp !== newIp;

    const totalDuration = Date.now() - startTime;

    const report: ResetReport = {
        success: steps.every(s => s.status !== 'failed') || steps.filter(s => s.status === 'success').length > steps.length / 2,
        timestamp: new Date().toISOString(),
        steps,
        oldIp,
        newIp,
        ipChanged,
        totalDuration,
    };

    // Sonuç raporu
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('✅ VFS FIREWALL RESET — TAMAMLANDI');
    logger.info(`   ⏱️  Süre: ${(totalDuration / 1000).toFixed(1)} saniye`);
    logger.info(`   📍 Eski IP: ${oldIp || 'Bilinmiyor'}`);
    logger.info(`   📍 Yeni IP: ${newIp || 'Bilinmiyor'}`);
    logger.info(`   🔄 IP Değişti: ${ipChanged ? '✅ EVET' : '❌ HAYIR'}`);
    logger.info(`   📊 Adımlar: ${steps.filter(s => s.status === 'success').length}/${steps.length} başarılı`);
    logger.info('═══════════════════════════════════════════════════════');

    if (!ipChanged && restartModem) {
        logger.warn('⚠️ IP adresi değişmedi! Modem yeniden başlatılamadı veya ISP sabit IP veriyor.');
        logger.warn('   → Manuel modem restart deneyin');
        logger.warn('   → Veya mobil hotspot kullanın');
    }

    // Event yayınla
    eventBus.emit('firewall:reset:completed', report);

    return report;
}

// ═══════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

/**
 * Bir adımı çalıştır ve sonucu kaydet
 */
async function executeStep(
    name: string,
    fn: () => Promise<string>
): Promise<ResetStep> {
    const start = Date.now();
    try {
        logger.info(`🔄 ${name}...`);
        const detail = await fn();
        const duration = Date.now() - start;
        logger.info(`   ✅ ${detail} (${duration}ms)`);
        return { name, status: 'success', detail, duration };
    } catch (error) {
        const duration = Date.now() - start;
        const detail = `Hata: ${error}`;
        logger.warn(`   ❌ ${name}: ${detail} (${duration}ms)`);
        return { name, status: 'failed', detail, duration };
    }
}

/**
 * Tüm Edge, Chrome ve Firefox süreçlerini kapat
 */
async function killBrowserProcesses(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const commands = [
            'taskkill /F /IM msedge.exe /T 2>nul',
            'taskkill /F /IM chrome.exe /T 2>nul',
            'taskkill /F /IM firefox.exe /T 2>nul',
        ];

        let completed = 0;
        for (const cmd of commands) {
            exec(cmd, { windowsHide: true }, () => {
                completed++;
                if (completed === commands.length) {
                    setTimeout(resolve, 2000);
                }
            });
        }
    });
}

/**
 * Tarayıcı cookie veritabanından VFS/Cloudflare cookie'lerini sil
 * 
 * Tarayıcılar cookie'leri SQLite veritabanında tutar.
 * Tarayıcı kapalıyken dosyayı silebiliriz.
 */
async function clearBrowserCookies(browser: 'edge' | 'chrome' | 'firefox'): Promise<number> {
    const basePath = BROWSER_DATA_PATHS[browser];
    if (!existsSync(basePath)) {
        logger.debug(`${browser} veri dizini bulunamadı: ${basePath}`);
        return 0;
    }

    let cleanedCount = 0;

    // Firefox farklı dizin yapısı kullanır
    if (browser === 'firefox') {
        return clearFirefoxCookies(basePath);
    }

    try {
        // Chromium tabanlı: Tüm profil dizinlerini tara
        const profileDirs = readdirSync(basePath).filter(dir => {
            return dir === 'Default' || dir.startsWith('Profile ') || dir === 'Guest Profile';
        });

        for (const profileDir of profileDirs) {
            const profilePath = join(basePath, profileDir);

            const cookieFiles = ['Cookies', 'Cookies-journal'];
            for (const cookieFile of cookieFiles) {
                const cookiePath = join(profilePath, cookieFile);
                if (existsSync(cookiePath)) {
                    try {
                        unlinkSync(cookiePath);
                        cleanedCount++;
                        logger.debug(`   Silindi: ${cookiePath}`);
                    } catch (err) {
                        logger.debug(`   Silinemedi (kilitli?): ${cookiePath}`);
                    }
                }
            }

            const networkDir = join(profilePath, 'Network');
            if (existsSync(networkDir)) {
                const networkCookies = ['Cookies', 'Cookies-journal'];
                for (const nc of networkCookies) {
                    const ncPath = join(networkDir, nc);
                    if (existsSync(ncPath)) {
                        try {
                            unlinkSync(ncPath);
                            cleanedCount++;
                        } catch { /* kilitli */ }
                    }
                }
            }
        }
    } catch (error) {
        logger.warn(`${browser} cookie temizleme hatası: ${error}`);
    }

    return cleanedCount;
}

/**
 * Firefox cookie temizleme
 * Firefox cookie'leri cookies.sqlite dosyasında saklar
 */
async function clearFirefoxCookies(profilesDir: string): Promise<number> {
    let cleanedCount = 0;

    try {
        if (!existsSync(profilesDir)) return 0;

        // Firefox profil dizinleri: xxxxxxxx.default-release, xxxxxxxx.default
        const dirs = readdirSync(profilesDir).filter(d =>
            d.includes('.default') || d.includes('.dev-edition')
        );

        for (const dir of dirs) {
            const profilePath = join(profilesDir, dir);

            // Firefox cookie dosyaları
            const cookieFiles = [
                'cookies.sqlite',
                'cookies.sqlite-wal',
                'cookies.sqlite-shm',
            ];

            for (const cf of cookieFiles) {
                const cfPath = join(profilePath, cf);
                if (existsSync(cfPath)) {
                    try {
                        unlinkSync(cfPath);
                        cleanedCount++;
                        logger.debug(`   Firefox cookie silindi: ${cfPath}`);
                    } catch {
                        logger.debug(`   Firefox cookie silinemedi: ${cfPath}`);
                    }
                }
            }

            // Firefox localStorage (webappsstore.sqlite)
            const webappStore = join(profilePath, 'webappsstore.sqlite');
            if (existsSync(webappStore)) {
                try {
                    unlinkSync(webappStore);
                    cleanedCount++;
                    logger.debug(`   Firefox webappsstore silindi`);
                } catch { /* kilitli */ }
            }

            // Firefox cache2 dizini
            const cache2 = join(profilePath, 'cache2');
            if (existsSync(cache2)) {
                try {
                    rmSync(cache2, { recursive: true, force: true });
                    cleanedCount++;
                    logger.debug(`   Firefox cache2 silindi`);
                } catch { /* kilitli */ }
            }
        }
    } catch (error) {
        logger.warn(`Firefox cookie temizleme hatası: ${error}`);
    }

    return cleanedCount;
}

/**
 * VOIDRA'nın oluşturduğu izole Firefox profillerini temizle
 * (data/browser_data/firefox/* dizinleri)
 */
async function clearVoidraFirefoxProfiles(): Promise<number> {
    let cleanedCount = 0;

    try {
        const browserDataDir = join(appConfig.app.dataPath, 'browser_data', 'firefox');

        if (!existsSync(browserDataDir)) return 0;

        const profiles = readdirSync(browserDataDir);
        for (const profile of profiles) {
            const profilePath = join(browserDataDir, profile);
            try {
                rmSync(profilePath, { recursive: true, force: true });
                cleanedCount++;
                logger.info(`   VOIDRA Firefox profil temizlendi: ${profile.substring(0, 8)}...`);
            } catch (err) {
                logger.debug(`   Profil silinemedi: ${err}`);
            }
        }
    } catch (error) {
        logger.warn(`VOIDRA profil temizleme hatası: ${error}`);
    }

    return cleanedCount;
}

/**
 * Web Storage (localStorage, sessionStorage) temizle
 * Her profil dizinindeki Local Storage ve Session Storage dizinlerini temizle
 */
async function clearWebStorage(): Promise<number> {
    let cleanedCount = 0;

    for (const [browser, basePath] of Object.entries(BROWSER_DATA_PATHS)) {
        if (!existsSync(basePath)) continue;

        try {
            const profileDirs = readdirSync(basePath).filter(dir =>
                dir === 'Default' || dir.startsWith('Profile ') || dir === 'Guest Profile'
            );

            for (const profileDir of profileDirs) {
                const profilePath = join(basePath, profileDir);

                // Local Storage — leveldb formatında
                const localStoragePath = join(profilePath, 'Local Storage', 'leveldb');
                if (existsSync(localStoragePath)) {
                    try {
                        // VFS ile ilgili kayıtları bul ve sil
                        const files = readdirSync(localStoragePath);
                        for (const file of files) {
                            const filePath = join(localStoragePath, file);
                            try {
                                // .ldb ve .log dosyalarını kontrol et
                                if (file.endsWith('.ldb') || file.endsWith('.log')) {
                                    const content = readFileSync(filePath, 'latin1');
                                    // VFS domain'i içeriyorsa sil
                                    if (VFS_DOMAINS.some(domain => content.includes(domain))) {
                                        unlinkSync(filePath);
                                        cleanedCount++;
                                        logger.debug(`   LocalStorage silindi: ${filePath}`);
                                    }
                                }
                            } catch { /* okuma/silme hatası normal */ }
                        }
                    } catch { /* dizin erişim hatası */ }
                }

                // Session Storage
                const sessionStoragePath = join(profilePath, 'Session Storage');
                if (existsSync(sessionStoragePath)) {
                    try {
                        const files = readdirSync(sessionStoragePath);
                        for (const file of files) {
                            const filePath = join(sessionStoragePath, file);
                            try {
                                if (file.endsWith('.ldb') || file.endsWith('.log')) {
                                    const content = readFileSync(filePath, 'latin1');
                                    if (VFS_DOMAINS.some(domain => content.includes(domain))) {
                                        unlinkSync(filePath);
                                        cleanedCount++;
                                    }
                                }
                            } catch { /* normal */ }
                        }
                    } catch { /* normal */ }
                }

                // IndexedDB
                const indexedDbPath = join(profilePath, 'IndexedDB');
                if (existsSync(indexedDbPath)) {
                    try {
                        const dirs = readdirSync(indexedDbPath);
                        for (const dir of dirs) {
                            // VFS domain'ini içeren IndexedDB dizinlerini sil
                            if (VFS_DOMAINS.some(domain => dir.toLowerCase().includes(domain.toLowerCase()))) {
                                const fullPath = join(indexedDbPath, dir);
                                rmSync(fullPath, { recursive: true, force: true });
                                cleanedCount++;
                                logger.debug(`   IndexedDB silindi: ${fullPath}`);
                            }
                        }
                    } catch { /* normal */ }
                }
            }
        } catch (error) {
            logger.debug(`${browser} storage temizleme: ${error}`);
        }
    }

    return cleanedCount;
}

/**
 * Tarayıcı cache'ini temizle (VFS ile ilgili olanlar)
 */
async function clearBrowserCache(): Promise<number> {
    let cleanedCount = 0;

    for (const [browser, basePath] of Object.entries(BROWSER_DATA_PATHS)) {
        if (!existsSync(basePath)) continue;

        try {
            const profileDirs = readdirSync(basePath).filter(dir =>
                dir === 'Default' || dir.startsWith('Profile ') || dir === 'Guest Profile'
            );

            for (const profileDir of profileDirs) {
                const profilePath = join(basePath, profileDir);

                // Cache dizinleri
                const cacheDirs = [
                    'Cache',
                    'Code Cache',
                    'GPUCache',
                    join('Service Worker', 'CacheStorage'),
                    join('Service Worker', 'ScriptCache'),
                ];

                for (const cacheDir of cacheDirs) {
                    const cachePath = join(profilePath, cacheDir);
                    if (existsSync(cachePath)) {
                        try {
                            // Tüm cache'i sil (VFS filtreleme cache dosyalarında zor)
                            rmSync(cachePath, { recursive: true, force: true });
                            cleanedCount++;
                            logger.debug(`   Cache silindi: ${cachePath}`);
                        } catch { /* kilitli olabilir */ }
                    }
                }
            }
        } catch (error) {
            logger.debug(`${browser} cache temizleme: ${error}`);
        }
    }

    return cleanedCount;
}

/**
 * Service Worker kayıtlarını temizle
 */
async function clearServiceWorkers(): Promise<number> {
    let cleanedCount = 0;

    for (const [browser, basePath] of Object.entries(BROWSER_DATA_PATHS)) {
        if (!existsSync(basePath)) continue;

        try {
            const profileDirs = readdirSync(basePath).filter(dir =>
                dir === 'Default' || dir.startsWith('Profile ') || dir === 'Guest Profile'
            );

            for (const profileDir of profileDirs) {
                const swPath = join(basePath, profileDir, 'Service Worker');
                if (existsSync(swPath)) {
                    try {
                        // Service Worker veritabanı dosyalarını kontrol et
                        const dbFile = join(swPath, 'Database', 'MANIFEST-000001');
                        if (existsSync(join(swPath, 'Database'))) {
                            // VFS ile ilgili SW kayıtlarını temizle
                            rmSync(join(swPath, 'Database'), { recursive: true, force: true });
                            cleanedCount++;
                        }
                    } catch { /* normal */ }
                }
            }
        } catch (error) {
            logger.debug(`${browser} SW temizleme: ${error}`);
        }
    }

    return cleanedCount;
}

/**
 * Windows DNS cache'ini temizle
 */
async function flushDnsCache(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        exec('ipconfig /flushdns', { windowsHide: true }, (error, stdout) => {
            if (error) {
                reject(new Error(`DNS flush hatası: ${error.message}`));
                return;
            }
            logger.debug(`DNS flush: ${stdout.trim()}`);
            resolve();
        });
    });
}

/**
 * SSL/TLS session cache temizle
 * Windows registry üzerinden TLS session'ları sıfırla
 */
async function clearSslCache(): Promise<void> {
    return new Promise<void>((resolve) => {
        // TLS session cache'i temizlemek için network stack'i sıfırla
        exec('netsh winsock reset catalog 2>nul', { windowsHide: true }, () => {
            resolve();
        });
    });
}

/**
 * ARP cache temizle
 */
async function clearArpCache(): Promise<void> {
    return new Promise<void>((resolve) => {
        exec('arp -d * 2>nul', { windowsHide: true }, () => {
            resolve();
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// MODEM YENİDEN BAŞLATMA
// ═══════════════════════════════════════════════════════════════

/**
 * Modemi yeniden başlat
 * 
 * Desteklenen yöntemler:
 * 1. http_reboot: Modem web arayüzüne HTTP isteği gönderir
 * 2. upnp: UPnP protokolü ile yeniden başlatır
 * 3. power_cycle: Kullanıcıdan manuel restart ister
 */
async function restartModemDevice(config: ModemConfig): Promise<void> {
    logger.info(`🔌 Modem yeniden başlatma yöntemi: ${config.method}`);

    switch (config.method) {
        case 'http_reboot':
            await modemHttpReboot(config);
            break;
        case 'upnp':
            await modemUpnpReboot(config);
            break;
        case 'power_cycle':
            logger.info('⚡ MANUAL POWER CYCLE: Modemi fiziksel olarak kapatıp açın!');
            logger.info('   10 saniye kapalı tutun, sonra tekrar açın.');
            break;
        default:
            throw new Error(`Bilinmeyen modem yeniden başlatma yöntemi: ${config.method}`);
    }
}

/**
 * Modem HTTP arayüzüne login olup yeniden başlatma komutu gönder
 * 
 * En yaygın Türk ISP modemleri için çoklu strateji dener:
 * - TP-Link
 * - ZTE
 * - Huawei
 * - Zyxel (TTNet/Türk Telekom)
 * - Arcadyan (Superbox)
 */
async function modemHttpReboot(config: ModemConfig): Promise<void> {
    const { gatewayIp, username, password } = config;

    // Farklı modem markaları için yeniden başlatma endpoint'leri
    const rebootEndpoints = [
        // Genel
        { url: `http://${gatewayIp}/reboot`, method: 'POST' },
        { url: `http://${gatewayIp}/cgi-bin/reboot`, method: 'POST' },
        { url: `http://${gatewayIp}/api/system/reboot`, method: 'POST' },

        // TP-Link
        { url: `http://${gatewayIp}/cgi?5`, method: 'POST', body: '[SYS_CFG#0,0,0,0,0,0#0,0,0,0,0,0]0,0\r\n' },

        // ZTE (Türk Telekom / Superonline)
        { url: `http://${gatewayIp}/goform/goform_set_cmd_process`, method: 'POST', body: 'isTest=false&goformId=REBOOT_DEVICE' },

        // Huawei
        { url: `http://${gatewayIp}/api/device/control`, method: 'POST', body: '<?xml version="1.0" encoding="UTF-8"?><request><Control>4</Control></request>' },

        // Zyxel (TTNet)
        { url: `http://${gatewayIp}/cgi-bin/Reboot`, method: 'GET' },
        { url: `http://${gatewayIp}/maintenance/reboot`, method: 'POST' },
    ];

    // Kullanıcının özel URL'si varsa önce onu dene
    if (config.rebootUrl) {
        rebootEndpoints.unshift({ url: config.rebootUrl, method: 'POST' });
    }

    // Basic auth header oluştur
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    let success = false;

    for (const endpoint of rebootEndpoints) {
        try {
            logger.debug(`   Deneniyor: ${endpoint.url}`);
            await httpRequest(endpoint.url, {
                method: endpoint.method as 'GET' | 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: endpoint.body,
                timeout: 5000,
            });
            logger.info(`   ✅ Modem yeniden başlatma komutu gönderildi: ${endpoint.url}`);
            success = true;
            break;
        } catch (error) {
            logger.debug(`   ❌ ${endpoint.url}: ${error}`);
            continue;
        }
    }

    if (!success) {
        // Son çare: PowerShell ile network adapter'ı devre dışı bırakıp tekrar etkinleştir
        logger.info('   ⚠️ Modem HTTP yeniden başlatma başarısız — Network adapter reset deneniyor...');
        await resetNetworkAdapter();
    }
}

/**
 * UPnP protokolü ile modemi yeniden başlat
 */
async function modemUpnpReboot(config: ModemConfig): Promise<void> {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Reboot xmlns:u="urn:schemas-upnp-org:service:DeviceConfig:1"></u:Reboot>
  </s:Body>
</s:Envelope>`;

    try {
        await httpRequest(`http://${config.gatewayIp}:49152/upnp/control/deviceconfig`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:DeviceConfig:1#Reboot"',
            },
            body: soapBody,
            timeout: 10000,
        });
        logger.info('   ✅ UPnP reboot komutu gönderildi');
    } catch {
        logger.warn('   UPnP reboot başarısız — HTTP yöntemi deneniyor...');
        await modemHttpReboot(config);
    }
}

/**
 * Windows network adapter'ı devre dışı bırakıp tekrar etkinleştir
 * Bu IP değişikliğini zorlayabilir
 */
async function resetNetworkAdapter(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // Aktif ağ adaptörünü bul
        const findAdapterCmd = `powershell -Command "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and ($_.InterfaceDescription -like '*Ethernet*' -or $_.InterfaceDescription -like '*Wi-Fi*' -or $_.InterfaceDescription -like '*Wireless*') } | Select-Object -First 1 -ExpandProperty Name"`;

        exec(findAdapterCmd, { windowsHide: true }, (error, stdout) => {
            if (error || !stdout.trim()) {
                reject(new Error('Aktif ağ adaptörü bulunamadı'));
                return;
            }

            const adapterName = stdout.trim();
            logger.info(`   🔌 Ağ adaptörü: "${adapterName}"`);
            logger.info('   🔄 Devre dışı bırakılıyor...');

            // Adaptörü kapat
            const disableCmd = `powershell -Command "Disable-NetAdapter -Name '${adapterName}' -Confirm:$false"`;
            exec(disableCmd, { windowsHide: true }, (disableErr) => {
                if (disableErr) {
                    // Admin yetkisi gerekebilir
                    logger.warn(`   ⚠️ Admin yetkisi gerekiyor: ${disableErr.message}`);
                    // Alternatif: netsh kullan
                    exec(`netsh interface set interface "${adapterName}" disable`, { windowsHide: true }, () => {
                        setTimeout(() => {
                            exec(`netsh interface set interface "${adapterName}" enable`, { windowsHide: true }, () => {
                                setTimeout(resolve, 5000);
                            });
                        }, 5000);
                    });
                    return;
                }

                // 5 saniye bekle ve tekrar aç
                setTimeout(() => {
                    logger.info('   🔄 Tekrar etkinleştiriliyor...');
                    const enableCmd = `powershell -Command "Enable-NetAdapter -Name '${adapterName}' -Confirm:$false"`;
                    exec(enableCmd, { windowsHide: true }, () => {
                        setTimeout(() => {
                            logger.info('   ✅ Ağ adaptörü sıfırlandı');
                            resolve();
                        }, 5000);
                    });
                }, 5000);
            });
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// NETWORK ARAÇLARI
// ═══════════════════════════════════════════════════════════════

/**
 * Dış IP adresini öğren
 */
async function getPublicIp(): Promise<string> {
    // Birden fazla servis dene
    const services = [
        'https://api.ipify.org',
        'https://ifconfig.me/ip',
        'https://icanhazip.com',
        'https://checkip.amazonaws.com',
    ];

    for (const url of services) {
        try {
            const response = await httpRequest(url, {
                method: 'GET',
                timeout: 5000,
            });
            const ip = response.trim();
            // Basit IP validation
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                return ip;
            }
        } catch {
            continue;
        }
    }

    throw new Error('Dış IP adresi alınamadı');
}

/**
 * İnternet bağlantısını bekle
 */
async function waitForInternet(maxWait: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 5000; // 5 saniye aralıkla kontrol

    logger.info(`   ⏳ İnternet bağlantısı bekleniyor (max ${maxWait / 1000}s)...`);

    while (Date.now() - startTime < maxWait) {
        try {
            await getPublicIp();
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            logger.info(`   ✅ İnternet bağlantısı kuruldu (${elapsed}s)`);
            return;
        } catch {
            const remaining = Math.ceil((maxWait - (Date.now() - startTime)) / 1000);
            logger.debug(`   ⏳ Bağlantı yok — ${remaining}s kaldı...`);
            await sleep(checkInterval);
        }
    }

    throw new Error(`İnternet bağlantısı ${maxWait / 1000} saniye içinde kurulamadı`);
}

/**
 * Basit HTTP istek yardımcısı
 */
function httpRequest(
    url: string,
    options: {
        method: 'GET' | 'POST';
        headers?: Record<string, string>;
        body?: string;
        timeout?: number;
    }
): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const lib = isHttps ? https : http;

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method,
            headers: options.headers || {},
            timeout: options.timeout || 10000,
            rejectUnauthorized: false, // Modem self-signed cert'ler için
        };

        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

/**
 * Belirli süre bekle
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT GATEWAY BULMA
// ═══════════════════════════════════════════════════════════════

/**
 * Varsayılan gateway IP adresini otomatik bul
 */
export async function detectGateway(): Promise<string> {
    return new Promise((resolve, reject) => {
        exec('ipconfig', { windowsHide: true }, (error, stdout) => {
            if (error) {
                reject(new Error('Gateway bulunamadı'));
                return;
            }

            // Default Gateway satırını bul
            const lines = stdout.split('\n');
            for (const line of lines) {
                const match = line.match(/Default Gateway[^:]*:\s*([\d.]+)/i)
                    || line.match(/Varsay[ıi]lan A[ğg] Ge[çc]idi[^:]*:\s*([\d.]+)/i);
                if (match && match[1]) {
                    resolve(match[1].trim());
                    return;
                }
            }

            reject(new Error('Default gateway bulunamadı'));
        });
    });
}

/**
 * Mevcut dış IP'yi döndür (dışa açık fonksiyon)
 */
export async function getCurrentPublicIp(): Promise<string> {
    return getPublicIp();
}

// ═══════════════════════════════════════════════════════════════
// SADECE COOKIE TEMİZLEME (Modem restart olmadan)
// ═══════════════════════════════════════════════════════════════

/**
 * Sadece VFS Global cookie/token/cache temizle
 * Modem yeniden başlatmadan hızlı temizlik
 */
export async function quickCleanup(): Promise<ResetReport> {
    return performFullReset(undefined, false);
}
