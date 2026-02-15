/**
 * VOIDRA — Browser Launcher v5 — GERÇEK TARAYICI + İZOLE PROFİL
 * 
 * ★ STRATEJİ: Playwright DEĞİL, gerçek sistem tarayıcısı!
 * 
 * NEDEN PLAYWRIGHT DEĞİL:
 *   - Playwright Firefox = boş profil, extension yok
 *   - Cloudflare/VFS bunu anında tespit ediyor (403201)
 *   - Violentmonkey kurulamaz
 *   - TLS fingerprint farklı (Playwright custom build)
 * 
 * YENİ YAKLAŞIM:
 *   1. Gerçek Firefox/Edge binary'si (sistemde kurulu)
 *   2. İzole profil dizini (--profile / --user-data-dir)
 *   3. Firefox user.js ile VFS-uyumlu ayarlar
 *   4. İlk çalıştırmada: Violentmonkey kurulum rehberi
 *   5. --remote-debugging-port ile CDP bağlantısı
 *   6. Kullanıcı manuel login
 *   7. CDP bağlantısı sonrası otomasyon
 * 
 * FIREFOX AVANTAJLARI:
 *   - Farklı TLS fingerprint (JA3/JA4 Chromium'dan farklı)
 *   - Cloudflare'ın Chromium bot DB'sinde yok
 *   - WebRTC leak koruması daha iyi
 *   - Extension API daha güvenli
 */

import { spawn, execSync, type ChildProcess, type SpawnOptions } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@utils/Logger';
import { config } from '@core/Config';
import { eventBus } from '@core/EventBus';
import http from 'http';

const logger = new Logger('BrowserLauncher');

// ═══════════════════════════════════════════════════════════════
// Tipler
// ═══════════════════════════════════════════════════════════════

export interface BrowserProcess {
    process: ChildProcess;
    pid: number;
    debugPort: number;
    wsEndpoint: string;
    browserPath: string;
    userDataDir: string;
    startedAt: string;
    channel: 'firefox' | 'msedge' | 'chrome';
    isFirstRun: boolean;    // İlk çalıştırma mı? (Violentmonkey kurulmalı)
}

// ═══════════════════════════════════════════════════════════════
// Bilinen Tarayıcı Yolları (Windows)
// ═══════════════════════════════════════════════════════════════

