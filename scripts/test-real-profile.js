/**
 * VOIDRA — Kullanıcının GERÇEK Edge Profili ile Login Testi
 * 
 * BULGU: Yeni profille ana sayfa calisiyor ama /login 403201.
 * Normal tarayicida /login calisiyor.
 * 
 * FARK: Normal tarayici kullanicinin GERCEK profilini kullaniyor.
 * Bu profilde:
 * - Onceki VFS ziyaretlerinin cookie'leri var
 * - Onceki cf_clearance'lar var
 * - Tarayici gecmisi var
 * - Extensions var
 * 
 * TEST: Kullanicinin gercek Edge profilinin bir KOPYASINI kullanarak
 * login endpointine erisebilir miyiz?
 * 
 * NOT: Bu test Edge'in default profilini readonly kullanir (kopya)
 */

const { chromium } = require('playwright');
const { join } = require('path');
const { cpSync, existsSync, mkdirSync, rmSync } = require('fs');

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m', X = '\x1b[0m', B = '\x1b[1m';
const log = (c, m) => console.log(`${c}[${new Date().toLocaleTimeString('tr-TR')}]${X} ${m}`);

async function main() {
    console.log(`\n${B}${C}=== GERCEK EDGE PROFİLİ ILE LOGIN TEST ===${X}\n`);

    // Kullanicinin Edge profil dizini
    const edgeProfileSrc = join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data');

    if (!existsSync(edgeProfileSrc)) {
        log(R, `Edge profil dizini bulunamadi: ${edgeProfileSrc}`);
        return;
    }

    log(Y, `Edge profil kaynak: ${edgeProfileSrc}`);

    // Profil kopyasi olustur (sadece kritik dosyalar)
    const profileCopy = join(__dirname, '..', 'data', '_test_profiles', 'test_real_profile');
    if (existsSync(profileCopy)) {
        try { rmSync(profileCopy, { recursive: true, force: true }); } catch { }
    }
    mkdirSync(profileCopy, { recursive: true });

    // Kritik dosyalari kopyala
    log(Y, 'Profil dosyalari kopyalaniyor...');

    const filesToCopy = [
        'Local State',
    ];

    const dirsToCopy = [
        'Default',
    ];

    for (const file of filesToCopy) {
        const src = join(edgeProfileSrc, file);
        const dst = join(profileCopy, file);
        if (existsSync(src)) {
            try {
                cpSync(src, dst);
                log(G, `   Kopyalandi: ${file}`);
            } catch (e) {
                log(Y, `   Atlanildi: ${file} (${e.message.substring(0, 50)})`);
            }
        }
    }

    // Default klasorunun alt dosyalarini kopyala (buyuk dosyalari atla)
    const defaultSrc = join(edgeProfileSrc, 'Default');
    const defaultDst = join(profileCopy, 'Default');
    mkdirSync(defaultDst, { recursive: true });

    const importantFiles = [
        'Cookies',
        'Preferences',
        'Secure Preferences',
        'Login Data',
        'Web Data',
        'History',
        'Favicons',
    ];

    for (const file of importantFiles) {
        const src = join(defaultSrc, file);
        const dst = join(defaultDst, file);
        if (existsSync(src)) {
            try {
                cpSync(src, dst);
                log(G, `   Kopyalandi: Default/${file}`);
            } catch (e) {
                log(Y, `   Atlanildi: Default/${file} (${e.message.substring(0, 50)})`);
            }
        }
    }

    log(G, 'Profil kopyalama tamamlandi');

    let context;
    try {
        log(C, '\nEdge baslatiliyor (kopyalanmis profil)...');

        context = await chromium.launchPersistentContext(profileCopy, {
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
        log(G, 'Edge baslatildi (gercek profil kopyasi)');

        // Cookie kontrol
        const cookies = await context.cookies('https://visa.vfsglobal.com');
        log(Y, `VFS cookie sayisi: ${cookies.length}`);
        for (const c of cookies) {
            log(Y, `   ${c.name} = ${c.value.substring(0, 20)}...`);
        }

        // Direkt /login dene
        log(C, '\nDIREKT /login deneniyor...');

        const res = await page.goto('https://visa.vfsglobal.com/tur/en/nld/login', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });

        await page.waitForTimeout(8000);

        const content = await page.content();
        const title = await page.title();

        if (content.includes('403201')) {
            log(R, `❌ 403201 HATA (gercek profil kopyasi ile bile)`);
            log(Y, '\n   SONUC: Sorun profilin kendisinde degil.');
            log(Y, '   Cloudflare, Playwright/CDP kontrollu Edge ile');
            log(Y, '   /login endpoint icin farkli kurallara sahip.');
            log(Y, '   Bu endpoint icin ek dogrulama yapiyor olabilir.');
            log(Y, '\n   ALTERNATIF YAKLASIMLAR:');
            log(Y, '   1. Tarayici uzantisi (extension) ile otomasyon');
            log(Y, '   2. Non-CDP yaklaşim (AutoHotkey/PyAutoGUI)');
            log(Y, '   3. Kullanicinin kendi tarayicisinda extension yukle');
        } else if (title.toLowerCase().includes('just a moment')) {
            log(Y, `☁️ Cloudflare challenge — bekleniyor...`);
            for (let i = 0; i < 15; i++) {
                await page.waitForTimeout(2000);
                const t = await page.title();
                const c = await page.content();
                if (c.includes('403201')) {
                    log(R, 'Challenge sonrasi 403201!');
                    break;
                }
                if (!t.toLowerCase().includes('just a moment')) {
                    log(G, `✅ Login acildi: "${t}"`);
                    break;
                }
            }
        } else {
            log(G, `${B}✅ LOGIN CALISTI! (gercek profil kopyasi ile)${X}`);
            log(G, `   Title: "${title}"`);
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
