/**
 * VOIDRA — VFS Script Injector v2 (Violentmonkey Entegrasyonu)
 * 
 * ★ STRATEJİ: CDP page.evaluate YERİNE Violentmonkey kullanarak script çalıştır
 * 
 * Neden Violentmonkey?
 *   1. Doğal extension davranışı — bot tespiti YOK
 *   2. Script, Cloudflare'dan ÖNCE yüklenir (document-start)
 *   3. GM_* API'leri kullanılabilir (localStorage cross-domain, vs.)
 *   4. page.evaluate() CSP sorunlarından etkilenmez
 *   5. Kullanıcının gerçek profili ile birlikte çalışır
 * 
 * AKIŞ:
 *   1. VOIDRA Edge'i başlatır (gerçek sistem profili)
 *   2. Eğer Violentmonkey kurulu değilse → kurulum sayfasına yönlendir
 *   3. Local HTTP server script'i serve eder (localhost:18923)
 *   4. Violentmonkey .user.js URL'ini algılar → otomatik kurulum teklifi
 *   5. Script her VFS sayfasında otomatik çalışır
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createServer, type Server } from 'http';
import { app } from 'electron';
import { Logger } from '@utils/Logger';
import { PoolManager } from '@managers/PoolManager';
import { config } from '@core/Config';
import type { Page, BrowserContext } from 'playwright';

const logger = new Logger('ScriptInjector');

// ═══════════════════════════════════════════════════════════════
// YAPILANDIRMA
// ═══════════════════════════════════════════════════════════════

const SCRIPT_NAME = 'vfs-turkey-netherlands-auto-book-pro.user.js';
const LOCAL_SERVER_PORT = 18923;
const VIOLENTMONKEY_EDGE_URL = 'https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjdenobohnndmmkbhalmondnfc';
const VIOLENTMONKEY_CHROME_URL = 'https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag';

// ═══════════════════════════════════════════════════════════════
// SCRIPT DOSYASI BULMA
// ═══════════════════════════════════════════════════════════════

let cachedScript: string | null = null;
let httpServer: Server | null = null;

/**
 * Script dosyasını bul ve oku
 */
function getScriptPaths(): string[] {
    const paths: string[] = [];

    try {
        const appPath = app.getAppPath();
        paths.push(join(appPath, SCRIPT_NAME));
        paths.push(join(appPath, 'scripts', SCRIPT_NAME));
    } catch { /* */ }

    const projectRoot = resolve(__dirname, '..', '..');
    paths.push(join(projectRoot, SCRIPT_NAME));
    paths.push(join(projectRoot, 'scripts', SCRIPT_NAME));
    paths.push(join(process.cwd(), SCRIPT_NAME));

    // Sabit dev yolu
    paths.push('C:\\Users\\YASO\\Desktop\\voidra\\' + SCRIPT_NAME);

    return paths;
}

function loadScript(): string | null {
    if (cachedScript) return cachedScript;

    for (const scriptPath of getScriptPaths()) {
        if (existsSync(scriptPath)) {
            try {
                const content = readFileSync(scriptPath, 'utf-8');
                cachedScript = content;
                logger.info(`✅ Script yüklendi: ${scriptPath}`);
                logger.info(`   Boyut: ${(content.length / 1024).toFixed(1)} KB`);
                return cachedScript;
            } catch (err) {
                logger.error(`Script okuma hatası: ${scriptPath}`, err);
            }
        }
    }

    logger.error('❌ VFS script dosyası bulunamadı!');
    getScriptPaths().forEach((p: string) => logger.error(`   • ${p}`));
    return null;
}

// ═══════════════════════════════════════════════════════════════
// LOCAL HTTP SERVER — Script'i serve et
// Violentmonkey .user.js URL'ini algılar ve kurulum teklif eder
// ═══════════════════════════════════════════════════════════════

/**
 * Local HTTP server başlat — script'i serve et
 * URL: http://localhost:18923/vfs-turkey-netherlands-auto-book-pro.user.js
 */