const BROWSER_PATHS: Record<string, string[]> = {
    firefox: [
        'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
        'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
        join(process.env.LOCALAPPDATA || '', 'Mozilla Firefox', 'firefox.exe'),
        join(process.env.PROGRAMFILES || '', 'Mozilla Firefox', 'firefox.exe'),
    ],
    msedge: [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
    chrome: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
};

// Sistem profil dizinleri
const SYSTEM_USER_DATA: Record<string, string> = {
    msedge: join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
    chrome: join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    firefox: join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles'),
};

// ═══════════════════════════════════════════════════════════════
// Firefox Profil Hazırlama
// ═══════════════════════════════════════════════════════════════

/**
 * Firefox profil dizinine user.js yaz
 * ★ STEALTH MOD — VFS-uyumlu + anti-detect ayarlar
 * 
 * ÖNEMLİ: Remote debugging ayarları OLMAMALI!
 * Cloudflare şunları kontrol ediyor:
 *   - devtools.debugger.remote-enabled
 *   - devtools.chrome.enabled
 *   - marionette.enabled
 * Hepsi false/kaldırılmış olmalı.
 */
function writeFirefoxUserPrefs(profileDir: string): void {
    const userJsPath = join(profileDir, 'user.js');

    const prefs = `
// ═══════════════════════════════════════════════════════════════
// VOIDRA — Firefox STEALTH Ayarlar
// ★ Debug/otomasyon izleri TEMİZLENDİ — Cloudflare tespiti engellendi
// Bu dosya her başlatmada otomatik uygulanır
// ═══════════════════════════════════════════════════════════════

// ─── Otomasyon İzleri TEMİZLEME (KRİTİK!) ───────────────────
// navigator.webdriver = undefined (Playwright/Selenium tespitini önle)
user_pref("dom.webdriver.enabled", false);

// Marionette (Selenium Firefox driver) devre dışı
user_pref("marionette.enabled", false);

// ★ Remote debugging KAPALI — Cloudflare bunu tespit ediyor!
// Bu ayarlar açıksa 403201 döner:
user_pref("devtools.debugger.remote-enabled", false);
user_pref("devtools.chrome.enabled", false);
user_pref("devtools.debugger.prompt-connection", true);
user_pref("devtools.debugger.force-local", true);

// CDP tamamen devre dışı (Firefox 141+ zaten kaldırdı)
user_pref("devtools.debugger.remote-websocket", false);

// ─── WebRTC IP Leak Koruması ──────────────────────────────────
// Gerçek IP'yi WebRTC üzerinden sızdırmayı önle
user_pref("media.peerconnection.ice.default_address_only", true);
user_pref("media.peerconnection.ice.no_host", true);
user_pref("media.peerconnection.ice.proxy_only_if_behind_proxy", true);

// ─── DNS Koruması ─────────────────────────────────────────────
// DNS over HTTPS (DoH) — DNS sorgularını şifrele
user_pref("network.trr.mode", 2);
user_pref("network.trr.uri", "https://mozilla.cloudflare-dns.com/dns-query");

// ─── Locale & Dil (Türkiye) ──────────────────────────────────
user_pref("intl.accept_languages", "tr-TR, tr, en-US, en");
user_pref("general.useragent.locale", "tr-TR");
user_pref("intl.locale.requested", "tr-TR");

// ─── Gizlilik & Fingerprint ──────────────────────────────────
// ResistFingerprinting KAPALI — açarsan Canvas bozulur, VFS kırılır
user_pref("privacy.resistFingerprinting", false);
user_pref("privacy.trackingprotection.enabled", false);

// Font fingerprinting koruması (kısmi)
user_pref("browser.display.use_document_fonts", 1);

// ─── Fission (Site İzolasyonu) ───────────────────────────────
// Daha güçlü site izolasyonu — her site kendi process'inde çalışır
user_pref("fission.autostart", true);

// ─── Performans & Kararlılık ─────────────────────────────────
user_pref("dom.ipc.processCount", 4);
user_pref("browser.tabs.remote.autostart", true);

// ─── İlk Çalıştırma Popup'larını Engelle ─────────────────────
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
user_pref("browser.aboutwelcome.enabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("browser.rights.3.shown", true);
user_pref("browser.startup.firstrunSkipsHomepage", true);

// Telemetri ve geri bildirim tamamen kapalı
user_pref("toolkit.telemetry.unified", false);
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
user_pref("browser.newtabpage.activity-stream.telemetry", false);
user_pref("browser.ping-centre.telemetry", false);

// ─── Session Restore Kapatma ──────────────────────────────────
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("browser.sessionstore.max_resumed_crashes", 0);

// ─── Cache Ayarları ──────────────────────────────────────────
user_pref("browser.cache.disk.enable", true);
user_pref("browser.cache.memory.enable", true);

// ─── HTTPS ───────────────────────────────────────────────────
user_pref("dom.security.https_only_mode", false);

// ─── Geolocation İzni ────────────────────────────────────────
user_pref("geo.enabled", true);
user_pref("geo.provider.network.url", "https://location.services.mozilla.com/v1/geolocate?key=%MOZILLA_API_KEY%");

// ─── Ek Stealth Ayarlar ──────────────────────────────────────
// Notification popup'larını engelle
user_pref("dom.webnotifications.enabled", false);
user_pref("dom.push.enabled", false);

// İlk çalıştırma sayfalarını atla
user_pref("browser.laterrun.enabled", false);
user_pref("browser.uitour.enabled", false);

// Pocket devre dışı
user_pref("extensions.pocket.enabled", false);

// ─── Extension Otomatik Kurulum ──────────────────────────────
// XPI dosyaları onay istemeden otomatik kurulsun
// 0 = hiçbir scope'da devre dışı bırakma (tümü otomatik aktif)
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
// İlk çalıştırma extension onay popup'ını kapat
user_pref("extensions.install.requireBuiltInCerts", false);
user_pref("xpinstall.signatures.required", false);
`;

    writeFileSync(userJsPath, prefs, 'utf-8');
    logger.info('Firefox user.js yazıldı — STEALTH ayarlar uygulandı');
}

/**
 * Firefox profil dizinini hazırla
 * Yoksa oluştur, user.js yaz, extensions dizini oluştur
 * ★ Violentmonkey XPI otomatik indir ve kur
 */
function prepareFirefoxProfile(profileDir: string): boolean {
    let isFirstRun = false;

    if (!existsSync(profileDir)) {
        mkdirSync(profileDir, { recursive: true });
        isFirstRun = true;
        logger.info(`Yeni Firefox profili oluşturuldu: ${profileDir}`);
    }

    // Eğer extensions dizini yoksa ilk çalıştırma
    const extensionsDir = join(profileDir, 'extensions');
    if (!existsSync(extensionsDir)) {
        mkdirSync(extensionsDir, { recursive: true });
        isFirstRun = true;
    }

    // user.js her zaman güncelle (ayarlar değişmiş olabilir)
    writeFirefoxUserPrefs(profileDir);

    // ★ Violentmonkey XPI'ı kontrol et — yoksa indir
    installViolentmonkeyIfNeeded(extensionsDir);

    return isFirstRun;
}

// Violentmonkey Extension ID (Mozilla Add-ons'dan alındı)
const VIOLENTMONKEY_ID = '{aecec67f-0d10-4fa7-b7c7-609a2db280cf}';
const VIOLENTMONKEY_XPI_URL = 'https://addons.mozilla.org/firefox/downloads/latest/violentmonkey/latest.xpi';

/**
 * ★ Violentmonkey XPI'ı profil/extensions dizinine indir
 * 
 * Firefox, extensions dizininde {extension-id}.xpi dosyası bulursa
 * otomatik olarak kurar (başlangıçta).
 * 
 * NOT: Bu senkron olarak çalışır çünkü prepareFirefoxProfile senkron.
 * İlk çalıştırmada ~2-3 saniye sürebilir.
 */
function installViolentmonkeyIfNeeded(extensionsDir: string): void {
    const xpiPath = join(extensionsDir, `${VIOLENTMONKEY_ID}.xpi`);

    // Zaten indirilmiş mi?
    if (existsSync(xpiPath)) {
        logger.info('✅ Violentmonkey XPI mevcut — kurulum atlanacak');
        return;
    }

    logger.info('📦 Violentmonkey XPI indiriliyor...');
    logger.info(`   URL: ${VIOLENTMONKEY_XPI_URL}`);
    logger.info(`   Hedef: ${xpiPath}`);

    try {
        // Senkron indirme — curl veya PowerShell ile
        if (process.platform === 'win32') {
            execSync(
                `powershell -Command "Invoke-WebRequest -Uri '${VIOLENTMONKEY_XPI_URL}' -OutFile '${xpiPath}' -MaximumRedirection 5"`,
                { stdio: 'pipe', timeout: 30000 }
            );
        } else {
            execSync(
                `curl -L -o "${xpiPath}" "${VIOLENTMONKEY_XPI_URL}"`,
                { stdio: 'pipe', timeout: 30000 }
            );
        }

        if (existsSync(xpiPath)) {
            const stat = require('fs').statSync(xpiPath);
            logger.info(`✅ Violentmonkey XPI indirildi! (${(stat.size / 1024).toFixed(0)} KB)`);
            logger.info('   Firefox açılışında otomatik kurulacak');
        } else {
            logger.warn('⚠️ Violentmonkey XPI indirilemedi — dosya oluşmadı');
        }
    } catch (err) {
        logger.warn(`⚠️ Violentmonkey XPI indirme hatası: ${err}`);
        logger.info('   Manuel kurulum: https://addons.mozilla.org/firefox/addon/violentmonkey/');
    }
}

// ═══════════════════════════════════════════════════════════════
// Yardımcı Fonksiyonlar
// ═══════════════════════════════════════════════════════════════

/**
 * Tarayıcı binary'sini bul
 */
function findBrowserPath(channel: 'firefox' | 'msedge' | 'chrome'): string | null {
    const paths = BROWSER_PATHS[channel] || [];
    for (const p of paths) {
        if (existsSync(p)) {
            logger.debug(`Tarayıcı bulundu: ${p}`);
            return p;
        }
    }
    return null;
}

/**
 * stderr çıktısından WebSocket endpoint'ini yakala
 * Hem Chrome hem Firefox formatını destekler
 */
function parseWSEndpoint(data: string): { port: number; wsEndpoint: string } | null {
    // Chrome/Edge: DevTools listening on ws://127.0.0.1:PORT/devtools/browser/UUID
    // Firefox:     DevTools listening on ws://localhost:PORT/devtools/browser/UUID
    const match = data.match(/DevTools listening on (ws:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/devtools\/browser\/[a-f0-9-]+)/);
    if (match) {
        return {
            wsEndpoint: match[1],
            port: parseInt(match[2], 10),
        };
    }
    return null;
}

/**
 * CDP endpoint'ini HTTP ile bul (fallback yöntem)
 * Firefox bazen WebSocket endpoint'ini stderr'e yazmaz
 */
function fetchWSEndpoint(port: number): Promise<string | null> {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.webSocketDebuggerUrl || null);
                } catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(3000, () => { req.destroy(); resolve(null); });
    });
}

