/**
 * VOIDRA — VFS Login Sayfası Test Scripti
 * 
 * Ana sayfa çalışıyor ✅ — şimdi login sayfasına ERİŞİM testi
 * Doğal navigasyon: ana sayfa → login butonu tıkla → login sayfası
 */

const { chromium } = require('playwright');
const { join } = require('path');
const { rmSync, existsSync, mkdirSync } = require('fs');

const VFS_BASE = 'https://visa.vfsglobal.com/tur/en/nld/';
const VFS_LOGIN = 'https://visa.vfsglobal.com/tur/en/nld/login';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(color, msg) {
    const time = new Date().toLocaleTimeString('tr-TR');
    console.log(`${color}[${time}]${RESET} ${msg}`);
}

async function main() {
    console.log(`\n${BOLD}${CYAN}════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${CYAN}  VFS LOGIN SAYAFSI TAM TEST${RESET}`);
    console.log(`${BOLD}${CYAN}════════════════════════════════════════${RESET}\n`);

    const userDataDir = join(__dirname, '..', 'data', '_test_profiles', 'test_login_flow');
    if (existsSync(userDataDir)) {
        try { rmSync(userDataDir, { recursive: true, force: true }); } catch { }
    }
    mkdirSync(userDataDir, { recursive: true });

    let context;
    try {
        log(CYAN, 'Edge başlatılıyor (channel: msedge, pipe transport)...');

        context = await chromium.launchPersistentContext(userDataDir, {
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

        const page = context.pages()[0] || await context.newPage();

        // ═════ ADIM 1: Ana Sayfaya Git ═════
        log(CYAN, `ADIM 1: Ana sayfaya gidiliyor → ${VFS_BASE}`);
        await page.goto(VFS_BASE, { waitUntil: 'networkidle', timeout: 45000 });

        const title1 = await page.title();
        const url1 = page.url();
        const content1 = await page.content();

        if (content1.includes('403201')) {
            log(RED, `❌ ANA SAYFA 403201 HATA! URL: ${url1}`);
            await context.close();
            return;
        }

        log(GREEN, `✅ Ana sayfa yüklendi: "${title1}"`);
        log(YELLOW, `   URL: ${url1}`);

        // Cloudflare challenge kontrol
        if (title1.toLowerCase().includes('just a moment')) {
            log(YELLOW, '☁️ Cloudflare challenge tespit edildi — 30 sn bekleniyor...');
            // Challenge geçmesini bekle
            for (let i = 0; i < 15; i++) {
                await page.waitForTimeout(2000);
                const t = await page.title();
                if (!t.toLowerCase().includes('just a moment')) {
                    log(GREEN, `☁️ Challenge geçildi: "${t}"`);
                    break;
                }
            }
        }

        // ═════ ADIM 2: Cookie'leri kontrol et ═════
        log(CYAN, 'ADIM 2: Cookie kontrolü...');
        const cookies = await context.cookies();
        const cfCookies = cookies.filter(c =>
            c.name.includes('cf_') || c.name.includes('__cf') || c.name.includes('clearance')
        );

        log(YELLOW, `   Toplam cookie: ${cookies.length}`);
        for (const c of cfCookies) {
            log(YELLOW, `   🍪 ${c.name} = ${c.value.substring(0, 30)}... (domain: ${c.domain})`);
        }

        if (cfCookies.length === 0) {
            log(RED, '   ⚠️ Cloudflare cookie YOK — challenge geçilememiş olabilir');
        }

        // ═════ ADIM 3: İnsan davranışı ═════
        log(CYAN, 'ADIM 3: İnsan davranışı simülasyonu...');

        // Mouse hareketleri
        for (let i = 0; i < 3; i++) {
            const x = 200 + Math.floor(Math.random() * 800);
            const y = 200 + Math.floor(Math.random() * 400);
            await page.mouse.move(x, y, { steps: 10 });
            await page.waitForTimeout(500 + Math.floor(Math.random() * 1000));
        }

        // Scroll
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(1000);
        await page.mouse.wheel(0, -150);
        await page.waitForTimeout(1000);

        log(GREEN, '   Mouse + scroll simülasyonu tamamlandı');

        // ═════ ADIM 4: Login butonunu bul ve tıkla ═════
        log(CYAN, 'ADIM 4: Login butonu aranıyor...');

        const loginSelectors = [
            'a:has-text("Login")',
            'a:has-text("Sign In")',
            'a:has-text("Sign in")',
            'a:has-text("Log In")',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'a[href*="login"]',
            'a[href*="Login"]',
        ];

        let loginClicked = false;
        for (const sel of loginSelectors) {
            try {
                const el = page.locator(sel).first();
                const visible = await el.isVisible({ timeout: 2000 });
                if (visible) {
                    const text = await el.textContent();
                    log(GREEN, `   Login butonu bulundu: "${text}" (${sel})`);

                    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
                    await el.click({ delay: 100 });

                    log(YELLOW, '   Tıklandı — sayfa yüklenmesi bekleniyor...');
                    await page.waitForLoadState('networkidle', { timeout: 30000 });
                    loginClicked = true;
                    break;
                }
            } catch { }
        }

        if (!loginClicked) {
            log(YELLOW, '   Login butonu bulunamadı — direkt URL deneniyor...');
            await page.goto(VFS_LOGIN, { waitUntil: 'networkidle', timeout: 30000 });
        }

        // ═════ ADIM 5: Login sayfası kontrolü ═════
        log(CYAN, 'ADIM 5: Login sayfası kontrol ediliyor...');

        await page.waitForTimeout(5000);

        const title2 = await page.title();
        const url2 = page.url();
        const content2 = await page.content();

        if (content2.includes('403201')) {
            log(RED, `❌ LOGIN SAYFASI 403201 HATA!`);
            log(RED, `   URL: ${url2}`);
            log(RED, `   Title: ${title2}`);

            // Cookie'leri tekrar kontrol et
            const cookies2 = await context.cookies();
            const cfCookies2 = cookies2.filter(c =>
                c.name.includes('cf_') || c.name.includes('__cf')
            );
            log(YELLOW, `   Cookie sayısı: ${cookies2.length}, CF cookies: ${cfCookies2.length}`);
            for (const c of cfCookies2) {
                log(YELLOW, `   🍪 ${c.name} = ${c.value.substring(0, 30)}...`);
            }
        } else if (title2.toLowerCase().includes('just a moment')) {
            log(YELLOW, `☁️ Login sayfasında Cloudflare challenge — kullanıcı müdahalesi gerekebilir`);
        } else {
            log(GREEN, `✅ LOGIN SAYFASI BAŞARILI!`);
            log(GREEN, `   Title: "${title2}"`);
            log(GREEN, `   URL: ${url2}`);

            // Login form var mı?
            const hasEmailInput = await page.locator('input[type="email"], input[name="email"], #email').count() > 0;
            const hasPasswordInput = await page.locator('input[type="password"], input[name="password"], #password').count() > 0;

            if (hasEmailInput || hasPasswordInput) {
                log(GREEN, `   📧 Email input: ${hasEmailInput ? 'VAR ✅' : 'YOK ❌'}`);
                log(GREEN, `   🔑 Password input: ${hasPasswordInput ? 'VAR ✅' : 'YOK ❌'}`);
            }
        }

        // navigator.webdriver kontrolü
        log(CYAN, 'BONUS: navigator.webdriver kontrolü...');
        const webdriverValue = await page.evaluate(() => navigator.webdriver);
        log(webdriverValue ? RED : GREEN,
            `   navigator.webdriver = ${webdriverValue} ${webdriverValue ? '❌ TESPİT EDİLEBİLİR!' : '✅ Güvenli'}`
        );

        // 10 saniye açık bırak — görsel kontrol
        log(YELLOW, '\nTarayıcı 10 saniye açık kalacak — kontrol edin...');
        await page.waitForTimeout(10000);

        await context.close();

    } catch (e) {
        log(RED, `HATA: ${e.message}`);
        if (context) {
            try { await context.close(); } catch { }
        }
    }

    log(CYAN, '\nTest tamamlandı.');
}

main().catch(console.error);