export function startScriptServer(poolManager?: PoolManager): string | null {
    const script = loadScript();
    if (!script) return null;

    // Zaten çalışıyorsa
    if (httpServer) {
        return `http://localhost:${LOCAL_SERVER_PORT}/${SCRIPT_NAME}`;
    }

    try {
        httpServer = createServer(async (req, res) => {
            // CORS headers — script'ten gelen POST istekleri için
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            // CORS preflight
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // ★ LOG ENDPOINT — Script'ten gelen logları al
            if (req.url === '/log' && req.method === 'POST') {
                // ... (log logic aynı kalacak)
                let body = '';
                req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const scriptLogger = new Logger('VFS Bot');
                        // Log seviyesine göre yönlendir
                        const level = (data.level || 'info').toLowerCase();
                        const message = data.message || '';
                        const extra = data.data || undefined;
                        switch (level) {
                            case 'error': scriptLogger.error(message, extra); break;
                            case 'warn': case 'warning': scriptLogger.warn(message, extra); break;
                            case 'debug': scriptLogger.debug(message, extra); break;
                            default: scriptLogger.info(message, extra);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end('{"ok":true}');
                    } catch {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end('{"ok":false,"error":"invalid json"}');
                    }
                });
                return;
            }

            // ★ BATCH LOG
            if (req.url === '/logs' && req.method === 'POST') {
                // ... (batch log logic aynı kalacak)
                let body = '';
                req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const entries = JSON.parse(body);
                        if (Array.isArray(entries)) {
                            const scriptLogger = new Logger('VFS Bot');
                            for (const data of entries) {
                                const level = (data.level || 'info').toLowerCase();
                                const message = data.message || '';
                                const extra = data.data || undefined;
                                if (level === 'error') scriptLogger.error(message, extra);
                                else if (level === 'warn') scriptLogger.warn(message, extra);
                                else scriptLogger.info(message, extra);
                            }
                        }
                        const count = Array.isArray(entries) ? entries.length : 0;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(`{"ok":true,"count":${count}}`);
                    } catch {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end('{"ok":false,"error":"invalid json"}');
                    }
                });
                return;
            }

            // ★ CONFIG ENDPOINT — Script'e VOIDRA bağlantı bilgisi ve ayarlar
            if (req.url === '/api/config') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    connected: true,
                    version: '0.1.0',
                    logEndpoint: `http://localhost:${LOCAL_SERVER_PORT}/log`,
                    settings: {
                        vfs: config.vfs,
                        human: config.human,
                        stealth: config.stealth,
                        notification: config.notification
                    }
                }));
                return;
            }

            // ★ POOL ENDPOINT — Başvuru havuzunu döndür
            if (req.url === '/api/pool' && req.method === 'GET') {
                if (poolManager) {
                    try {
                        const applicants = await poolManager.list(); // Özet liste yetmeyebilir, detaylı lazım olabilir
                        // Ancak list() sadece özet dönüyor. Detaylı için id ile get() lazım.
                        // Script tüm listeyi istiyor gibi.
                        // Şimdilik list() kullanalım, script tarafında ID ile eşleşme yapılabilir.
                        // Veya PoolManager'a getAll() ekleyebiliriz ama şu anlık list() yeterli.
                        // Aslında script detaylara ihtiyaç duyacak (pasaport no vs.).
                        // PoolManager detayları private map'te tutuyor, public bir access methodu yok (toplu).
                        // O yüzden şimdilik sadece özet dönelim, script ID ile detay sorabilir.
                        // AMA: Script tarafında tek tek sormak yavaş olur.
                        // PoolManager.ts'de `exportToJSON()` var! Tüm detayları döndürür. Harika.

                        const allDataJson = await poolManager.exportToJSON();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(allDataJson);
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: String(err) }));
                    }
                } else {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PoolManager not initialized' }));
                }
                return;
            }

            if (req.url === '/' + SCRIPT_NAME || req.url === '/script.user.js') {
                // Script dosyasını serve et
                res.writeHead(200, {
                    'Content-Type': 'application/javascript; charset=utf-8',
                    'Content-Disposition': `inline; filename="${SCRIPT_NAME}"`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                });
                // Her seferinde dosyadan taze oku (development için)
                const freshScript = loadScript();
                res.end(freshScript || script);
            } else if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', script: SCRIPT_NAME }));
            } else {
                // Anasayfa — kurulum rehberi
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
<!DOCTYPE html>
<html>
<head><title>VOIDRA Script Server</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background: #0f0b1a; color: #e7e5ff; 
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: rgba(18,14,40,0.9); border: 1px solid rgba(176,123,255,0.3); 
          border-radius: 16px; padding: 32px; max-width: 500px; text-align: center; }
  h1 { background: linear-gradient(135deg, #b07bff, #7cf4ff); -webkit-background-clip: text; 
       -webkit-text-fill-color: transparent; font-size: 24px; }
  a { color: #b07bff; text-decoration: none; font-weight: bold; }
  a:hover { text-decoration: underline; }
  .btn { display: inline-block; background: linear-gradient(135deg, #b07bff, #7cf4ff); 
         color: #0c0a18; padding: 12px 24px; border-radius: 8px; font-weight: 700; 
         margin: 8px; text-decoration: none; }
  .btn:hover { opacity: 0.9; text-decoration: none; }
  code { background: rgba(176,123,255,0.15); padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
<div class="card">
  <h1>🚀 VOIDRA Script Server</h1>
  <p>VFS Bot Pro script hazır!</p>
  <a href="/${SCRIPT_NAME}" class="btn">📥 Script'i Yükle</a>
  <p style="margin-top:20px;font-size:13px;color:#8b87ad;">
    Violentmonkey kuruluysa yukarıdaki butona tıklamak<br>
    otomatik olarak kurulum sayfasını açacaktır.
  </p>
</div>
</body>
</html>`);
            }
        });

        httpServer.listen(LOCAL_SERVER_PORT, '127.0.0.1', () => {
            logger.info(`✅ Script server başlatıldı: http://localhost:${LOCAL_SERVER_PORT}`);
            logger.info(`   📥 Script URL: http://localhost:${LOCAL_SERVER_PORT}/${SCRIPT_NAME}`);
        });

        httpServer.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                logger.warn(`Port ${LOCAL_SERVER_PORT} zaten kullanımda — server zaten çalışıyor olabilir`);
            } else {
                logger.error('Script server hatası:', err);
            }
        });

        return `http://localhost:${LOCAL_SERVER_PORT}/${SCRIPT_NAME}`;

    } catch (err) {
        logger.error('Script server başlatılamadı:', err);
        return null;
    }
}

