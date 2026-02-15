/**
 * VOIDRA — Oturum Yöneticisi v7 — GERÇEK TARAYICI + CDP
 * 
 * ★ TEK AKIŞ (Firefox & Edge aynı):
 * 
 *   1. Gerçek tarayıcı başlat (sistem binary + izole profil)
 *   2. Kullanıcı login olur (Violentmonkey + VFS Bot Pro çalışır)
 *   3. "Login Tamamlandı" → CDP ile bağlan
 *   4. Otomasyon aktif
 * 
 * FIREFOX FARKI:
 *   - --profile argümanı (Edge'de --user-data-dir)
 *   - user.js ile VFS-uyumlu ayarlar otomatik
 *   - İlk çalıştırmada Violentmonkey kurulum rehberi
 *   - Farklı TLS fingerprint → Cloudflare bypass şansı
 * 
 * ORTAK:
 *   - Gerçek extension desteği (Violentmonkey)
 *   - --remote-debugging-port ile CDP bağlantısı
 *   - Login sonrası connectOverCDP()
 *   - VFS Bot Pro script otomatik çalışır (Violentmonkey)
 */

import { chromium, type BrowserContext, type Page, type Browser } from 'playwright';
import { join } from 'path';
import { execSync } from 'child_process';
import { Logger } from '@utils/Logger';
import { eventBus } from '@core/EventBus';
import { EVENTS } from '@utils/Constants';
import { config } from '@core/Config';
import type { Profile } from '@models/Profile';
import { ProfileManager } from '@managers/ProfileManager';
import {
    launchFirefox,
    launchChromium,
    killBrowserProcess,
    isBrowserRunning,
    type BrowserProcess,
} from '@core/BrowserLauncher';
import { injectScriptToContext } from '@core/ScriptInjector';

const logger = new Logger('SessionManager');

// Oturum fazları
export type SessionPhase =
    | 'launching'       // Tarayıcı başlatılıyor
    | 'waiting_login'   // Tarayıcı açık, kullanıcı login bekliyor
    | 'connecting'      // CDP bağlantısı kuruluyor
    | 'active'          // Otomasyon hazır
    | 'closing'         // Kapatılıyor
    | 'error';          // Hata

// Aktif oturum bilgisi
interface ActiveSession {
    profileId: string;
    phase: SessionPhase;
    browserProcess: BrowserProcess;
    browser: Browser | null;
    context: BrowserContext | null;
    pages: Page[];
    channel: 'firefox' | 'msedge' | 'chrome';
    startedAt: string;
}

export class SessionManager {
    private sessions: Map<string, ActiveSession> = new Map();
    private pidWatchers: Map<string, NodeJS.Timeout> = new Map();
    private profileManager: ProfileManager;

    constructor(profileManager: ProfileManager) {
        this.profileManager = profileManager;
    }

    // ═══════════════════════════════════════════════════════════════
    // ADIM 1: TARAYICI BAŞLAT
    // Firefox ve Edge aynı akışı izler: başlat → login bekle → CDP
    // ═══════════════════════════════════════════════════════════════

