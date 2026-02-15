/**
 * VOIDRA — CDP Tespit Test Scripti
 * 
 * Bu script farklı senaryolarda VFS'e erişimi test eder:
 * TEST 1: Temiz Edge + yeni profil (CDP YOK) → Boş profil sorunu mu?
 * TEST 2: Temiz Edge + yeni profil + CDP port → CDP port sorunu mu?
 * TEST 3: Playwright launchPersistentContext + channel:msedge → Playwright sorunu mu?
 * TEST 4: Playwright launchPersistentContext + ignoreAllDefaultArgs → Default args sorunu mu?
 */

const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const { existsSync, mkdirSync, rmSync } = require('fs');
const { join } = require('path');
const http = require('http');

const VFS_URL = 'https://visa.vfsglobal.com/tur/en/nld/';
const EDGE_EXE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TEST_BASE = join(__dirname, 'data', '_test_profiles');

// Renk kodları
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(color, prefix, msg) {
    const time = new Date().toLocaleTimeString('tr-TR');
    console.log(`${color}[${time}] [${prefix}]${RESET} ${msg}`);
}

// Test dizinini hazırla
function prepareTestDir(name) {
    const dir = join(TEST_BASE, name);
    if (existsSync(dir)) {
        try { rmSync(dir, { recursive: true, force: true }); } catch { }
    }
    mkdirSync(dir, { recursive: true });
    return dir;
}

// CDP port'unu kontrol et
async function checkCdpReady(port, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (res.ok) return true;
        } catch { }
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

// Sayfa içeriğini kontrol et — 403201 var mı?
async function checkPageFor403(page, waitMs = 15000) {
    await new Promise(r => setTimeout(r, waitMs));

    try {
        const url = page.url();
        const content = await page.content();
        const title = await page.title();

        const has403 = content.includes('403201');
        const hasCloudflare = title.toLowerCase().includes('just a moment') ||
            title.toLowerCase().includes('attention');
        const isVFS = content.includes('VFS') || content.includes('visa') ||
            content.includes('Global') || title.includes('VFS');

        return {
            url,
            title,
            has403,
            hasCloudflare,
            isVFS,
            contentLength: content.length,
            snippet: content.substring(0, 500).replace(/\s+/g, ' ').trim(),
        };
    } catch (e) {
        return { url: 'ERROR', title: 'ERROR', has403: true, hasCloudflare: false, isVFS: false, error: e.message };
    }
}

// ════════════════════════════════════════════════════════════════
// TEST 1: Sadece Edge + yeni profil, CDP YOK
// Amacı: Boş profil soruna neden oluyor mu?
// ════════════════════════════════════════════════════════════════
async function test1_EdgeNoCDP() {
    log(CYAN, 'TEST 1', '═══ Temiz Edge + Yeni Profil (CDP YOK) ═══');

    const userDataDir = prepareTestDir('test1_no_cdp');

    const proc = spawn(EDGE_EXE, [
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=msEdgeEnhancedTelemetry,msEdgeLaunchWizard',
        VFS_URL,
    ], { stdio: 'ignore', detached: false });

    log(YELLOW, 'TEST 1', 'Edge başlatıldı (CDP YOK) — 20 saniye bekleniyor...');
    log(YELLOW, 'TEST 1', '>>> LÜTFEN AÇILAN TARAYICIDA VFS SAYFASINI KONTROL EDİN <<<');
    log(YELLOW, 'TEST 1', '403201 görüyorsanız → Boş profil SORUN');
    log(YELLOW, 'TEST 1', 'VFS sayfası açılıyorsa → Boş profil SORUN DEĞİL');

    // 25 saniye bekle — kullanıcı kontrol etsin
    await new Promise(r => setTimeout(r, 25000));

    // Process'i kapat
    try { proc.kill('SIGTERM'); } catch { }
    await new Promise(r => setTimeout(r, 2000));
    try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }

    log(CYAN, 'TEST 1', 'Tamamlandı — Edge kapatıldı');
    return { testName: 'Edge + Yeni Profil (CDP YOK)', status: 'MANUAL_CHECK' };
}