/**
 * Script server'ı kapat
 */
export function stopScriptServer(): void {
    if (httpServer) {
        httpServer.close();
        httpServer = null;
        logger.info('Script server kapatıldı');
    }
}

// ═══════════════════════════════════════════════════════════════
// VIOLENTMONKEY ENTEGRASYONu
// ═══════════════════════════════════════════════════════════════

/**
 * Script'i context'e enjekte et
 * 
 * Strateji:
 *   1. Önce Violentmonkey kurulu mu kontrol et
 *   2. Kuruluysa → local server URL'ini aç (script otomatik kurulur)
 *   3. Kurulu değilse → düz enjeksiyon yap (fallback)
 */
export async function injectScriptToContext(context: BrowserContext): Promise<void> {
    const script = loadScript();
    if (!script) {
        logger.warn('Script bulunamadı — enjeksiyon atlanıyor');
        return;
    }

    logger.info('═══════════════════════════════════════════');
    logger.info('★ VFS BOT PRO — SCRIPT ENJEKSİYONU');
    logger.info('═══════════════════════════════════════════');

    // Local HTTP server başlat
    const scriptUrl = startScriptServer();
    if (scriptUrl) {
        logger.info(`📡 Script server: ${scriptUrl}`);
    }

    // Mevcut sayfalara enjekte et (fallback — Violentmonkey yoksa da çalışsın)
    const pages = context.pages();
    let injected = 0;
    for (const page of pages) {
        const success = await injectToPage(page);
        if (success) injected++;
    }
    logger.info(`📄 ${injected}/${pages.length} mevcut sayfaya enjekte edildi`);

    // Yeni sayfalara otomatik enjekte et
    context.on('page', async (newPage) => {
        try {
            await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
            // DOM hazır olsun
            await new Promise(r => setTimeout(r, 2000));
            await injectToPage(newPage);
        } catch {
            // Sayfa kapanmış olabilir
        }
    });

    logger.info('✅ VFS Bot Pro enjeksiyon sistemi hazır');
    logger.info('   📡 Local server aktif — Violentmonkey ile de kullanılabilir');
    logger.info('   💉 CDP fallback aktif — Violentmonkey yoksa da çalışır');
}