    async openSession(profileId: string): Promise<boolean> {
        if (this.sessions.has(profileId)) {
            logger.warn(`Profil zaten aktif: ${profileId.substring(0, 8)}...`);
            return false;
        }

        const profile = await this.profileManager.get(profileId);
        if (!profile) {
            logger.error(`Profil bulunamadı: ${profileId}`);
            return false;
        }

        this.profileManager.setStatus(profileId, 'launching');
        eventBus.emit(EVENTS.SESSION_STARTED, { profileId, status: 'launching' });

        const channel = (profile.browserChannel || config.browser.channel) as 'firefox' | 'msedge' | 'chrome';

        try {
            // URL
            const startUrl = profile.startUrl || `${config.vfs.baseUrl}/tur/${config.vfs.language}/${config.vfs.defaultCountry}/`;

            // Proxy
            let proxyServer: string | undefined;
            if (profile.proxy) {
                proxyServer = `${profile.proxy.type}://${profile.proxy.host}:${profile.proxy.port}`;
            }

            let browserProcess: BrowserProcess;

            if (channel === 'firefox') {
                // ★ STEALTH Firefox — izole profil, debug port YOK
                const profileDir = join(config.app.dataPath, 'browser_data', 'firefox', profileId);
                browserProcess = await launchFirefox(profileDir, startUrl, 0, proxyServer);
            } else {
                // Edge/Chrome — sistem profili + CDP
                browserProcess = await launchChromium(channel, startUrl, undefined, proxyServer);
            }

            // ★ Firefox stealth modda doğrudan 'active' — CDP gerekmez
            // Edge/Chrome'da 'waiting_login' — CDP bağlantısı sonra kurulacak
            const isStealth = channel === 'firefox' && browserProcess.debugPort === 0;
            const initialPhase = isStealth ? 'active' : 'waiting_login';

            // Oturumu kaydet
            const session: ActiveSession = {
                profileId,
                phase: initialPhase as ActiveSession['phase'],
                browserProcess,
                browser: null,
                context: null,
                pages: [],
                channel,
                startedAt: new Date().toISOString(),
            };
            this.sessions.set(profileId, session);

            // Tarayıcı kapanma izleme
            if (isStealth) {
                // ★ STEALTH MOD — detached+unref+stdio:ignore process'inde
                // close event HEMEN tetiklenir (güvenilmez!). Yerine PID polling.
                this.startPidWatcher(profileId, browserProcess.pid);
            } else {
                // CDP modunda close event güvenilir
                browserProcess.process.on('close', (code) => {
                    const sess = this.sessions.get(profileId);
                    if (sess && sess.phase !== 'closing') {
                        logger.warn(`Tarayıcı kapatıldı (exit: ${code})`);
                        this.cleanupSession(profileId);
                    }
                });
            }

            await this.profileManager.recordSessionStart(profileId);
            this.profileManager.setStatus(profileId, 'active');

            if (isStealth) {
                // ★ FIREFOX STEALTH — Hemen aktif, CDP yok
                eventBus.emit(EVENTS.SESSION_STARTED, {
                    profileId,
                    status: 'active',
                    message: 'Stealth Firefox açıldı — VFS Bot Pro hazır!',
                    channel,
                    isFirstRun: browserProcess.isFirstRun,
                });

                logger.info('');
                logger.info('✅ Stealth Firefox başlatıldı — hemen aktif!');
                logger.info('📋 Otomatik yapılanlar:');
                logger.info('   ✓ Violentmonkey kuruldu');
                logger.info('   ✓ Debug portu YOK (Cloudflare tespit edemez)');
                logger.info('   ✓ Anti-detect user.js uygulandı');
                logger.info('');

                // ★ VFS Bot Pro scriptini Violentmonkey'e otomatik yükle
                // Firefox açıldıktan sonra script server URL'sini aç
                // Violentmonkey .user.js uzantısını otomatik algılar
                if (browserProcess.isFirstRun) {
                    const scriptUrl = `http://localhost:18923/vfs-turkey-netherlands-auto-book-pro.user.js`;
                    logger.info(`📥 VFS Bot Pro scripti yükleniyor: ${scriptUrl}`);

                    // Firefox tamamen yüklendikten sonra script URL'sini aç
                    setTimeout(() => {
                        try {
                            const { spawn: spawnChild } = require('child_process');
                            const browserPath = browserProcess.browserPath;
                            const profileDir = browserProcess.userDataDir;
                            // Firefox'a yeni sekme olarak script URL'sini gönder
                            spawnChild(browserPath, [
                                '--profile', profileDir,
                                scriptUrl,
                            ], {
                                detached: true,
                                stdio: 'ignore'
                            }).unref();
                            logger.info('✅ Script URL Firefox\'a gönderildi — Violentmonkey algılayacak');
                        } catch (err) {
                            logger.warn(`⚠️ Script otomatik yüklenemedi: ${err}`);
                            logger.info(`   Manuel yükleme: ${scriptUrl}`);
                        }
                    }, 8000);
                }

                logger.info('📌 Kullanıcıdan beklenen:');
                logger.info('   1. VFS sayfasına git');
                logger.info('   2. Login ol (Cloudflare challenge + email/şifre)');
                logger.info('   3. VFS Bot Pro scripti otomatik çalışacak');
                logger.info('   → "Login Tamamlandı" butonuna gerek YOK');
            } else {
                // ★ EDGE/CHROME — CDP akışı, login sonrası bağlantı
                const message = browserProcess.isFirstRun
                    ? 'İlk çalıştırma — Violentmonkey kurun, sonra login olun'
                    : 'Tarayıcı açıldı — Login olun';

                eventBus.emit(EVENTS.SESSION_STARTED, {
                    profileId,
                    status: 'waiting_login',
                    message,
                    channel,
                    isFirstRun: browserProcess.isFirstRun,
                });

                logger.info('');
                logger.info('✅ Tarayıcı başlatıldı');
                logger.info('📋 Kullanıcıdan beklenen:');

                if (browserProcess.isFirstRun) {
                    logger.info('   ⚠️ İLK ÇALIŞTIRMA:');
                    logger.info('   0. Violentmonkey kur:');
                    logger.info('      Edge → https://microsoftedge.microsoft.com/addons/detail/violentmonkey/');
                    logger.info('');
                }

                logger.info('   1. VFS sayfasına git');
                logger.info('   2. Login ol (Cloudflare + email/şifre)');
                logger.info('   3. VOIDRA\'da "Login Tamamlandı" butonuna bas');
                logger.info('   → CDP bağlantısı kurulacak');
                logger.info('   → Tarayıcı KAPANMAYACAK');
            }

            return true;

        } catch (error) {
            logger.error(`Oturum başlatılamadı: "${profile.name}"`, error);
            this.profileManager.setStatus(profileId, 'error');
            eventBus.emit(EVENTS.SESSION_ERROR, { profileId, error: String(error) });
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ADIM 2: CDP BAĞLANTISI — LOGIN SONRASI
    // Her iki tarayıcıda da (Firefox & Edge) aynı akış
    // ═══════════════════════════════════════════════════════════════

    async connectAfterLogin(profileId: string): Promise<boolean> {
        const session = this.sessions.get(profileId);
        if (!session) {
            logger.error(`Oturum bulunamadı: ${profileId}`);
            return false;
        }

        if (session.phase !== 'waiting_login') {
            logger.warn(`Oturum login bekleme durumunda değil: ${session.phase}`);
            return false;
        }

        // Tarayıcı hala çalışıyor mu?
        if (!isBrowserRunning(session.browserProcess)) {
            logger.error('Tarayıcı kapanmış — oturum başlatılamaz');
            session.phase = 'error';
            eventBus.emit(EVENTS.SESSION_ERROR, {
                profileId,
                error: 'Tarayıcı kapanmış. Profili yeniden başlatın.',
            });
            return false;
        }

        // ★ Firefox STEALTH modunda CDP bağlantısı YOK
        // Otomasyon tamamen Violentmonkey + VFS Bot Pro ile çalışıyor
        if (session.channel === 'firefox' && session.browserProcess.debugPort === 0) {
            session.phase = 'active';

            logger.info('═══════════════════════════════════════════');
            logger.info('★ FIREFOX STEALTH — LOGIN TAMAMLANDI');
            logger.info('  CDP bağlantısı YOK (stealth mod)');
            logger.info('  Otomasyon: Violentmonkey + VFS Bot Pro');
            logger.info('═══════════════════════════════════════════');
            logger.info('✅ Oturum aktif — script tarayıcı içinde çalışıyor');
            logger.info('   📌 VFS Bot Pro randevu arayacak');
            logger.info('   📌 Telegram bildirimi gönderecek');
            logger.info('   📌 Auto-fill hazır');
            logger.info('═══════════════════════════════════════════');

            eventBus.emit(EVENTS.SESSION_STARTED, {
                profileId,
                status: 'active',
                message: 'Stealth oturum aktif — VFS Bot Pro çalışıyor!',
                pageCount: 0,
                cookieCount: 0,
            });

            return true;
        }

        // ★ Edge/Chrome — CDP bağlantısı kuruluyor
        session.phase = 'connecting';
        eventBus.emit(EVENTS.SESSION_STARTED, {
            profileId,
            status: 'connecting',
            message: 'CDP bağlantısı kuruluyor...',
        });

        try {
            const wsEndpoint = session.browserProcess.wsEndpoint;
            logger.info('═══════════════════════════════════════════');
            logger.info('★ CDP BAĞLANTISI — AYNI TARAYICIYA');
            logger.info(`  WS: ${wsEndpoint}`);
            logger.info(`  Kanal: ${session.channel}`);
            logger.info('  Tarayıcı KAPANMIYOR — session korunuyor');
            logger.info('═══════════════════════════════════════════');

            // ★ CDP bağlantısı — Edge/Chrome
            const browser = await chromium.connectOverCDP(wsEndpoint, {
                timeout: config.browser.cdpTimeout || 30000,
            });

            logger.info('✅ CDP bağlantısı kuruldu!');

            const contexts = browser.contexts();
            const context = contexts.length > 0 ? contexts[0] : null;

            if (!context) {
                logger.error('Browser context bulunamadı');
                browser.close();
                return false;
            }

            const pages = context.pages();
            logger.info(`📄 ${pages.length} açık sayfa bulundu`);

            // Cookie kontrolü
            const cookies = await context.cookies();
            const cfClearance = cookies.find(c => c.name === 'cf_clearance');
            const cfBm = cookies.find(c => c.name === '__cf_bm');
            const vfsCookies = cookies.filter(c => c.domain?.includes('vfsglobal'));

            logger.info('🍪 Cookie Durumu:');
            logger.info(`   cf_clearance: ${cfClearance ? '✅ MEVCUT' : '❌ YOK'}`);
            logger.info(`   __cf_bm: ${cfBm ? '✅ MEVCUT' : '❌ YOK'}`);
            logger.info(`   VFS cookie: ${vfsCookies.length}`);
            logger.info(`   Toplam: ${cookies.length}`);

            // Session güncelle
            session.browser = browser;
            session.context = context;
            session.pages = [...pages];
            session.phase = 'active';

            // Yeni sekme takibi
            context.on('page', async (newPage) => {
                const sess = this.sessions.get(profileId);
                if (sess) {
                    sess.pages.push(newPage);
                    logger.debug(`Yeni sekme — toplam: ${sess.pages.length}`);
                }
            });

            for (const page of pages) {
                page.on('close', () => {
                    const sess = this.sessions.get(profileId);
                    if (sess) {
                        sess.pages = sess.pages.filter(p => p !== page);
                    }
                });
                logger.info(`   📄 ${page.url()}`);
            }

            // VFS Bot Pro Script enjekte et (Violentmonkey yoksa fallback)
            try {
                await injectScriptToContext(context);
                logger.info('🚀 VFS Bot Pro script enjekte edildi (fallback)');
            } catch (injectErr) {
                // Violentmonkey zaten çalışıyorsa bu beklenen bir hata
                logger.debug(`Script enjeksiyon: ${injectErr} (Violentmonkey varsa sorun yok)`);
            }

            // UI'a bildir
            eventBus.emit(EVENTS.SESSION_STARTED, {
                profileId,
                status: 'active',
                message: 'CDP aktif — Otomasyon hazır!',
                pageCount: pages.length,
                cookieCount: cookies.length,
            });

            logger.info('═══════════════════════════════════════════');
            logger.info('✅ OTURUM AKTİF!');
            logger.info(`   📄 Sayfalar: ${pages.length}`);
            logger.info(`   🍪 Cookie: ${cookies.length}`);
            logger.info('   🚀 VFS Bot Pro hazır (Violentmonkey)');
            logger.info('   🔥 Auto-fill ve otomasyon kullanılabilir');
            logger.info('═══════════════════════════════════════════');

            return true;

        } catch (error) {
            logger.error('CDP bağlantı hatası', error);
            session.phase = 'error';

            eventBus.emit(EVENTS.SESSION_ERROR, {
                profileId,
                error: `CDP bağlantı hatası: ${error}`,
            });
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DURUM SORGULAMA
    // ═══════════════════════════════════════════════════════════════

    getSessionPhase(profileId: string): SessionPhase | null {
        return this.sessions.get(profileId)?.phase || null;
    }

    isAutomationReady(profileId: string): boolean {
        const session = this.sessions.get(profileId);
        return session?.phase === 'active' && session?.context !== null;
    }

    getPages(profileId: string): Page[] {
        return this.sessions.get(profileId)?.pages || [];
    }

    getSessionInfo(profileId: string): {
        phase: SessionPhase;
        channel: string;
        debugPort: number | null;
        pageCount: number;
        cookieCount: number;
        hasAutomation: boolean;
        isFirstRun: boolean;
    } | null {
        const session = this.sessions.get(profileId);
        if (!session) return null;

        return {
            phase: session.phase,
            channel: session.channel,
            debugPort: session.browserProcess?.debugPort || null,
            pageCount: session.pages.length,
            cookieCount: 0,
            hasAutomation: session.phase === 'active' && session.context !== null,
            isFirstRun: session.browserProcess?.isFirstRun || false,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // KAPATMA
    // ═══════════════════════════════════════════════════════════════

    async closeSession(profileId: string): Promise<boolean> {
        const session = this.sessions.get(profileId);
        if (!session) return false;

        session.phase = 'closing';
        this.profileManager.setStatus(profileId, 'closing');

        try {
            // CDP bağlantısını kapat
            if (session.browser) {
                try {
                    await session.browser.close();
                    logger.info('CDP bağlantısı kapatıldı');
                } catch {
                    logger.debug('CDP zaten kapalı');
                }
            }

            // Tarayıcıyı kapat
            killBrowserProcess(session.browserProcess);

            this.sessions.delete(profileId);
            await this.profileManager.recordSessionEnd(profileId);
            eventBus.emit(EVENTS.SESSION_ENDED, { profileId });
            logger.info(`✅ Oturum kapatıldı (${profileId.substring(0, 8)}...)`);

            return true;

        } catch (error) {
            logger.error(`Kapatma hatası: ${profileId}`, error);
            this.sessions.delete(profileId);
            this.profileManager.setStatus(profileId, 'error');
            return false;
        }
    }

    private async cleanupSession(profileId: string): Promise<void> {
        const session = this.sessions.get(profileId);
        if (!session) return;

        // PID watcher'ı durdur
        this.stopPidWatcher(profileId);

        if (session.browser) {
            try { await session.browser.close(); } catch { /* ignore */ }
        }

        this.sessions.delete(profileId);
        await this.profileManager.recordSessionEnd(profileId);
        this.profileManager.setStatus(profileId, 'idle');
        eventBus.emit(EVENTS.SESSION_ENDED, { profileId });
        logger.info('Oturum temizlendi');
    }

    // ═══════════════════════════════════════════════════════════════
    // PID WATCHER — Stealth modda Firefox hayatta mı?
    // detached+unref+stdio:ignore process'inde close event güvenilmez
    // ═══════════════════════════════════════════════════════════════

    private startPidWatcher(profileId: string, _launcherPid: number): void {
        // Önceki watcher varsa durdur
        this.stopPidWatcher(profileId);

        logger.info(`🔍 Firefox watcher başlatıldı (30s aralıkla kontrol)`);

        const interval = setInterval(() => {
            try {
                let alive = false;
                if (process.platform === 'win32') {
                    // Firefox "launcher process" kullanır — launcher PID ölür
                    // ama asıl Firefox child process'leri çalışmaya devam eder
                    // Bu yüzden herhangi bir firefox.exe var mı kontrol ediyoruz
                    const result = execSync(
                        'tasklist /FI "IMAGENAME eq firefox.exe" /NH /FO CSV',
                        { encoding: 'utf-8', timeout: 3000, windowsHide: true }
                    );
                    alive = result.toLowerCase().includes('firefox.exe');
                } else {
                    try {
                        const result = execSync('pgrep -x firefox', { encoding: 'utf-8', timeout: 3000 });
                        alive = result.trim().length > 0;
                    } catch { alive = false; }
                }

                if (!alive) {
                    const sess = this.sessions.get(profileId);
                    if (sess && sess.phase !== 'closing') {
                        logger.warn(`🔴 Firefox tamamen kapandı — oturum temizleniyor`);
                        this.cleanupSession(profileId);
                    }
                    this.stopPidWatcher(profileId);
                }
            } catch {
                // tasklist hatası — sessizce geç
            }
        }, 30000); // 30 saniyede bir kontrol

        this.pidWatchers.set(profileId, interval);
    }

    private stopPidWatcher(profileId: string): void {
        const interval = this.pidWatchers.get(profileId);
        if (interval) {
            clearInterval(interval);
            this.pidWatchers.delete(profileId);
        }
    }

    async closeAll(): Promise<void> {
        logger.info(`Tüm oturumlar kapatılıyor (${this.sessions.size})...`);
        await Promise.allSettled(
            Array.from(this.sessions.keys()).map(id => this.closeSession(id))
        );
        logger.info('Tüm oturumlar kapatıldı ✓');
    }

    // ═══════════════════════════════════════════════════════════════
    // İSTATİSTİKLER
    // ═══════════════════════════════════════════════════════════════

    get activeSessionCount(): number { return this.sessions.size; }
    isActive(profileId: string): boolean { return this.sessions.has(profileId); }
}
