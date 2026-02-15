/**
 * VOIDRA — VFS /login API vs HTML Test
 * 
 * BULGU:
 * - Ana sayfa ✅ (launchPersistentContext + msedge)
 * - /login → 403201 ❌ (buton tiklama dahil)
 * 
 * TEORI: /login bir SPA route - ilk yükleme ana sayfadan yapılmalı
 * ve sonra client-side routing ile login'e geçilmeli
 * 
 * TEST: Response headers ve redirect zincirini analiz et
 */

const { chromium } = require('playwright');
const { join } = require('path');
const { rmSync, existsSync, mkdirSync } = require('fs');

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', X = '\x1b[0m', B = '\x1b[1m';
const log = (c, m) => console.log(`${c}[${new Date().toLocaleTimeString('tr-TR')}]${X} ${m}`);

async function main() {
    console.log(`\n${B}${C}=== VFS /login DETAYLI ANALİZ ===${X}\n`);

    const userDataDir = join(__dirname, '..', 'data', '_test_profiles', 'test_login_analysis');
    if (existsSync(userDataDir)) try { rmSync(userDataDir, { recursive: true, force: true }); } catch { }
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

        // ═════ Network trafiğini dinle ═════
        log(C, 'Network istekleri dinleniyor...');

        const networkLog = [];

        page.on('request', req => {
            const url = req.url();
            if (url.includes('vfsglobal') || url.includes('cloudflare')) {
                networkLog.push({
                    type: 'REQ',
                    method: req.method(),
                    url: url.substring(0, 120),
                    headers: req.headers(),
                });
            }
        });

        page.on('response', async res => {
            const url = res.url();
            if (url.includes('vfsglobal.com/tur')) {
                const status = res.status();
                const headers = res.headers();

                networkLog.push({
                    type: 'RES',
                    status,
                    url: url.substring(0, 120),
                    contentType: headers['content-type'] || 'unknown',
                    cfRay: headers['cf-ray'] || 'none',
                });

                // 403 response detayı
                if (status === 403 || status >= 400) {
                    log(R, `   [${status}] ${url.substring(0, 100)}`);
                    try {
                        const body = await res.text();
                        if (body.includes('403201')) {
                            log(R, `   BODY: ${body.substring(0, 200)}`);
                        }
                    } catch { }
                }
            }
        });

        // ═════ ADIM 1: Ana Sayfa ═════
        log(C, 'ADIM 1: Ana sayfa...');
        await page.goto('https://visa.vfsglobal.com/tur/en/nld/', {
            waitUntil: 'domcontentloaded', timeout: 60000
        });
        await page.waitForTimeout(10000);

        // CF challenge bekle
        for (let i = 0; i < 15; i++) {
            const t = await page.title();
            if (!t.toLowerCase().includes('just a moment')) break;
            await page.waitForTimeout(2000);
        }

        log(G, `Ana sayfa: "${await page.title()}"`);

        // CF cookie kontrol
        const cookies1 = await context.cookies();
        const hasClearance = cookies1.some(c => c.name === 'cf_clearance');
        log(hasClearance ? G : R, `cf_clearance: ${hasClearance ? 'VAR' : 'YOK'}`);

        // ═════ ADIM 2: /login sayfasina DOĞRUDAN git ═════
        log(C, '\nADIM 2: /login sayfasina gidiliyor...');
        log(Y, '   Network istekleri izleniyor...');

        networkLog.length = 0; // reset

        const loginResponse = await page.goto('https://visa.vfsglobal.com/tur/en/nld/login', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        log(Y, `   Login response status: ${loginResponse?.status()}`);
        log(Y, `   Login URL (after redirect): ${page.url()}`);

        // 5 saniye bekle — ek istekler olabilir
        await page.waitForTimeout(5000);

        // Network log'u göster
        log(C, '\n   Network Log (son 15 istek):');
        const lastRequests = networkLog.slice(-15);
        for (const entry of lastRequests) {
            if (entry.type === 'REQ') {
                log(Y, `   → ${entry.method} ${entry.url}`);
            } else {
                const color = entry.status >= 400 ? R : entry.status >= 300 ? Y : G;
                log(color, `   ← [${entry.status}] ${entry.url} (${entry.contentType})`);
            }
        }

        // Sayfa içeriği
        const content = await page.content();
        if (content.includes('403201')) {
            log(R, `\n   ${B}SONUC: /login 403201 dondu${X}`);

            // Response headers detaylı
            if (loginResponse) {
                const headers = loginResponse.headers();
                log(Y, '\n   Response Headers:');
                for (const [key, val] of Object.entries(headers)) {
                    if (key.startsWith('cf-') || key === 'server' || key === 'content-type' ||
                        key === 'x-frame-options' || key === 'cache-control') {
                        log(Y, `     ${key}: ${val}`);
                    }
                }
            }
        } else {
            log(G, `   ${B}SONUC: Login sayfasi yuklendi!${X}`);
        }

        // ═════ ADIM 3: API endpoint kontrolu ═════
        log(C, '\nADIM 3: VFS API endpoint testi (XHR)...');

        // VFS API'sinin bir cagrisini yakalayalim
        const apiResult = await page.evaluate(async () => {
            try {
                const res = await fetch('https://visa.vfsglobal.com/tur/en/nld/login', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    },
                });
                const text = await res.text();
                return {
                    status: res.status,
                    contentType: res.headers.get('content-type'),
                    body: text.substring(0, 300),
                    has403: text.includes('403201'),
                };
            } catch (e) {
                return { error: e.message };
            }
        });

        log(Y, `   API sonucu: status=${apiResult.status}, type=${apiResult.contentType}`);
        if (apiResult.has403) {
            log(R, `   403201 HATA!`);
        }
        log(Y, `   Body snippet: ${apiResult.body?.substring(0, 150)}`);

        // 15 sn acik birak
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