/**
 * Çalışan tarayıcı process'lerini kapat
 */
export async function killExistingBrowser(channel: 'firefox' | 'msedge' | 'chrome'): Promise<void> {
    const processNames: Record<string, string> = {
        msedge: 'msedge.exe',
        chrome: 'chrome.exe',
        firefox: 'firefox.exe',
    };
    const processName = processNames[channel];
    if (!processName) return;

    try {
        execSync(`taskkill /IM ${processName} /F`, {
            stdio: 'ignore',
            timeout: 10000,
        });
        logger.info(`Mevcut ${processName} process'leri kapatıldı`);
        await new Promise(resolve => setTimeout(resolve, 3000));
    } catch {
        logger.debug(`${processName} zaten çalışmıyor`);
    }
}

// ═══════════════════════════════════════════════════════════════
// FIREFOX — Gerçek Sistem Firefox Başlatma
// ═══════════════════════════════════════════════════════════════

/**
 * ★ Gerçek sistem Firefox'u başlat — STEALTH MOD
 * 
 * ★ NEDEN CDP/DEBUG PORT YOK:
 *   - Firefox 141+ CDP desteğini kaldırdı → --remote-debugging-port işlevsiz
 *   - Cloudflare, --remote-debugging-port argümanını tespit ediyor → 403201
 *   - Violentmonkey + VFS Bot Pro script zaten otomasyonu yönetiyor
 *   - CDP bağlantısına GEREK YOK — otomasyon tarayıcı içinde çalışır
 * 
 * ★ STRATEJİ:
 *   1. Saf Firefox başlat (hiçbir debug argümanı yok)
 *   2. user.js ile gizlilik/anti-detect ayarları
 *   3. Violentmonkey → VFS Bot Pro scripti yükle
 *   4. Script tüm otomasyonu tarayıcı içinde çözer
 *   5. VOIDRA sadece izleme ve koordinasyon yapar
 * 
 * @param profileDir - İzole profil dizini
 * @param startUrl - Başlangıç URL'si
 * @param debugPort - KULLANILMIYOR (geriye uyumluluk için tutuldu, değer görmezden gelinir)
 * @param proxyServer - Opsiyonel proxy
 */