// ════════════════════════════════════════════════════════════════
// TEST 2: Edge + yeni profil + CDP port 
// Amacı: CDP port açık olması soruna neden oluyor mu?
// ════════════════════════════════════════════════════════════════
async function test2_EdgeWithCDPPort() {
    log(CYAN, 'TEST 2', '═══ Edge + Yeni Profil + CDP Port 9333 ═══');

    const userDataDir = prepareTestDir('test2_cdp_port');

    const proc = spawn(EDGE_EXE, [
        `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=9333',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=msEdgeEnhancedTelemetry,msEdgeLaunchWizard',
        VFS_URL,
    ], { stdio: 'ignore', detached: false });

    log(YELLOW, 'TEST 2', 'Edge başlatıldı (CDP port: 9333) — CDP bağlantısı bekleniyor...');

    const cdpReady = await checkCdpReady(9333);
    if (cdpReady) {
        log(GREEN, 'TEST 2', 'CDP port hazır — Playwright ile BAĞLANMIYORUZ, sadece Edge kendi başına');
    } else {
        log(RED, 'TEST 2', 'CDP port hazır değil!');
    }

    log(YELLOW, 'TEST 2', '>>> TARAYICIDA VFS SAYFASINI KONTROL EDİN <<<');
    log(YELLOW, 'TEST 2', '403201 görüyorsanız → CDP port SORUN');

    await new Promise(r => setTimeout(r, 20000));

    try { proc.kill('SIGTERM'); } catch { }
    await new Promise(r => setTimeout(r, 2000));
    try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }

    log(CYAN, 'TEST 2', 'Tamamlandı');
    return { testName: 'Edge + CDP Port (Bağlanmadan)', status: 'MANUAL_CHECK' };
}

// ════════════════════════════════════════════════════════════════
// TEST 3: Playwright connectOverCDP — Bağlanıp sadece kontrol
// Amacı: Playwright bağlantısı soruna neden oluyor mu?
// ════════════════════════════════════════════════════════════════
async function test3_PlaywrightConnect() {
    log(CYAN, 'TEST 3', '═══ Playwright connectOverCDP — Bağlantı Testi ═══');

    const userDataDir = prepareTestDir('test3_pw_connect');

    const proc = spawn(EDGE_EXE, [
        `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=9444',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=msEdgeEnhancedTelemetry,msEdgeLaunchWizard',
        'about:blank',
    ], { stdio: 'ignore', detached: false });

    log(YELLOW, 'TEST 3', 'Edge başlatıldı — CDP bekleniyor...');

    const cdpReady = await checkCdpReady(9444);
    if (!cdpReady) {
        log(RED, 'TEST 3', 'CDP port hazır değil — ATLANDI');
        try { proc.kill(); } catch { }
        return { testName: 'Playwright connectOverCDP', status: 'SKIPPED' };
    }

    try {
        log(YELLOW, 'TEST 3', 'Playwright ile CDP bağlantısı kuruluyor...');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9444');
        const contexts = browser.contexts();
        const context = contexts[0];

        if (!context) {
            log(RED, 'TEST 3', 'Context bulunamadı!');
            await browser.close();
            try { proc.kill(); } catch { }
            return { testName: 'Connect', status: 'NO_CONTEXT' };
        }

        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        log(YELLOW, 'TEST 3', `VFS'e gidiliyor: ${VFS_URL}`);
        await page.goto(VFS_URL, { waitUntil: 'networkidle', timeout: 30000 });

        const result = await checkPageFor403(page, 10000);

        if (result.has403) {
            log(RED, 'TEST 3', `❌ 403201 HATA! URL: ${result.url}`);
            log(RED, 'TEST 3', `Snippet: ${result.snippet.substring(0, 200)}`);
        } else if (result.hasCloudflare) {
            log(YELLOW, 'TEST 3', `☁️ Cloudflare challenge sayfası — URL: ${result.url}`);
        } else {
            log(GREEN, 'TEST 3', `✅ BAŞARILI! Title: ${result.title}`);
        }

        await browser.close();

        await new Promise(r => setTimeout(r, 2000));
        try { proc.kill(); } catch { }
        try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }

        return { testName: 'Playwright connectOverCDP', ...result };

    } catch (e) {
        log(RED, 'TEST 3', `HATA: ${e.message}`);
        try { proc.kill(); } catch { }
        try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }
        return { testName: 'Playwright connectOverCDP', status: 'ERROR', error: e.message };
    }
}

// ════════════════════════════════════════════════════════════════
// TEST 4: Playwright launchPersistentContext + channel:msedge
// Amacı: Playwright'ın default argümanları soruna neden oluyor mu?
// ════════════════════════════════════════════════════════════════
async function test4_PlaywrightLaunch() {
    log(CYAN, 'TEST 4', '═══ Playwright launchPersistentContext + msedge ═══');

    const userDataDir = prepareTestDir('test4_pw_launch');

    try {
        log(YELLOW, 'TEST 4', 'launchPersistentContext başlatılıyor (channel: msedge)...');

        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'msedge',
            headless: false,
            viewport: null,
            ignoreDefaultArgs: [
                '--enable-automation',
                '--disable-extensions',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
            ],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
            ],
            locale: 'tr-TR',
            timezoneId: 'Europe/Istanbul',
        });

        log(GREEN, 'TEST 4', 'Edge başlatıldı (pipe transport)');

        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        log(YELLOW, 'TEST 4', `VFS'e gidiliyor: ${VFS_URL}`);
        await page.goto(VFS_URL, { waitUntil: 'networkidle', timeout: 30000 });

        const result = await checkPageFor403(page, 10000);

        if (result.has403) {
            log(RED, 'TEST 4', `❌ 403201 HATA!`);
            log(RED, 'TEST 4', `Snippet: ${result.snippet.substring(0, 200)}`);
        } else if (result.hasCloudflare) {
            log(YELLOW, 'TEST 4', `☁️ Cloudflare challenge`);
        } else {
            log(GREEN, 'TEST 4', `✅ BAŞARILI! Title: ${result.title}`);
        }

        await context.close();

        return { testName: 'Playwright launch + msedge', ...result };

    } catch (e) {
        log(RED, 'TEST 4', `HATA: ${e.message}`);
        try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }
        return { testName: 'Playwright launch + msedge', status: 'ERROR', error: e.message };
    }
}

