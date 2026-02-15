/**
 * VOIDRA — Parmak İzi Üretici (Fingerprint Generator)
 * 
 * ★ Firefox Tabanlı — Cloudflare tespitine karşı optimize edilmiş
 * 
 * Firefox'un avantajları:
 * - CDP Runtime.enable leak riski YOK (Juggler protokolü)
 * - Chromium botlarının %95'i tespit edilirken Firefox botları nadir
 * - Farklı TLS fingerprint (JA3/JA4) → Cloudflare'ın Chromium DB'sinde yok
 * - Turnstile genellikle Firefox'ta otomatik geçiyor (kullanıcı raporları)
 * 
 * Her profil için tutarlı, gerçekçi tarayıcı parmak izleri üretir.
 * Tüm değerler birbiriyle tutarlı olmalı (CreepJS kontrolleri):
 * - IP lokasyonu ↔ timezone ↔ language
 * - User-Agent ↔ platform ↔ screen
 * - WebGL vendor ↔ renderer ↔ hardware
 */

import type { FingerprintConfig } from '@models/Profile';
import { Logger } from '@utils/Logger';

const logger = new Logger('FingerprintGen');

// ═══════════════════════════════════════════════════════════════
// Firefox User-Agent Veritabanı (Güncel 2025-2026 sürümleri)
// Format: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:XXX) Gecko/20100101 Firefox/XXX
// ═══════════════════════════════════════════════════════════════
const FIREFOX_USER_AGENTS = [
    // Firefox 133-135 (En güncel kararlı sürümler)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    // Firefox 131-132 (Biraz eski ama hala yaygın)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
];

// Gerçekçi ekran çözünürlükleri — pencereye sığacak boyutlar
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 },  // Full HD — en yaygın
    { width: 1366, height: 768 },   // HD — laptop
    { width: 1536, height: 864 },   // Yaygın laptop
    { width: 1440, height: 900 },   // MacBook tarzı
    { width: 1600, height: 900 },   // Yaygın
    { width: 1280, height: 720 },   // HD
];

// Dil ve zaman dilimi — Türkiye IP'si ile tutarlı olmalı
// ★ KRİTİK: Yabancı locale + Türk IP = Cloudflare'da tutarsızlık alarmı (CreepJS)
const LOCALE_CONFIGS = [
    { language: 'tr-TR', timezone: 'Europe/Istanbul' },
    { language: 'tr-TR', timezone: 'Europe/Istanbul' },
    { language: 'en-US', timezone: 'Europe/Istanbul' },  // EN dil ama TR timezone — gerçekçi
];

// ═══════════════════════════════════════════════════════════════
// WebGL Vendor/Renderer — Firefox formatında!
// ★ ÖNEMLİ: Firefox'ta vendor "Mozilla" olur, renderer formatı farklıdır
// Chrome'da: "Google Inc. (NVIDIA)" + "ANGLE (NVIDIA, ...)"
// Firefox'ta: "Mozilla" + doğrudan GPU adı
// ═══════════════════════════════════════════════════════════════
const FIREFOX_WEBGL_CONFIGS = [
    { vendor: 'Mozilla', renderer: 'NVIDIA GeForce GTX 1660 SUPER' },
    { vendor: 'Mozilla', renderer: 'NVIDIA GeForce RTX 3060' },
    { vendor: 'Mozilla', renderer: 'NVIDIA GeForce RTX 2070 SUPER' },
    { vendor: 'Mozilla', renderer: 'NVIDIA GeForce RTX 4060' },
    { vendor: 'Mozilla', renderer: 'AMD Radeon RX 580' },
    { vendor: 'Mozilla', renderer: 'AMD Radeon RX 6700 XT' },
    { vendor: 'Mozilla', renderer: 'Intel(R) UHD Graphics 630' },
    { vendor: 'Mozilla', renderer: 'Intel(R) Iris(R) Xe Graphics' },
    { vendor: 'Mozilla', renderer: 'Intel(R) UHD Graphics 770' },
];

// CPU çekirdek sayıları (gerçekçi değerler)
const HARDWARE_CONCURRENCY = [2, 4, 6, 8, 12, 16];

// Cihaz bellek değerleri (GB — navigator.deviceMemory)
// Not: Firefox'ta deviceMemory her zaman undefined döner (özellik yok)
// Ama fingerprint config'de tutuyoruz çünkü profil tutarlılığı için gerekli
const DEVICE_MEMORY = [4, 8, 8, 16, 16, 32];

/**
 * Diziden rastgele bir eleman seç
 */
function randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Yeni bir parmak izi oluştur
 * Tüm değerler birbiriyle tutarlı olmalı (CreepJS doğrulaması)
 */
export function generateFingerprint(): FingerprintConfig {
    const userAgent = randomPick(FIREFOX_USER_AGENTS);
    const screen = randomPick(SCREEN_RESOLUTIONS);
    const locale = randomPick(LOCALE_CONFIGS);
    const webgl = randomPick(FIREFOX_WEBGL_CONFIGS);
    const cores = randomPick(HARDWARE_CONCURRENCY);
    const memory = randomPick(DEVICE_MEMORY);

    // Platform her zaman Win32 (Windows odaklıyız)
    const platform = 'Win32';

    const fingerprint: FingerprintConfig = {
        userAgent,
        platform,
        language: locale.language,
        timezone: locale.timezone,
        screenResolution: screen,
        colorDepth: 24,  // Neredeyse her zaman 24
        hardwareConcurrency: cores,
        deviceMemory: memory,
        webglVendor: webgl.vendor,
        webglRenderer: webgl.renderer,
    };

    logger.debug('Firefox parmak izi oluşturuldu', {
        ua: userAgent.substring(0, 60) + '...',
        screen: `${screen.width}x${screen.height}`,
        locale: locale.language,
        cores,
        webgl: webgl.renderer.substring(0, 30),
    });

    return fingerprint;
}

/**
 * Türkiye lokali için parmak izi oluştur
 * VFS Global Türkiye sayfaları için optimize edilmiş
 */
export function generateTurkishFingerprint(): FingerprintConfig {
    const fp = generateFingerprint();
    fp.language = 'tr-TR';
    fp.timezone = 'Europe/Istanbul';
    return fp;
}
