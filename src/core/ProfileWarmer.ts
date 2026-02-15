/**
 * VOIDRA — Profil Isındırıcı (Profile Warmer)
 * 
 * ★ BOŞ PROFIL = BOT TESPİTİ
 * 
 * Cloudflare sıfır geçmişli profilleri tespit eder:
 * - Hiç cookie yok → şüpheli
 * - Hiç geçmiş yok → şüpheli
 * - Hiç local storage yok → şüpheli
 * - Hiç extension yok → şüpheli
 * 
 * Bu modül, kullanıcının gerçek Edge/Chrome profilinden
 * kritik dosyaları kopyalayarak "ısınmış" bir profil oluşturur.
 * 
 * KOPYALANAN VERİLER:
 * - History (tarayıcı geçmişi)
 * - Cookies (mevcut çerezler — VFS hariç, genel site cookie'leri)
 * - Web Data (form verileri, otomatik tamamlama)
 * - Local State (tarayıcı yerel durumu)
 * - Bookmarks (yer imleri)
 * - Preferences (bazı ayarlar)
 * - Extension Cookies / Extension State
 * 
 * KOPYALANMAYAN VERİLER (güvenlik):
 * - Login Data (şifreler) → KESINLIKLE KOPYALANMAZ
 * - Login Data For Account
 * - DIPS (bounce tracking)
 * 
 * NOT: Bu, kullanıcının KENDİ bilgisayarında KENDİ profilinden
 * yapılan bir kopyalamadır — gizlilik ihlali yoktur.
 */

