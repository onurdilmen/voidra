/**
 * VOIDRA — VFS Login Tam Test v2
 * 
 * Test sonucu kanıtlandı:
 * ✅ launchPersistentContext + channel:msedge → Ana sayfa ÇALIŞIYOR
 * ❌ connectOverCDP → 403201 HATA
 * 
 * Şimdi login sayfasına kadar gidiyoruz.
 */

const { chromium } = require('playwright');
const { join } = require('path');
const { rmSync, existsSync, mkdirSync } = require('fs');

const VFS_BASE = 'https://visa.vfsglobal.com/tur/en/nld/';

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
    console.log(`\n${BOLD}${CYAN}═══ VFS LOGIN AKIŞ TESTİ v2 ═══${RESET}\n`);

    const userDataDir = join(__dirname, '..', 'data', '_test_profiles', 'test_login_v2');
    if (existsSync(userDataDir)) {
        try { rmSync(userDataDir, { recursive: true, force: true }); } catch { }
    }
    mkdirSync(userDataDir, { recursive: true });

    let context;
    try {
        log(CYAN, 'Edge başlatılıyor (channel: msedge)...');

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

        log(GREEN, '✅ Edge başlatıldı');

        const page = context.pages()[0] || await context.newPage();

        // ═════ ADIM 1: Ana Sayfa ═════
        log(CYAN, `ADIM 1: ${VFS_BASE}`);

        const response = await page.goto(VFS_BASE, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        log(YELLOW, `   HTTP Status: ${response?.status()}`);
        log(YELLOW, `   URL: ${page.url()}`);

        // NetworkIdle yerine timeout ile bekle
        await page.waitForTimeout(8000);

        const title1 = await page.title();
        const content1 = await page.content();

        if (content1.includes('403201')) {
            log(RED, `❌ ANA SAYFA 403201!`);
            await context.close();
            return;
        }

        if (title1.toLowerCase().includes('just a moment')) {
            log(YELLOW, '☁️ Cloudflare challenge — bekleniyor (max 60s)...');
            for (let i = 0; i < 30; i++) {
                await page.waitForTimeout(2000);
                const t = await page.title();
                if (!t.toLowerCase().includes('just a moment') &&
                    !t.toLowerCase().includes('checking')) {
                    log(GREEN, `☁️ Challenge geçildi: "${t}"`);
                    break;
                }
                if (i % 5 === 0) log(YELLOW, `   Bekleniyor... (${i * 2}s)`);
            }
        }

        log(GREEN, `✅ Ana sayfa: "${await page.title()}"`);

        // ═════ ADIM 2: Cookie Kontrolü ═════
        log(CYAN, 'ADIM 2: Cookie kontrolü...');
        const cookies = await context.cookies();
        const importantCookies = cookies.filter(c =>
            c.domain.includes('vfsglobal') || c.name.includes('cf_') || c.name.includes('__cf')
        );

        log(YELLOW, `   Toplam: ${cookies.length} | VFS/CF: ${importantCookies.length}`);
        for (const c of importantCookies) {
            log(YELLOW, `   🍪 ${c.name} (${c.domain}) = ${c.value.substring(0, 20)}...`);
        }

        // ═════ ADIM 3: navigator.webdriver ═════
        const wd = await page.evaluate(() => navigator.webdriver);
        log(wd ? RED : GREEN, `   navigator.webdriver = ${wd} ${wd ? '❌' : '✅'}`);

        // ═════ ADIM 4: İnsan davranışı ═════
        log(CYAN, 'ADIM 3: İnsan simülasyonu...');
        for (let i = 0; i < 3; i++) {
            await page.mouse.move(
                200 + Math.floor(Math.random() * 600),
                200 + Math.floor(Math.random() * 300),
                { steps: 8 }
            );
            await page.waitForTimeout(600);
        }
        await page.mouse.wheel(0, 250);
        await page.waitForTimeout(1500);
        log(GREEN, '   Tamamlandı');

        // ═════ ADIM 5: Login butonu ═════
        log(CYAN, 'ADIM 4: Login butonu aranıyor...');

        const loginSelectors = [
            'a:has-text("Log In")',
            'a:has-text("Login")',
            'a:has-text("Sign In")',
            'a[href*="/login"]',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
        ];

        let loginClicked = false;
        for (const sel of loginSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    const text = (await el.textContent())?.trim();
                    log(GREEN, `   Bulundu: "${text}" → ${sel}`);
                    await page.waitForTimeout(1000);
                    await el.click({ delay: 80 });
                    loginClicked = true;
                    break;
                }
            } catch { }
        }

        if (!loginClicked) {
            log(YELLOW, '   Buton bulunamadı — direkt /login URL...');
            await page.goto(VFS_BASE + 'login', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        }

        // Sayfa yüklenmesini bekle
        await page.waitForTimeout(8000);

        // ═════ ADIM 6: Login sayfası kontrol ═════
        log(CYAN, 'ADIM 5: Login sayfası kontrol...');

        const title2 = await page.title();
        const url2 = page.url();
        const content2 = await page.content();

        if (content2.includes('403201')) {
            log(RED, `\n${BOLD}❌❌❌ LOGIN SAYFASI 403201 HATA! ❌❌❌${RESET}`);
            log(RED, `   URL: ${url2}`);
            log(RED, `   Title: ${title2}`);

            // Detaylı cookie log
            const cookies2 = await context.cookies();
            const cfCookies2 = cookies2.filter(c =>
                c.name.includes('cf_') || c.name.includes('__cf') || c.name.includes('clearance')
            );
            log(YELLOW, `\n   Mevcut CF cookie'ler (${cfCookies2.length}):`);
            for (const c of cfCookies2) {
                log(YELLOW, `   🍪 ${c.name} = ${c.value.substring(0, 40)}...`);
            }

            // cf_clearance var mı?
            const hasClearance = cfCookies2.some(c => c.name === 'cf_clearance');
            const hasCfBm = cfCookies2.some(c => c.name === '__cf_bm');
            log(hasClearance ? GREEN : RED, `   cf_clearance: ${hasClearance ? 'VAR ✅' : 'YOK ❌'}`);
            log(hasCfBm ? GREEN : RED, `   __cf_bm: ${hasCfBm ? 'VAR ✅' : 'YOK ❌'}`);
        } else if (title2.toLowerCase().includes('just a moment')) {
            log(YELLOW, `☁️ Login sayfasında Cloudflare challenge`);
            log(YELLOW, '   Challenge gecmesini bekliyorum (30s)...');

            for (let i = 0; i < 15; i++) {
                await page.waitForTimeout(2000);
                const t = await page.title();
                const c = await page.content();

                if (c.includes('403201')) {
                    log(RED, `❌ Challenge sonrası 403201!`);
                    break;
                }

                if (!t.toLowerCase().includes('just a moment')) {
                    log(GREEN, `✅ Login challenge geçildi: "${t}"`);

                    // Form var mı?
                    const hasEmail = await page.locator('input[type="email"]').count() > 0;
                    const hasPass = await page.locator('input[type="password"]').count() > 0;
                    log(GREEN, `   📧 Email: ${hasEmail ? 'VAR ✅' : 'YOK'} | 🔑 Password: ${hasPass ? 'VAR ✅' : 'YOK'}`);
                    break;
                }
            }
        } else {
            log(GREEN, `\n${BOLD}✅✅✅ LOGIN SAYFASI BAŞARILI! ✅✅✅${RESET}`);
            log(GREEN, `   Title: "${title2}"`);
            log(GREEN, `   URL: ${url2}`);

            const hasEmail = await page.locator('input[type="email"]').count() > 0;
            const hasPass = await page.locator('input[type="password"]').count() > 0;
            log(GREEN, `   📧 Email: ${hasEmail ? 'VAR ✅' : 'YOK'} | 🔑 Password: ${hasPass ? 'VAR ✅' : 'YOK'}`);
        }

        // Tarayıcıyı 15 sn açık bırak
        log(YELLOW, '\nTarayıcı 15 saniye açık — kontrol edin...');
        await page.waitForTimeout(15000);

        await context.close();

    } catch (e) {
        log(RED, `HATA: ${e.message}`);
        console.error(e.stack);
        if (context) try { await context.close(); } catch { }
    }

    log(CYAN, 'Test tamamlandı.');
}

main().catch(console.error);