// ════════════════════════════════════════════════════════════════
// TEST 5: Playwright + FULL ignoreDefaultArgs (hepsi kaldır)
// Amacı: Playwright'ın HİÇBİR default arg'ı olmadan çalışıyor mu?
// ════════════════════════════════════════════════════════════════
async function test5_PlaywrightMinimal() {
    log(CYAN, 'TEST 5', '═══ Playwright + ignoreAllDefaultArgs ═══');

    const userDataDir = prepareTestDir('test5_pw_minimal');

    try {
        log(YELLOW, 'TEST 5', 'launchPersistentContext — TÜM default args kaldırılıyor...');

        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'msedge',
            headless: false,
            viewport: null,
            // ★ TÜM default argümanları kaldır
            ignoreAllDefaultArgs: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
                // Pipe transport için gerekli — Playwright otomatik ekler
                // ama ignoreAllDefaultArgs ile kaldırıldı
            ],
            locale: 'tr-TR',
            timezoneId: 'Europe/Istanbul',
        });

        log(GREEN, 'TEST 5', 'Edge başlatıldı (minimal args)');

        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        log(YELLOW, 'TEST 5', `VFS'e gidiliyor: ${VFS_URL}`);
        await page.goto(VFS_URL, { waitUntil: 'networkidle', timeout: 30000 });

        const result = await checkPageFor403(page, 10000);

        if (result.has403) {
            log(RED, 'TEST 5', `❌ 403201 HATA!`);
        } else {
            log(GREEN, 'TEST 5', `✅ BAŞARILI! Title: ${result.title}`);
        }

        await context.close();

        return { testName: 'Playwright minimal args', ...result };

    } catch (e) {
        log(RED, 'TEST 5', `HATA: ${e.message}`);
        try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }
        return { testName: 'Playwright minimal args', status: 'ERROR', error: e.message };
    }
}

// ════════════════════════════════════════════════════════════════
// ANA TEST AKIŞI
// ════════════════════════════════════════════════════════════════
async function main() {
    console.log(`\n${BOLD}${CYAN}════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${CYAN}  VOIDRA CDP TESPİT TEST SÜİTİ${RESET}`);
    console.log(`${BOLD}${CYAN}  Her test farklı bir senaryoyu izole eder${RESET}`);
    console.log(`${BOLD}${CYAN}════════════════════════════════════════════════════════════${RESET}\n`);

    const results = [];

    // TEST 3: Playwright connectOverCDP (otomatik kontrol)
    try {
        const r3 = await test3_PlaywrightConnect();
        results.push(r3);
    } catch (e) {
        results.push({ testName: 'TEST 3', status: 'CRASH', error: e.message });
    }

    await new Promise(r => setTimeout(r, 3000));

    // TEST 4: Playwright launchPersistentContext (otomatik kontrol)
    try {
        const r4 = await test4_PlaywrightLaunch();
        results.push(r4);
    } catch (e) {
        results.push({ testName: 'TEST 4', status: 'CRASH', error: e.message });
    }

    await new Promise(r => setTimeout(r, 3000));

    // TEST 5: Playwright minimal (otomatik kontrol)
    try {
        const r5 = await test5_PlaywrightMinimal();
        results.push(r5);
    } catch (e) {
        results.push({ testName: 'TEST 5', status: 'CRASH', error: e.message });
    }

    // SONUÇLAR
    console.log(`\n${BOLD}${CYAN}════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${CYAN}  TEST SONUÇLARI${RESET}`);
    console.log(`${BOLD}${CYAN}════════════════════════════════════════════════════════════${RESET}\n`);

    for (const r of results) {
        const icon = r.has403 ? `${RED}❌` : r.status === 'ERROR' ? `${RED}⚠️` : `${GREEN}✅`;
        console.log(`${icon} ${r.testName}: ${r.has403 ? '403201 HATA' : r.status || r.title || 'OK'}${RESET}`);
        if (r.snippet) {
            console.log(`   Snippet: ${r.snippet.substring(0, 150)}`);
        }
        if (r.error) {
            console.log(`   Error: ${r.error}`);
        }
    }

    console.log('');

    // Tüm Edge'leri kapat
    try { execSync('taskkill /f /im msedge.exe 2>nul', { stdio: 'ignore' }); } catch { }
}

main().catch(e => {
    console.error('Test suite crashed:', e);
    process.exit(1);
});
