/**
 * VOIDRA — VFS Login Test v3
 * 
 * BULGU: Ana sayfa ✅ çalışıyor ama direkt /login URL → 403201
 * TEORİ: Login sayfasına DOĞAL navigasyon (buton tıklama) gerekiyor
 * 
 * Bu test:
 * 1. Ana sayfayı aç
 * 2. Sayfadaki TÜM linkleri logla (debug)
 * 3. Login/Book linkini bul ve DOĞAL tıkla
 * 4. Sonucu kontrol et
 */

const { chromium } = require('playwright');
const { join } = require('path');
const { rmSync, existsSync, mkdirSync } = require('fs');

const VFS_BASE = 'https://visa.vfsglobal.com/tur/en/nld/';

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', X = '\x1b[0m', B = '\x1b[1m';
const log = (c, m) => console.log(`${c}[${new Date().toLocaleTimeString('tr-TR')}]${X} ${m}`);

async function main() {
    console.log(`\n${B}${C}=== VFS DOĞAL LOGIN NAVİGASYON TESTİ ===${X}\n`);

    const userDataDir = join(__dirname, '..', 'data', '_test_profiles', 'test_natural_login');
    if (existsSync(userDataDir)) {
        try { rmSync(userDataDir, { recursive: true, force: true }); } catch { }
    }
    mkdirSync(userDataDir, { recursive: true });

    let context;
    try {
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
        log(G, 'Edge baslatildi');

        // ═════ ADIM 1: Ana Sayfa ═════
        log(C, `Ana sayfa: ${VFS_BASE}`);
        await page.goto(VFS_BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(8000);

        // Cloudflare challenge bekle
        for (let i = 0; i < 15; i++) {
            const t = await page.title();
            if (!t.toLowerCase().includes('just a moment') && !t.toLowerCase().includes('checking')) break;
            log(Y, `   CF challenge bekleniyor (${i * 2}s)...`);
            await page.waitForTimeout(2000);
        }

        const title = await page.title();
        const content = await page.content();
        if (content.includes('403201')) {
            log(R, 'ANA SAYFA 403! IP flagli olabilir.');
            await context.close();
            return;
        }
        log(G, `Ana sayfa OK: "${title}"`);

        // Cookie kontrol
        const cookies = await context.cookies();
        const cf = cookies.filter(c => c.name === 'cf_clearance');
        log(cf.length > 0 ? G : R, `cf_clearance: ${cf.length > 0 ? 'VAR' : 'YOK'}`);

        // ═════ ADIM 2: Sayfadaki Tum Linkleri Logla ═════
        log(C, 'Sayfadaki login-ile ilgili linkler:');

        const links = await page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a'));
            return allLinks
                .filter(a => {
                    const href = a.href.toLowerCase();
                    const text = a.textContent.toLowerCase().trim();
                    return href.includes('login') || href.includes('signin') ||
                        href.includes('book') || href.includes('appointment') ||
                        text.includes('login') || text.includes('sign in') ||
                        text.includes('book') || text.includes('log in');
                })
                .map(a => ({
                    href: a.href,
                    text: a.textContent.trim().substring(0, 50),
                    visible: a.offsetParent !== null,
                    classes: a.className.substring(0, 50),
                    id: a.id,
                }));
        });

        if (links.length === 0) {
            log(R, '   Hic login linki bulunamadi!');

            // Tum linkleri listele
            const allLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .filter(a => a.offsetParent !== null) // sadece gorunur
                    .map(a => ({
                        href: a.href,
                        text: a.textContent.trim().substring(0, 60),
                    }))
                    .slice(0, 30);
            });

            log(Y, `   Gorunur linkler (${allLinks.length}):`);
            for (const l of allLinks) {
                log(Y, `     "${l.text}" → ${l.href}`);
            }
        } else {
            for (const l of links) {
                const vis = l.visible ? G + 'GORUNUR' : R + 'GIZLI';
                log(Y, `   "${l.text}" → ${l.href} [${vis}${X}]`);
            }
        }

        // ═════ ADIM 3: Login Linkine DOGAL Tiklama ═════
        log(C, 'Login linkine DOGAL tiklama deneniyor...');

        // Strateji: Evaluate ile linki bul, JS click yap (degil — doğal tıklama)
        // Playwright locator ile doğal tıklama daha iyi

        let clicked = false;

        // 1. Oncelik: "Book now" veya "Book an appointment" linkleri
        const bookSelectors = [
            'a[href*="/login"]',
            'a:has-text("Book")',
            'a:has-text("book")',
            'a:has-text("Login")',
            'a:has-text("Sign")',
        ];

        for (const sel of bookSelectors) {
            try {
                const els = page.locator(sel);
                const count = await els.count();

                for (let i = 0; i < count; i++) {
                    const el = els.nth(i);
                    const isVisible = await el.isVisible();

                    if (isVisible) {
                        const text = await el.textContent();
                        const href = await el.getAttribute('href');

                        log(G, `   TIKLANIYOR: "${text?.trim()}" (href: ${href})`);

                        // Insan gibi: once hover, sonra kisa bekleme, sonra tikla
                        await el.hover();
                        await page.waitForTimeout(500 + Math.floor(Math.random() * 500));

                        // Navigation promise olustur ONCE
                        const navigationPromise = page.waitForNavigation({
                            timeout: 30000,
                            waitUntil: 'domcontentloaded',
                        }).catch(() => null);

                        await el.click({ delay: 80 + Math.floor(Math.random() * 70) });

                        // Navigasyonu bekle
                        await navigationPromise;

                        clicked = true;
                        break;
                    }
                }

                if (clicked) break;
            } catch (e) {
                log(Y, `   ${sel} hatasi: ${e.message.substring(0, 80)}`);
            }
        }

        if (!clicked) {
            // Son care: JS ile link tikla
            log(Y, '   Playwright tiklama basarisiz — JS ile deneniyor...');
            const jsClicked = await page.evaluate(() => {
                const loginLink = document.querySelector('a[href*="/login"]');
                if (loginLink) {
                    loginLink.click();
                    return loginLink.href;
                }
                return null;
            });

            if (jsClicked) {
                log(Y, `   JS tiklama yapildi: ${jsClicked}`);
                await page.waitForTimeout(5000);
                clicked = true;
            } else {
                log(R, '   HIC login linki bulunamadi ve tiklanamiyor!');
            }
        }

        // ═════ ADIM 4: Sonuc Kontrolu ═════
        await page.waitForTimeout(5000);

        const url2 = page.url();
        const title2 = await page.title();
        const content2 = await page.content();

        log(C, `Sonuc:`);
        log(Y, `   URL: ${url2}`);
        log(Y, `   Title: ${title2}`);

        if (content2.includes('403201')) {
            log(R, `${B}BASARISIZ — 403201 HATA${X}`);

            // cf_clearance hala var mi?
            const cookies2 = await context.cookies();
            const cf2 = cookies2.filter(c => c.name === 'cf_clearance');
            log(cf2.length > 0 ? G : R, `   cf_clearance: ${cf2.length > 0 ? 'HALA VAR' : 'KAYBOLMUS!'}`);

            // Referrer header kontrolu
            log(Y, '   NOT: Direkt URL ile gitmek yerine buton tiklama yapildi');
            log(Y, '   Cloudflare Referrer header kontrolu yapiyor olabilir');
        } else if (title2.toLowerCase().includes('just a moment')) {
            log(Y, 'Cloudflare challenge sayfasinda — bekleniyor...');
            for (let i = 0; i < 15; i++) {
                await page.waitForTimeout(2000);
                const t = await page.title();
                const c = await page.content();
                if (c.includes('403201')) {
                    log(R, 'Challenge sonrasi 403201!');
                    break;
                }
                if (!t.toLowerCase().includes('just a moment')) {
                    log(G, `Challenge gecildi: "${t}"`);
                    break;
                }
            }
        } else {
            log(G, `${B}BASARILI! Login sayfasi acildi: "${title2}"${X}`);

            const hasInput = await page.locator('input').count();
            log(G, `   Input alanlari: ${hasInput}`);
        }

        // 20 sn acik birak
        log(Y, '\nTarayici 20 sn acik...');
        await page.waitForTimeout(20000);
        await context.close();

    } catch (e) {
        log(R, `HATA: ${e.message}`);
        if (context) try { await context.close(); } catch { }
    }

    log(C, 'Test tamamlandi.');
}

main().catch(console.error);