/**
 * Violentmonkey script kurulum sayfasını aç
 * Bu, Violentmonkey'in .user.js dosyasını algılamasını sağlar
 */
export async function openScriptInstallPage(page: Page): Promise<void> {
    const scriptUrl = `http://localhost:${LOCAL_SERVER_PORT}/${SCRIPT_NAME}`;

    try {
        logger.info(`📥 Script kurulum sayfası açılıyor: ${scriptUrl}`);
        await page.goto(scriptUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        logger.info('✅ Script kurulum sayfası açıldı — Violentmonkey algılayacak');
    } catch (err) {
        logger.warn(`Script kurulum sayfası açılamadı: ${err}`);
    }
}

/**
 * Violentmonkey kurulum sayfasını aç
 */
export function getViolentmonkeyInstallUrl(channel: 'msedge' | 'chrome'): string {
    return channel === 'msedge' ? VIOLENTMONKEY_EDGE_URL : VIOLENTMONKEY_CHROME_URL;
}

// ═══════════════════════════════════════════════════════════════
// FALLBACK: CDP ile DOĞRUDAN ENJEKSİYON
// Violentmonkey kurulu değilse bu kullanılır
// ═══════════════════════════════════════════════════════════════

/**
 * Tek bir sayfaya script enjekte et (fallback)
 * 
 * ★ Güvenli enjeksiyon stratejisi:
 *   - Script içeriği page.evaluate() argümanı olarak geçirilir
 *   - Template literal'a gömülmez (backtick/${} çakışmasını önler)
 *   - <script> element oluşturulup DOM'a eklenir
 *   - CDP üzerinden eklenen script'ler CSP'yi bypass eder
 */
async function injectToPage(page: Page): Promise<boolean> {
    const script = loadScript();
    if (!script) return false;

    const url = page.url();

    // Sadece VFS sayfalarına enjekte et
    if (!url.includes('visa.vfsglobal.com') && !url.includes('vfsglobal.com')) {
        logger.debug(`Atlandı (VFS değil): ${url}`);
        return false;
    }

    try {
        // Violentmonkey zaten yüklemiş mi kontrol et
        const alreadyInjected = await page.evaluate(() => {
            return !!(window as any).__voidra_script_injected ||
                !!document.getElementById('vfs-sidebar-container');
        });

        if (alreadyInjected) {
            logger.info(`⏭️ Script zaten yüklü (Violentmonkey?): ${url.substring(0, 50)}...`);
            return true;
        }

        // Script içeriğini argüman olarak geçir
        await page.evaluate((scriptContent: string) => {
            if ((window as any).__voidra_script_injected) return;
            (window as any).__voidra_script_injected = true;

            const scriptEl = document.createElement('script');
            scriptEl.id = 'voidra-vfs-bot-pro';
            scriptEl.textContent = scriptContent;
            (document.head || document.documentElement).appendChild(scriptEl);
        }, script);

        logger.info(`✅ Script enjekte edildi (CDP fallback): ${url.substring(0, 50)}...`);
        return true;

    } catch (err) {
        logger.warn(`Script enjeksiyon hatası: ${err}`);
        return false;
    }
}

/**
 * Script cache'ini temizle
 */
export function clearScriptCache(): void {
    cachedScript = null;
    logger.info('Script cache temizlendi');
}
