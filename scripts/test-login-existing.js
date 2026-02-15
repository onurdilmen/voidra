/**
 * VOIDRA — MEVCUT PROFİL ile login testi
 * 
 * Daha once olusturdugumuz profil dizinini (cookie + cf_clearance var)
 * yeniden kullanarak login deneyelim.
 * 
 * Teori: Ilk ziyarette profil "yeni" olarak flagleniyor.
 * Ikinci ziyarette mevcut cf_clearance cookiesi ile farkli sonuc alabilir.
 */

const { chromium } = require('playwright');
const { join } = require('path');
const { existsSync } = require('fs');

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', X = '\x1b[0m', B = '\x1b[1m';
const log = (c, m) => console.log(`${c}[${new Date().toLocaleTimeString('tr-TR')}]${X} ${m}`);

async function main() {
    console.log(`\n${B}${C}=== MEVCUT PROFİL ILE LOGIN TEST ===${X}\n`);

    // MEVCUT profili kullan (yenisini olusturma!)
    const userDataDir = join(__dirname, '..', 'data', '_test_profiles', 'test_login_analysis');

    if (!existsSync(userDataDir)) {
        log(R, 'Profil dizini bulunamadi! Once test-login-analysis.js calistirin.');
        return;
    }

    log(Y, `Mevcut profil kullaniliyor: ${userDataDir}`);

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
        log(G, 'Edge baslatildi (mevcut profil)');

        // Mevcut cookie'leri kontrol et
        const cookies = await context.cookies();
        const cfCookies = cookies.filter(c =>
            c.name === 'cf_clearance' || c.name === '__cf_bm'
        );
        log(Y, `Mevcut cookie sayisi: ${cookies.length}`);
        for (const c of cfCookies) {
            log(Y, `   ${c.name} (domain: ${c.domain}) = ${c.value.substring(0, 20)}...`);
        }

        // ═════ TEST A: Direkt /login ═════
        log(C, '\nTEST A: DIREKT /login (cookie ile)...');

        const res = await page.goto('https://visa.vfsglobal.com/tur/en/nld/login', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });

        await page.waitForTimeout(5000);

        const content = await page.content();
        if (content.includes('403201')) {
            log(R, `   ❌ DIREKT /login → 403201 (cookie olmasina ragmen)`);
        } else {
            log(G, `   ✅ DIREKT /login CALISTI! Title: "${await page.title()}"`);
        }

        // ═════ TEST B: Ana sayfa → Doğal geçiş ═════
        log(C, '\nTEST B: ANA SAYFA → DOGAL GECIS...');

        await page.goto('https://visa.vfsglobal.com/tur/en/nld/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        await page.waitForTimeout(8000);

        const title = await page.title();
        if (title.toLowerCase().includes('just a moment')) {
            log(Y, '   CF challenge bekleniyor...');
            for (let i = 0; i < 15; i++) {
                await page.waitForTimeout(2000);
                const t = await page.title();
                if (!t.toLowerCase().includes('just a moment')) {
                    log(G, `   Challenge gecildi: "${t}"`);
                    break;
                }
            }
        }

        log(G, `   Ana sayfa: "${await page.title()}"`);

        // Yeni cookie'leri kontrol
        const cookies2 = await context.cookies();
        const cf2 = cookies2.filter(c => c.name === 'cf_clearance');
        log(cf2.length > 0 ? G : R, `   cf_clearance: ${cf2.length > 0 ? 'VAR' : 'YOK'}`);

        // Simdi /login'e git (ana sayfayla ayni session'da)
        log(C, '\n   /login icin link tiklama...');

        // JS ile link tikla (en guvenilir)
        const loginUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href*="/login"]');
            if (link) {
                // Simdi tiklamiyoruz, sadece URL'yi donduruyoruz
                return link.href;
            }
            return null;
        });

        if (loginUrl) {
            log(Y, `   Login URL bulundu: ${loginUrl}`);

            // Navigation event ile tikla
            await page.evaluate(() => {
                const link = document.querySelector('a[href*="/login"]');
                if (link) link.click();
            });

            await page.waitForTimeout(8000);

            const content2 = await page.content();
            if (content2.includes('403201')) {
                log(R, `   ❌ BUTON TIKLAMA → /login 403201`);

                // SON DENEME: window.location ile
                log(C, '\n   SON DENEME: window.location degisikligi...');
                await page.goto('https://visa.vfsglobal.com/tur/en/nld/', {
                    waitUntil: 'domcontentloaded', timeout: 30000,
                });
                await page.waitForTimeout(5000);

                await page.evaluate(() => {
                    window.location.href = '/tur/en/nld/login';
                });
                await page.waitForTimeout(8000);

                const content3 = await page.content();
                if (content3.includes('403201')) {
                    log(R, `   ❌ window.location → HAT 403201`);
                    log(R, '\n   SONUC: /login endpointi BUTUN yontemlerle 403201 veriyor!');
                    log(R, '   Bu IP bu endpoint icin FLAGLENMIS olabilir.');
                    log(Y, '   ONERILER:');
                    log(Y, '     1. Modem restart (yeni IP adresi)');
                    log(Y, '     2. Mobil hotspot kullan');
                    log(Y, '     3. 2 saat bekleyip tekrar dene');
                } else {
                    log(G, `   ✅ window.location CALISTI!`);
                }
            } else {
                log(G, `   ✅ BUTON TIKLAMA CALISTI!`);
                log(G, `   Title: "${await page.title()}"`);
            }
        }

        log(Y, '\nTarayici 15 sn acik...');
        await page.waitForTimeout(15000);
        await context.close();

    } catch (e) {
        log(R, `HATA: ${e.message}`);
        if (context) try { await context.close(); } catch { }
    }
    log(C, 'Test tamamlandi.');
}

main().catch(console.error);
