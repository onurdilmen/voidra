/**
 * VOIDRA — Stealth Engine v2 (Gizlilik Motoru)
 * 
 * ★ "SIFIR OVERRIDE" Stratejisi
 * 
 * Önceki hata: WebGL vendor, platform, hardwareConcurrency, deviceMemory, 
 * screen colorDepth gibi değerleri override etmek Cloudflare tarafından
 * tutarsızlık olarak tespit ediliyordu.
 * 
 * Yeni strateji: SADECE otomasyon izlerini temizle, fingerprint'e dokunma.
 * 
 * Temizlenen izler:
 * ✅ navigator.webdriver — Playwright bunu true yapar
 * ✅ Selenium/Puppeteer global değişkenleri
 * ✅ document.hidden/visibilityState — her zaman görünür
 * 
 * DOKUNULMAYAN:
 * ❌ WebGL vendor/renderer — tarayıcının doğal değeri kalsın
 * ❌ navigator.platform — tarayıcının doğal değeri kalsın
 * ❌ navigator.hardwareConcurrency — tarayıcının doğal değeri kalsın
 * ❌ navigator.deviceMemory — Firefox'ta zaten yok
 * ❌ screen.colorDepth — tarayıcının doğal değeri kalsın
 * ❌ navigator.languages — locale ayarıyla otomatik gelir
 * ❌ window.chrome — Firefox'ta zaten yok
 */

import type { FingerprintConfig } from '@models/Profile';
import { Logger } from '@utils/Logger';

const logger = new Logger('StealthEngine');

/**
 * Minimal stealth script — SADECE otomasyon izlerini temizle
 * Fingerprint değerlerine DOKUNMA — tutarsızlık yaratır!
 */
export function buildStealthScript(_fp: FingerprintConfig): string {
    // fp parametresini kullanmıyoruz — SIFIR OVERRIDE stratejisi
    return `
    (() => {
        'use strict';

        // ══════════════════════════════════════════════════════════════
        // 1. navigator.webdriver — EN KRİTİK
        // Playwright bu değeri true yapar, biz undefined yapıyoruz
        // Gerçek Firefox'ta bu property tanımsızdır
        // ══════════════════════════════════════════════════════════════
        
        try {
            delete Object.getPrototypeOf(navigator).webdriver;
        } catch(e) {}

        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true,
        });

        const origNavigatorProto = Object.getPrototypeOf(navigator);
        if (origNavigatorProto) {
            try {
                Object.defineProperty(origNavigatorProto, 'webdriver', {
                    get: () => undefined,
                    configurable: true,
                });
            } catch(e) {}
        }

        // ══════════════════════════════════════════════════════════════
        // 2. Otomasyon Değişkenlerini Temizle
        // Selenium, Puppeteer, Nightmare vb. bıraktığı izler
        // ══════════════════════════════════════════════════════════════
        
        const automationKeys = Object.keys(window).filter(key => 
            key.startsWith('__webdriver') ||
            key.startsWith('__fxdriver') ||
            key.startsWith('__selenium') ||
            key.startsWith('__driver') ||
            key.startsWith('_Selenium') ||
            key.startsWith('_selenium') ||
            key === 'calledSelenium' ||
            key === '__nightmare' ||
            key === '__phantomas' ||
            key === '__lastWatirAlert' ||
            key === '__lastWatirConfirm' ||
            key === '__lastWatirPrompt' ||
            key === '__webdriver_script_fn'
        );
        
        automationKeys.forEach(key => {
            try { delete window[key]; } catch(e) {}
        });

        // ══════════════════════════════════════════════════════════════
        // 3. document visibility — Sayfa her zaman görünür
        // Arka planda çalışan tarayıcılar şüpheli
        // ══════════════════════════════════════════════════════════════
        
        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true,
        });
        
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true,
        });

        // ══════════════════════════════════════════════════════════════
        // 4. iframe contentWindow — webdriver leak önleme
        // ══════════════════════════════════════════════════════════════
        
        try {
            const iframeProto = HTMLIFrameElement.prototype;
            const origContentWindow = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
            if (origContentWindow && origContentWindow.get) {
                Object.defineProperty(iframeProto, 'contentWindow', {
                    get: function() {
                        const win = origContentWindow.get.call(this);
                        if (win) {
                            try {
                                Object.defineProperty(win.navigator, 'webdriver', {
                                    get: () => undefined,
                                    configurable: true,
                                });
                            } catch(e) {}
                        }
                        return win;
                    },
                    configurable: true,
                });
            }
        } catch(e) {}

        // ══════════════════════════════════════════════════════════════
        // YAPILMAYAN (KASITLI):
        // ❌ WebGL override — tutarsızlık yaratır
        // ❌ navigator.platform override — tutarsızlık yaratır
        // ❌ navigator.hardwareConcurrency override — tutarsızlık yaratır
        // ❌ navigator.deviceMemory override — Firefox'ta zaten yok
        // ❌ screen override — viewport ile tutarsızlık yaratır
        // ❌ navigator.languages override — locale ayarıyla gelir
        // ❌ window.chrome mock — Firefox'ta zaten yok
        // ❌ Permissions API override — tutarsızlık yaratır
        // ❌ Notification.permission override — tutarsızlık yaratır
        // ❌ Connection API override — tutarsızlık yaratır
        // ══════════════════════════════════════════════════════════════

    })();
    `;
}

/**
 * Stealth script'ini BrowserContext'e uygula
 */
export async function applyStealthScripts(
    context: import('playwright').BrowserContext,
    fp: FingerprintConfig
): Promise<void> {
    const script = buildStealthScript(fp);
    await context.addInitScript(script);
    logger.info('Minimal stealth uygulandı ✓ (SIFIR fingerprint override — sadece webdriver temizleme)');
}

/**
 * İnsan benzeri gecikme üret (milisaniye)
 * Normal dağılıma yakın rastgele değerler
 */
export function humanDelay(minMs: number = 500, maxMs: number = 2000): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const mean = (minMs + maxMs) / 2;
    const stddev = (maxMs - minMs) / 4;
    const delay = Math.round(mean + normal * stddev);

    return Math.max(minMs, Math.min(maxMs, delay));
}

/**
 * İnsan benzeri typing hızı (karakter başına ms)
 */
export function humanTypingDelay(): number {
    return humanDelay(30, 150);
}