export async function launchFirefox(
    profileDir: string,
    startUrl: string,
    debugPort: number = 0,    // ★ Artık kullanılmıyor — stealth mod
    proxyServer?: string,
): Promise<BrowserProcess> {
    // Firefox binary'sini bul
    const browserPath = findBrowserPath('firefox');
    if (!browserPath) {
        throw new Error(
            'Firefox bulunamadı!\n' +
            'Firefox kurulu değil: https://www.mozilla.org/firefox/\n' +
            'Veya Edge kullanmak için profil ayarlarından "msedge" seçin.'
        );
    }

    // Profili hazırla (user.js yaz, dizinleri oluştur)
    const isFirstRun = prepareFirefoxProfile(profileDir);

    // Mevcut Firefox'u kapat (profil kilidi nedeniyle gerekebilir)
    await killExistingBrowser('firefox');

    // ★ Firefox argümanları — TAMamen TEMİZ, debugging portu YOK
    // Cloudflare şunları tespit ediyor ve 403201 döndürüyor:
    //   - --remote-debugging-port → BOT İŞARETİ
    //   - --marionette → BOT İŞARETİ
    //   - devtools.debugger.remote-enabled → Tespit edilebilir
    // Bu yüzden hiçbiri kullanılmıyor!
    const args: string[] = [
        '--profile', profileDir,               // İzole profil dizini
        '--no-remote',                          // Birden fazla Firefox instance'ı
        '--new-instance',                       // Yeni pencere zorla
    ];

    // Proxy varsa
    if (proxyServer) {
        logger.info(`🌐 Proxy: ${proxyServer} (user.js'den ayarlanmalı)`);
    }

    // Başlangıç URL'si en sona
    args.push(startUrl);

    logger.info('═══════════════════════════════════════════════════');
    logger.info('★ STEALTH FIREFOX — BOT TESPİTSİZ');
    logger.info(`  Binary:    ${browserPath}`);
    logger.info(`  Profil:    ${profileDir}`);
    logger.info(`  URL:       ${startUrl}`);
    logger.info('  ─────────────────────────────────────────────');
    logger.info('  ✓ Debugging port YOK (Cloudflare tespiti engellendi)');
    logger.info('  ✓ Marionette KAPALI');
    logger.info('  ✓ Gerçek TLS fingerprint (JA3/JA4 farkı)');
    logger.info('  ✓ navigator.webdriver = undefined');
    logger.info('  ✓ Extension desteği (Violentmonkey)');
    logger.info('  ✓ WebRTC leak koruması (user.js)');
    logger.info('  ─────────────────────────────────────────────');
    logger.info('  📌 Otomasyon: Violentmonkey + VFS Bot Pro');
    logger.info('  📌 CDP bağlantısı GEREKMEZ');
    if (isFirstRun) {
        logger.info('  ─────────────────────────────────────────────');
        logger.info('  ⚠️  İLK ÇALIŞTIRMA — Violentmonkey kurulmalı!');
    }
    logger.info('═══════════════════════════════════════════════════');

    return new Promise<BrowserProcess>((resolve, reject) => {
        let resolved = false;
        let earlyExitCode: number | null = null;

        // ★ Windows'ta detached + pipe + unref birlikte çalışmıyor
        // stdio: 'ignore' kullanıyoruz — Firefox logları user.js ile yönetilir
        const proc = spawn(browserPath, args, {
            detached: true,           // ★ VOIDRA kapansa bile Firefox yaşar
            stdio: 'ignore',          // ★ pipe + unref Windows'ta Electron'u öldürür
            windowsHide: false,
        }) as ChildProcess;

        // Detach — VOIDRA kapanınca Firefox'u öldürme
        proc.unref();

        if (!proc.pid) {
            reject(new Error('Firefox başlatılamadı — PID alınamadı'));
            return;
        }

        logger.info(`Firefox process başlatıldı (PID: ${proc.pid})`);

        // ★ Firefox "launcher process" pattern'ı kullanır:
        //   spawn → launcher PID → child processes oluşturur → launcher KAPANIR
        //   Bu yüzden belirli PID kontrolü YANLIŞ sonuç verir.
        //   Çözüm: Herhangi bir firefox.exe çalışıyor mu kontrol et.
        //   (VOIDRA başlamadan önce tüm Firefox'ları kapatır, güvenli)
        const isFirefoxRunning = (): boolean => {
            try {
                if (process.platform === 'win32') {
                    const result = execSync(
                        'tasklist /FI "IMAGENAME eq firefox.exe" /NH /FO CSV',
                        { encoding: 'utf-8', timeout: 3000, windowsHide: true }
                    );
                    return result.toLowerCase().includes('firefox.exe');
                } else {
                    const result = execSync(
                        'pgrep -x firefox',
                        { encoding: 'utf-8', timeout: 3000 }
                    );
                    return result.trim().length > 0;
                }
            } catch {
                return false;
            }
        };

        // Yardımcı: Resolve helper
        const doResolve = (p: ChildProcess, launcherPid: number) => {
            if (resolved) return;
            resolved = true;
            const bp: BrowserProcess = {
                process: p,
                pid: launcherPid,
                debugPort: 0,
                wsEndpoint: 'stealth://no-cdp',
                browserPath,
                userDataDir: profileDir,
                startedAt: new Date().toISOString(),
                channel: 'firefox',
                isFirstRun,
            };
            logger.info('✅ Stealth Firefox başarıyla başlatıldı!');
            logger.info(`   Launcher PID: ${launcherPid}`);
            logger.info('   Mod: TAM STEALTH — CDP yok, debug port yok');
            resolve(bp);
        };

        // ★ 5 saniye sonra kontrol — firefox.exe çalışıyor mu?
        setTimeout(() => {
            if (resolved) return;

            const alive = isFirefoxRunning();
            logger.info(`Firefox durumu: ${alive ? '✅ ÇALIŞIYOR' : '❌ KAPALI'}`);

            if (alive) {
                // ✅ Firefox çalışıyor — başarılı!
                doResolve(proc, proc.pid!);
            } else {
                // Firefox tamamen kapandı — ilk çalıştırmada restart olabilir
                logger.warn(`Firefox 5s içinde kapandı — yeniden başlatılıyor...`);
                restartFirefox();
            }
        }, 5000);

        // ★ Yeniden başlatma fonksiyonu
        function restartFirefox() {
            if (resolved) return;

            // 2 saniye bekle, sonra yeniden başlat
            setTimeout(() => {
                if (resolved) return;

                logger.info('🔄 Firefox yeniden başlatılıyor (2. deneme)...');
                const proc2 = spawn(browserPath!, args, {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: false,
                }) as ChildProcess;
                proc2.unref();

                if (!proc2.pid) {
                    resolved = true;
                    reject(new Error('Firefox yeniden başlatılamadı — PID alınamadı'));
                    return;
                }

                logger.info(`Firefox 2. deneme başlatıldı (PID: ${proc2.pid})`);

                // 5 saniye bekle
                setTimeout(() => {
                    if (resolved) return;

                    const alive2 = isFirefoxRunning();
                    logger.info(`Firefox 2. deneme durumu: ${alive2 ? '✅ ÇALIŞIYOR' : '❌ KAPALI'}`);

                    if (alive2) {
                        doResolve(proc2, proc2.pid!);
                    } else {
                        resolved = true;
                        reject(new Error(`Firefox 2. denemede de kapandı — tarayıcı başlatılamıyor`));
                    }
                }, 5000);
            }, 2000);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// EDGE/CHROME — CDP ile Başlatma
// ═══════════════════════════════════════════════════════════════

/**
 * Edge/Chrome'u CDP debug portu ile başlat
 * Sistem profili veya izole profil kullanabilir
 */
export async function launchChromium(
    channel: 'msedge' | 'chrome',
    startUrl: string,
    userDataDir?: string,
    proxyServer?: string,
): Promise<BrowserProcess> {
    const browserPath = findBrowserPath(channel);
    if (!browserPath) {
        const fallback = channel === 'msedge' ? 'chrome' : 'msedge';
        const fallbackPath = findBrowserPath(fallback);
        if (!fallbackPath) {
            throw new Error(`Tarayıcı bulunamadı: ${channel} veya ${fallback}`);
        }
        logger.warn(`${channel} bulunamadı, ${fallback} kullanılıyor`);
        return launchChromium(fallback, startUrl, userDataDir, proxyServer);
    }

    await killExistingBrowser(channel);

    const dataDir = userDataDir || SYSTEM_USER_DATA[channel];
    const isSystemProfile = !userDataDir;

    if (!existsSync(dataDir)) {
        if (isSystemProfile) {
            throw new Error(`Sistem profili bulunamadı: ${dataDir}`);
        }
        mkdirSync(dataDir, { recursive: true });
    }

    const args: string[] = [
        `--user-data-dir=${dataDir}`,
        '--remote-debugging-port=0',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-session-crashed-bubble',
        '--hide-crash-restore-bubble',
    ];

    if (!isSystemProfile) {
        args.push(
            '--disable-blink-features=AutomationControlled',
        );
    }

    if (proxyServer) {
        args.push(`--proxy-server=${proxyServer}`);
    }

    args.push(startUrl);

    const profileType = isSystemProfile ? 'SİSTEM PROFİLİ' : 'İZOLE PROFİL';
    logger.info('═══════════════════════════════════════════════════');
    logger.info(`★ ${channel.toUpperCase()} — ${profileType}`);
    logger.info(`  Binary: ${browserPath}`);
    logger.info(`  Profil: ${dataDir}`);
    logger.info(`  URL:    ${startUrl}`);
    logger.info('═══════════════════════════════════════════════════');

    return new Promise<BrowserProcess>((resolve, reject) => {
        const proc = spawn(browserPath, args, {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false,
        });

        if (!proc.pid) {
            reject(new Error('Tarayıcı başlatılamadı'));
            return;
        }

        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                proc.kill();
                reject(new Error('CDP debug port bulunamadı (15s timeout)'));
            }
        }, config.browser.launchTimeout || 15000);

        proc.stderr?.on('data', (data: Buffer) => {
            const endpoint = parseWSEndpoint(data.toString());
            if (endpoint && !resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve({
                    process: proc,
                    pid: proc.pid!,
                    debugPort: endpoint.port,
                    wsEndpoint: endpoint.wsEndpoint,
                    browserPath,
                    userDataDir: dataDir,
                    startedAt: new Date().toISOString(),
                    channel,
                    isFirstRun: false,
                });
                logger.info(`✅ ${channel.toUpperCase()} başlatıldı — Port ${endpoint.port}`);
            }
        });

        proc.on('close', (code) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(new Error(`Tarayıcı kapandı (exit: ${code})`));
            }
        });

        proc.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(new Error(`Tarayıcı hatası: ${err.message}`));
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// Geriye Dönük Uyumluluk
// ═══════════════════════════════════════════════════════════════

export async function launchBrowser(
    channel: 'msedge' | 'chrome',
    startUrl: string,
    proxyServer?: string,
): Promise<BrowserProcess> {
    return launchChromium(channel, startUrl, undefined, proxyServer);
}

export const launchRawBrowser = launchBrowser;
export const launchDebugBrowser = launchBrowser;

// ═══════════════════════════════════════════════════════════════
// Process Yönetimi
// ═══════════════════════════════════════════════════════════════

export function killBrowserProcess(browserProc: BrowserProcess): void {
    try {
        if (browserProc.process && !browserProc.process.killed) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(browserProc.pid), '/T', '/F'], {
                    stdio: 'ignore',
                });
            } else {
                browserProc.process.kill('SIGTERM');
            }
            logger.info(`Tarayıcı kapatıldı (PID: ${browserProc.pid})`);
        }
    } catch (err) {
        logger.warn(`Process kapatma hatası: ${err}`);
    }
}

export function isBrowserRunning(browserProc: BrowserProcess): boolean {
    try {
        if (!browserProc.process || browserProc.process.killed) return false;
        process.kill(browserProc.pid, 0);
        return true;
    } catch {
        return false;
    }
}
