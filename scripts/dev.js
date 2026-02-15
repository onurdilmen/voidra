/**
 * VOIDRA — Dev başlatıcı
 * ELECTRON_RUN_AS_NODE ortam değişkenini temizleyerek electron-vite başlatır
 * 
 * ★ Windows UTF-8 düzeltmesi:
 *   - chcp 65001 ile konsol code page'i UTF-8'e çevrilir
 *   - Türkçe karakterler (ş, ç, ğ, ı, ö, ü) doğru görünür
 */
const { execSync } = require('child_process');

// Bu değişken Electron'u Node moduna sokar — temizle
delete process.env.ELECTRON_RUN_AS_NODE;

// ★ Windows konsolunu UTF-8'e zorla
if (process.platform === 'win32') {
    try {
        execSync('chcp 65001', { stdio: 'ignore' });
    } catch { /* sessizce atla */ }
}

try {
    execSync('npx electron-vite dev', {
        stdio: 'inherit',
        env: {
            ...process.env,
            // Node.js'in stdout/stderr encoding'ini UTF-8 yap
            NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --experimental-global-webcrypto',
            // Electron konsol encoding
            LANG: 'tr_TR.UTF-8',
            PYTHONIOENCODING: 'utf-8',
        }
    });
} catch (e) {
    process.exit(e.status || 1);
}