import { copyFile, readdir, mkdir, access, stat, readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { Logger } from '@utils/Logger';

const logger = new Logger('ProfileWarmer');

// Kopyalanacak dosyalar — CORE (cookie HARİÇ)
const FILES_TO_COPY_CORE = [
    'History',              // Tarayıcı geçmişi
    'History-journal',      // Geçmiş journal
    'Web Data',             // Form verileri, otomatik tamamlama
    'Web Data-journal',     // Web Data journal
    'Bookmarks',            // Yer imleri
    'Favicons',             // Site ikonları
    'Favicons-journal',     // Favicons journal
    'Top Sites',            // En çok ziyaret edilen siteler
    'Top Sites-journal',
    'Visited Links',        // Ziyaret edilen linkler hash'leri
    'Network Action Predictor', // DNS prefetch verileri
    'Shortcuts',            // Kısayollar
    'Shortcuts-journal',
    'Preferences',          // Tarayıcı tercihleri
];

// Cookie dosyaları — ayrı tutulur, isteğe bağlı kopyalanır
// ★ Eski VFS session cookie'leri "Session Expired" hatasına neden olur!
const FILES_COOKIES = [
    'Cookies',              // Çerezler (SQLite DB)
    'Cookies-journal',      // Çerez journal
];

// Root seviyede kopyalanacak dosyalar (User Data klasöründen)
const ROOT_FILES_TO_COPY = [
    'Local State',          // Tarayıcı durumu (OS bilgileri, feature flags)
];

// Kopyalanacak ALT DİZİNLER
const DIRS_TO_COPY = [
    'Extension Cookies',    // Extension çerezleri
    'Extension State',      // Extension durumları
    'Extensions',           // Extension dosyaları
    'Local Extension Settings', // Extension localStorage
];

// ★ KESİNLİKLE KOPYALANMAYACAK DOSYALAR (güvenlik)
const FILES_NEVER_COPY = [
    'Login Data',           // Şifreler — ASLA kopyalanmaz!
    'Login Data-journal',
    'Login Data For Account',
    'Login Data For Account-journal',
    'DIPS',                 // Bounce tracking
    'DIPS-journal',
    'Token Binding',        // Token bağlama
    'TransportSecurity',    // HSTS verisi — site-spesifik
];

/**
 * Varsayılan Edge/Chrome profil dizinini bul
 */
function getSystemProfilePath(channel: 'msedge' | 'chrome'): string | null {
    const localAppData = process.env.LOCALAPPDATA || '';

    const paths = {
        msedge: join(localAppData, 'Microsoft', 'Edge', 'User Data'),
        chrome: join(localAppData, 'Google', 'Chrome', 'User Data'),
    };

    const userDataPath = paths[channel];
    if (!userDataPath || !existsSync(userDataPath)) {
        return null;
    }

    // Default profil
    const defaultProfile = join(userDataPath, 'Default');
    if (existsSync(defaultProfile)) {
        return defaultProfile;
    }

    // Profile 1 (eğer Default yoksa)
    const profile1 = join(userDataPath, 'Profile 1');
    if (existsSync(profile1)) {
        return profile1;
    }

    return null;
}

/**
 * Sistem profilinin User Data root dizinini al
 */
function getSystemUserDataRoot(channel: 'msedge' | 'chrome'): string | null {
    const localAppData = process.env.LOCALAPPDATA || '';

    const paths = {
        msedge: join(localAppData, 'Microsoft', 'Edge', 'User Data'),
        chrome: join(localAppData, 'Google', 'Chrome', 'User Data'),
    };

    const userDataPath = paths[channel];
    if (!userDataPath || !existsSync(userDataPath)) {
        return null;
    }

    return userDataPath;
}

/**
 * Tek bir dosyayı güvenli şekilde kopyala
 */
async function safeCopyFile(src: string, dest: string): Promise<boolean> {
    try {
        await access(src);
        const srcStat = await stat(src);

        // 500MB'dan büyük dosyaları kopyalama (örn: büyük veritabanları)
        if (srcStat.size > 500 * 1024 * 1024) {
            logger.debug(`Dosya çok büyük, atlanıyor: ${basename(src)} (${Math.round(srcStat.size / 1024 / 1024)}MB)`);
            return false;
        }

        await copyFile(src, dest);
        return true;
    } catch {
        // Dosya bulunamadı veya erişim hatası — normal, sessizce geç
        return false;
    }
}

/**
 * Dizin içindeki dosyaları özyinelemeli kopyala (sığ kopyalama)
 */
async function safeCopyDir(src: string, dest: string, depth: number = 0): Promise<number> {
    if (depth > 3) return 0; // Çok derin dizinlere girme

    try {
        await access(src);
        mkdirSync(dest, { recursive: true });

        const entries = await readdir(src, { withFileTypes: true });
        let copied = 0;

        for (const entry of entries) {
            const srcPath = join(src, entry.name);
            const destPath = join(dest, entry.name);

            if (entry.isFile()) {
                if (await safeCopyFile(srcPath, destPath)) {
                    copied++;
                }
            } else if (entry.isDirectory() && depth < 3) {
                copied += await safeCopyDir(srcPath, destPath, depth + 1);
            }
        }

        return copied;
    } catch {
        return 0;
    }
}

/**
 * ★ ANA FONKSİYON: Profili ısındır (warm up)
 * 
 * Kullanıcının gerçek tarayıcı profilinden kritik dosyaları
 * VOIDRA profil dizinine kopyalar.
 * 
 * @param targetUserDataDir - Hedef profil dizini (VOIDRA'nın oluşturduğu)
 * @param channel - Kaynak tarayıcı kanalı ('msedge' veya 'chrome')
 * @param excludeCookies - true ise cookie dosyaları kopyalanmaz (varsayılan: true)
 *                         Eski VFS session cookie'leri "Session Expired" hatasına neden olur!
 * @returns Kopyalanan dosya sayısı (0 = ısındırma yapılamadı)
 */
export async function warmUpProfile(
    targetUserDataDir: string,
    channel: 'msedge' | 'chrome',
    excludeCookies: boolean = true,
): Promise<number> {
    logger.info('🔥 Profil ısındırma başlatılıyor...');
    if (excludeCookies) {
        logger.info('   🍪 Cookie\'ler KOPYALANMAYACAK (taze session için)');
    }

    // Kaynak profil dizinini bul
    const sourceProfilePath = getSystemProfilePath(channel);
    if (!sourceProfilePath) {
        logger.warn(`Sistem ${channel} profili bulunamadı — ısındırma atlanıyor`);
        logger.warn('İpucu: Tarayıcıyı en az bir kez açıp kullanın');
        return 0;
    }

    const sourceUserDataRoot = getSystemUserDataRoot(channel);

    logger.info(`Kaynak profil: ${sourceProfilePath}`);
    logger.info(`Hedef dizin: ${targetUserDataDir}`);

    // Hedef dizin yapısını oluştur
    const targetProfileDir = join(targetUserDataDir, 'Default');
    mkdirSync(targetProfileDir, { recursive: true });

    let totalCopied = 0;

    // 1. Core dosyaları kopyala (geçmiş, bookmarks, favicons vb.)
    for (const fileName of FILES_TO_COPY_CORE) {
        const src = join(sourceProfilePath, fileName);
        const dest = join(targetProfileDir, fileName);

        if (await safeCopyFile(src, dest)) {
            totalCopied++;
            logger.debug(`  ✓ ${fileName}`);
        }
    }

    // 1b. Cookie dosyaları (opsiyonel)
    if (!excludeCookies) {
        for (const fileName of FILES_COOKIES) {
            const src = join(sourceProfilePath, fileName);
            const dest = join(targetProfileDir, fileName);

            if (await safeCopyFile(src, dest)) {
                totalCopied++;
                logger.debug(`  ✓ [🍪] ${fileName}`);
            }
        }
    } else {
        logger.info('   ⚠️ Cookie dosyaları atlandı (eski VFS session\'ları temiz)');
    }

    // 2. Root seviyedeki dosyaları kopyala (Local State vb.)
    if (sourceUserDataRoot) {
        for (const fileName of ROOT_FILES_TO_COPY) {
            const src = join(sourceUserDataRoot, fileName);
            const dest = join(targetUserDataDir, fileName);

            if (await safeCopyFile(src, dest)) {
                totalCopied++;
                logger.debug(`  ✓ [ROOT] ${fileName}`);
            }
        }
    }

    // 3. Alt dizinleri kopyala (Extensions vb.)
    for (const dirName of DIRS_TO_COPY) {
        const src = join(sourceProfilePath, dirName);
        const dest = join(targetProfileDir, dirName);

        const dirCopied = await safeCopyDir(src, dest);
        if (dirCopied > 0) {
            totalCopied += dirCopied;
            logger.debug(`  ✓ [DIR] ${dirName} (${dirCopied} dosya)`);
        }
    }

    // Güvenlik kontrolü — hassas dosyalar kopyalanmadığından emin ol
    for (const dangerFile of FILES_NEVER_COPY) {
        const dangerPath = join(targetProfileDir, dangerFile);
        if (existsSync(dangerPath)) {
            const { unlink } = require('fs/promises');
            await unlink(dangerPath);
            logger.warn(`⚠️ Güvenlik: ${dangerFile} silindi (hassas veri)`);
        }
    }

    if (totalCopied > 0) {
        logger.info(`🔥 Profil ısındırıldı! ${totalCopied} dosya kopyalandı`);
        logger.info('   Tarayıcı geçmiş, cookie ve form verisi ile dolu profil hazır');
    } else {
        logger.warn('⚠️ Profil ısındırması yapılamadı — kaynak dosya bulunamadı');
    }

    return totalCopied;
}

/**
 * Profilin daha önce ısındırılıp ısındırılmadığını kontrol et
 */
export function isProfileWarmed(targetUserDataDir: string): boolean {
    const markers = [
        join(targetUserDataDir, 'Default', 'History'),
        join(targetUserDataDir, 'Default', 'Cookies'),
    ];

    return markers.some(m => existsSync(m));
}

/**
 * Profil ısınma durumunu özetle
 */
export async function getWarmupStatus(targetUserDataDir: string): Promise<{
    isWarmed: boolean;
    hasHistory: boolean;
    hasCookies: boolean;
    hasBookmarks: boolean;
    hasExtensions: boolean;
    fileCount: number;
}> {
    const defaultDir = join(targetUserDataDir, 'Default');

    const hasCookies = existsSync(join(defaultDir, 'Cookies'));
    const hasHistory = existsSync(join(defaultDir, 'History'));
    const hasBookmarks = existsSync(join(defaultDir, 'Bookmarks'));
    const hasExtensions = existsSync(join(defaultDir, 'Extensions'));

    let fileCount = 0;
    try {
        const entries = await readdir(defaultDir);
        fileCount = entries.length;
    } catch { /* dizin yok */ }

    return {
        isWarmed: hasHistory || hasCookies,
        hasHistory,
        hasCookies,
        hasBookmarks,
        hasExtensions,
        fileCount,
    };
}
