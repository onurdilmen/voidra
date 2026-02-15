#!/usr/bin/env node
/**
 * VFS Global Firewall Reset — Bağımsız Script
 * 
 * VOIDRA uygulaması olmadan da çalıştırılabilir.
 * Node.js ile direkt çalıştırma: node scripts/vfs-firewall-reset.js
 * 
 * KULLANIM:
 *   node vfs-firewall-reset.js             → Tam sıfırlama (cookie + DNS + modem)
 *   node vfs-firewall-reset.js --quick     → Sadece cookie + DNS (modem restart yok)
 *   node vfs-firewall-reset.js --no-modem  → Cookie + DNS (modem restart yok)
 *   node vfs-firewall-reset.js --gateway 192.168.1.1 --user admin --pass admin
 * 
 * NE YAPAR:
 *   1. Tüm Edge/Chrome süreçlerini kapatır
 *   2. VFS Global çerezlerini siler (tüm tarayıcı profilleri)
 *   3. localStorage, sessionStorage, IndexedDB temizler
 *   4. Tarayıcı cache'ini temizler
 *   5. Service Worker kayıtlarını siler
 *   6. DNS cache'i flush eder
 *   7. Modemi yeniden başlatır (yeni IP için)
 *   8. Yeni IP adresini doğrular
 * 
 * @author YASO
 */

const { exec, execSync } = require('child_process');
const { existsSync, readdirSync, readFileSync, unlinkSync, rmSync } = require('fs');
const { join } = require('path');
const http = require('http');
const https = require('https');

// ═══════════════════════════════════════════════════════════════
// YAPILANDIRMA
// ═══════════════════════════════════════════════════════════════

// Komut satırı argümanlarını parse et
const args = process.argv.slice(2);
const CONFIG = {
    quickMode: args.includes('--quick') || args.includes('--no-modem'),
    gatewayIp: getArg('--gateway') || '192.168.1.1',
    username: getArg('--user') || 'admin',
    password: getArg('--pass') || 'admin',
    waitAfterReboot: parseInt(getArg('--wait') || '60000'),
};

function getArg(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// VFS Global domain desenleri
const VFS_DOMAINS = ['vfsglobal.com', 'visa.vfsglobal.com', '.vfsglobal.com', 'vfsglobal'];

// Tarayıcı veri dizinleri
const BROWSER_DATA = {
    edge: join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
    chrome: join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
};

// Renkli konsol çıktıları
const C = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

function log(icon, msg, color = C.reset) {
    const ts = new Date().toLocaleTimeString('tr-TR');
    console.log(`${C.dim}[${ts}]${C.reset} ${icon} ${color}${msg}${C.reset}`);
}

// ═══════════════════════════════════════════════════════════════
// BANNER
// ═══════════════════════════════════════════════════════════════

function printBanner() {
    console.log(`
${C.red}${C.bold}╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🔥  VFS GLOBAL FIREWALL RESET  🔥                   ║
║                                                       ║
║   Çerez + Token + Cache + DNS → SİL                   ║
║   Modem → Yeniden Başlat                               ║
║   IP → Yenile                                          ║
║                                                       ║
║   VOIDRA — Görünmeden Geç.                             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝${C.reset}
`);
    log('⚙️', `Mod: ${CONFIG.quickMode ? 'HIZLI TEMİZLİK' : 'TAM SIFIRLAMA'}`, C.cyan);
    log('🌐', `Gateway: ${CONFIG.gatewayIp}`, C.cyan);
    console.log('');
}

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

async function main() {
    printBanner();

    const startTime = Date.now();
    const results = [];
    let oldIp = null;
    let newIp = null;

    // Mevcut IP'yi kaydet
    try {
        oldIp = await getPublicIp();
        log('📍', `Mevcut IP: ${oldIp}`, C.cyan);
    } catch {
        log('⚠️', 'Mevcut IP alınamadı', C.yellow);
    }

    console.log('');
    log('🔄', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', C.bold);

    // ADIM 1: Tarayıcı süreçlerini kapat
    results.push(await runStep('Tarayıcı Süreçlerini Kapat', async () => {
        await killAllBrowsers();
        return 'Edge ve Chrome süreçleri kapatıldı';
    }));

    // ADIM 2: Edge cookie temizleme
    results.push(await runStep('Edge Cookie Temizleme', async () => {
        const count = clearBrowserCookies('edge');
        return `${count} cookie dosyası silindi`;
    }));

    // ADIM 3: Chrome cookie temizleme
    results.push(await runStep('Chrome Cookie Temizleme', async () => {
        const count = clearBrowserCookies('chrome');
        return `${count} cookie dosyası silindi`;
    }));

    // ADIM 4: Web Storage temizleme
    results.push(await runStep('Web Storage Temizleme', async () => {
        const count = clearWebStorage();
        return `${count} kayıt silindi`;
    }));

    // ADIM 5: Cache temizleme
    results.push(await runStep('Cache Temizleme', async () => {
        const count = clearBrowserCache();
        return `${count} cache dizini silindi`;
    }));

    // ADIM 6: Service Worker temizleme
    results.push(await runStep('Service Worker Temizleme', async () => {
        const count = clearServiceWorkers();
        return `${count} SW kaydı silindi`;
    }));

    // ADIM 7: DNS flush
    results.push(await runStep('DNS Cache Temizleme', async () => {
        await flushDns();
        return 'ipconfig /flushdns başarılı';
    }));

    // ADIM 8: SSL/TLS session temizle
    results.push(await runStep('SSL/TLS Cache Temizleme', async () => {
        await clearSslSessions();
        return 'Winsock sıfırlandı';
    }));

    // ADIM 9: Modem restart
    if (!CONFIG.quickMode) {
        results.push(await runStep('Modem Yeniden Başlatma', async () => {
            await restartModem();
            return 'Yeniden başlatma komutu gönderildi';
        }));

        // ADIM 10: İnternet bağlantısı bekleme
        results.push(await runStep('İnternet Bağlantı Bekleme', async () => {
            await waitForConnection(CONFIG.waitAfterReboot);
            return 'Bağlantı kuruldu';
        }));
    }

    // Yeni IP kontrolü
    try {
        newIp = await getPublicIp();
    } catch { /* sessiz */ }

    const ipChanged = oldIp && newIp && oldIp !== newIp;
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter(r => r.ok).length;

    // SON RAPOR
    console.log('');
    log('🔄', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', C.bold);
    console.log(`
${C.green}${C.bold}╔═══════════════════════════════════════════════════════╗
║              📊  SIFIRLAMA RAPORU                     ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  ⏱️  Toplam Süre:  ${totalTime.padEnd(10)} saniye                  ║
║  📍  Eski IP:      ${(oldIp || 'Bilinmiyor').padEnd(20)}             ║
║  📍  Yeni IP:      ${(newIp || 'Bilinmiyor').padEnd(20)}             ║
║  🔄  IP Değişti:   ${(ipChanged ? '✅ EVET' : '❌ HAYIR').padEnd(20)}             ║
║  📊  Başarılı:     ${successCount}/${results.length} adım                          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝${C.reset}
`);

    if (!ipChanged && !CONFIG.quickMode) {
        console.log(`${C.yellow}${C.bold}⚠️  IP DEĞİŞMEDİ! Olası sebepler:${C.reset}`);
        console.log(`${C.yellow}   • Modem yeniden başlatılamadı (admin şifresi yanlış olabilir)${C.reset}`);
        console.log(`${C.yellow}   • ISP sabit IP veriyor${C.reset}`);
        console.log(`${C.yellow}   • Öneriler:${C.reset}`);
        console.log(`${C.yellow}     → Modemi fiziksel olarak kapatıp 10 sn bekleyin ve açın${C.reset}`);
        console.log(`${C.yellow}     → Mobil hotspot kullanın${C.reset}`);
        console.log(`${C.yellow}     → --gateway, --user, --pass parametrelerini kontrol edin${C.reset}`);
        console.log('');
    }

    if (ipChanged) {
        console.log(`${C.green}${C.bold}✅ TAM BAŞARI! Yeni IP ile VFS Global'e temiz bir şekilde girebilirsiniz.${C.reset}`);
        console.log('');
    }

    process.exit(0);
}

// ═══════════════════════════════════════════════════════════════
// ADIM ÇALIŞTIRICI
// ═══════════════════════════════════════════════════════════════

async function runStep(name, fn) {
    const start = Date.now();
    try {
        const detail = await fn();
        const ms = Date.now() - start;
        log('✅', `${name}: ${detail} (${ms}ms)`, C.green);
        return { name, ok: true, detail, ms };
    } catch (error) {
        const ms = Date.now() - start;
        log('❌', `${name}: ${error.message || error} (${ms}ms)`, C.red);
        return { name, ok: false, detail: String(error), ms };
    }
}

// ═══════════════════════════════════════════════════════════════
// TEMİZLİK FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════

/** Tüm tarayıcı süreçlerini kapat */
function killAllBrowsers() {
    return new Promise((resolve) => {
        exec('taskkill /F /IM msedge.exe /T 2>nul & taskkill /F /IM chrome.exe /T 2>nul',
            { windowsHide: true },
            () => setTimeout(resolve, 2000)
        );
    });
}

/** Tarayıcı cookie dosyalarını sil */
function clearBrowserCookies(browser) {
    const basePath = BROWSER_DATA[browser];
    if (!existsSync(basePath)) return 0;
    let count = 0;

    try {
        const profiles = readdirSync(basePath).filter(d =>
            d === 'Default' || d.startsWith('Profile ') || d === 'Guest Profile'
        );

        for (const prof of profiles) {
            const profPath = join(basePath, prof);

            // Ana cookie dosyaları
            for (const f of ['Cookies', 'Cookies-journal']) {
                const fp = join(profPath, f);
                if (existsSync(fp)) {
                    try { unlinkSync(fp); count++; } catch { /* kilitli */ }
                }
            }

            // Network dizini cookie'leri
            const netDir = join(profPath, 'Network');
            if (existsSync(netDir)) {
                for (const f of ['Cookies', 'Cookies-journal']) {
                    const fp = join(netDir, f);
                    if (existsSync(fp)) {
                        try { unlinkSync(fp); count++; } catch { /* kilitli */ }
                    }
                }
            }
        }
    } catch { /* erişim hatası */ }

    return count;
}

/** localStorage, sessionStorage, IndexedDB temizle */
function clearWebStorage() {
    let count = 0;

    for (const [, basePath] of Object.entries(BROWSER_DATA)) {
        if (!existsSync(basePath)) continue;

        try {
            const profiles = readdirSync(basePath).filter(d =>
                d === 'Default' || d.startsWith('Profile ') || d === 'Guest Profile'
            );

            for (const prof of profiles) {
                const profPath = join(basePath, prof);

                // Local Storage
                const lsPath = join(profPath, 'Local Storage', 'leveldb');
                if (existsSync(lsPath)) {
                    try {
                        for (const file of readdirSync(lsPath)) {
                            if (file.endsWith('.ldb') || file.endsWith('.log')) {
                                try {
                                    const content = readFileSync(join(lsPath, file), 'latin1');
                                    if (VFS_DOMAINS.some(d => content.includes(d))) {
                                        unlinkSync(join(lsPath, file));
                                        count++;
                                    }
                                } catch { /* dosya hatası */ }
                            }
                        }
                    } catch { /* dizin hatası */ }
                }

                // Session Storage
                const ssPath = join(profPath, 'Session Storage');
                if (existsSync(ssPath)) {
                    try {
                        for (const file of readdirSync(ssPath)) {
                            if (file.endsWith('.ldb') || file.endsWith('.log')) {
                                try {
                                    const content = readFileSync(join(ssPath, file), 'latin1');
                                    if (VFS_DOMAINS.some(d => content.includes(d))) {
                                        unlinkSync(join(ssPath, file));
                                        count++;
                                    }
                                } catch { /* dosya hatası */ }
                            }
                        }
                    } catch { /* dizin hatası */ }
                }

                // IndexedDB
                const idbPath = join(profPath, 'IndexedDB');
                if (existsSync(idbPath)) {
                    try {
                        for (const dir of readdirSync(idbPath)) {
                            if (VFS_DOMAINS.some(d => dir.toLowerCase().includes(d.toLowerCase()))) {
                                rmSync(join(idbPath, dir), { recursive: true, force: true });
                                count++;
                            }
                        }
                    } catch { /* dizin hatası */ }
                }
            }
        } catch { /* erişim hatası */ }
    }

    return count;
}

/** Tarayıcı cache dizinlerini temizle */
function clearBrowserCache() {
    let count = 0;

    for (const [, basePath] of Object.entries(BROWSER_DATA)) {
        if (!existsSync(basePath)) continue;

        try {
            const profiles = readdirSync(basePath).filter(d =>
                d === 'Default' || d.startsWith('Profile ') || d === 'Guest Profile'
            );

            for (const prof of profiles) {
                const profPath = join(basePath, prof);
                const cacheDirs = ['Cache', 'Code Cache', 'GPUCache',
                    join('Service Worker', 'CacheStorage'),
                    join('Service Worker', 'ScriptCache')];

                for (const cacheDir of cacheDirs) {
                    const cp = join(profPath, cacheDir);
                    if (existsSync(cp)) {
                        try {
                            rmSync(cp, { recursive: true, force: true });
                            count++;
                        } catch { /* kilitli */ }
                    }
                }
            }
        } catch { /* erişim hatası */ }
    }

    return count;
}

/** Service Worker temizle */
function clearServiceWorkers() {
    let count = 0;

    for (const [, basePath] of Object.entries(BROWSER_DATA)) {
        if (!existsSync(basePath)) continue;

        try {
            const profiles = readdirSync(basePath).filter(d =>
                d === 'Default' || d.startsWith('Profile ') || d === 'Guest Profile'
            );

            for (const prof of profiles) {
                const swDb = join(basePath, prof, 'Service Worker', 'Database');
                if (existsSync(swDb)) {
                    try {
                        rmSync(swDb, { recursive: true, force: true });
                        count++;
                    } catch { /* kilitli */ }
                }
            }
        } catch { /* erişim hatası */ }
    }

    return count;
}

/** DNS cache temizle */
function flushDns() {
    return new Promise((resolve, reject) => {
        exec('ipconfig /flushdns', { windowsHide: true }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/** SSL/TLS session cache sıfırla */
function clearSslSessions() {
    return new Promise((resolve) => {
        exec('netsh winsock reset catalog 2>nul', { windowsHide: true }, () => resolve());
    });
}

// ═══════════════════════════════════════════════════════════════
// MODEM YENİDEN BAŞLATMA
// ═══════════════════════════════════════════════════════════════

async function restartModem() {
    const { gatewayIp, username, password } = CONFIG;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // Farklı modem markaları için endpoint'ler
    const endpoints = [
        { url: `http://${gatewayIp}/reboot`, method: 'POST' },
        { url: `http://${gatewayIp}/cgi-bin/reboot`, method: 'POST' },
        { url: `http://${gatewayIp}/api/system/reboot`, method: 'POST' },
        { url: `http://${gatewayIp}/goform/goform_set_cmd_process`, method: 'POST', body: 'isTest=false&goformId=REBOOT_DEVICE' },
        { url: `http://${gatewayIp}/api/device/control`, method: 'POST', body: '<?xml version="1.0" encoding="UTF-8"?><request><Control>4</Control></request>' },
        { url: `http://${gatewayIp}/cgi-bin/Reboot`, method: 'GET' },
        { url: `http://${gatewayIp}/maintenance/reboot`, method: 'POST' },
    ];

    for (const ep of endpoints) {
        try {
            await httpReq(ep.url, {
                method: ep.method,
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: ep.body,
                timeout: 5000,
            });
            log('✅', `Modem yeniden başlatma: ${ep.url}`, C.green);
            return;
        } catch {
            continue;
        }
    }

    // Son çare: Network adapter reset
    log('⚠️', 'HTTP modem restart başarısız — Ağ adaptörü sıfırlanıyor...', C.yellow);
    await resetNetworkAdapter();
}

/** Ağ adaptörünü devre dışı bırakıp tekrar aç */
function resetNetworkAdapter() {
    return new Promise((resolve, reject) => {
        const findCmd = `powershell -Command "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and ($_.InterfaceDescription -like '*Ethernet*' -or $_.InterfaceDescription -like '*Wi-Fi*' -or $_.InterfaceDescription -like '*Wireless*') } | Select-Object -First 1 -ExpandProperty Name"`;

        exec(findCmd, { windowsHide: true }, (err, stdout) => {
            if (err || !stdout.trim()) {
                reject(new Error('Aktif ağ adaptörü bulunamadı'));
                return;
            }

            const adapter = stdout.trim();
            log('🔌', `Ağ adaptörü: "${adapter}"`, C.blue);

            // Kapat → Bekle → Aç
            exec(`netsh interface set interface "${adapter}" disable`, { windowsHide: true }, () => {
                log('🔄', 'Adaptör devre dışı — 5 saniye bekleniyor...', C.yellow);
                setTimeout(() => {
                    exec(`netsh interface set interface "${adapter}" enable`, { windowsHide: true }, () => {
                        log('✅', 'Adaptör tekrar etkinleştirildi', C.green);
                        setTimeout(resolve, 5000);
                    });
                }, 5000);
            });
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// NETWORK ARAÇLARI
// ═══════════════════════════════════════════════════════════════

/** Dış IP adresini öğren */
async function getPublicIp() {
    const services = [
        'https://api.ipify.org',
        'https://ifconfig.me/ip',
        'https://icanhazip.com',
        'https://checkip.amazonaws.com',
    ];

    for (const url of services) {
        try {
            const data = await httpReq(url, { method: 'GET', timeout: 5000 });
            const ip = data.trim();
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;
        } catch { continue; }
    }

    throw new Error('IP alınamadı');
}

/** İnternet bağlantısını bekle */
async function waitForConnection(maxWait) {
    const start = Date.now();
    log('⏳', `İnternet bağlantısı bekleniyor (max ${maxWait / 1000}s)...`, C.yellow);

    while (Date.now() - start < maxWait) {
        try {
            const ip = await getPublicIp();
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            log('✅', `Bağlantı kuruldu: ${ip} (${elapsed}s)`, C.green);
            return;
        } catch {
            const remaining = Math.ceil((maxWait - (Date.now() - start)) / 1000);
            process.stdout.write(`\r   ⏳ Bağlantı bekleniyor... ${remaining}s kaldı`);
            await sleep(5000);
        }
    }

    console.log(''); // Satır sonu
    throw new Error(`Bağlantı ${maxWait / 1000}s içinde kurulamadı`);
}

/** Basit HTTP istek */
function httpReq(url, opts) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;

        const reqOpts = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: opts.method || 'GET',
            headers: opts.headers || {},
            timeout: opts.timeout || 10000,
            rejectUnauthorized: false,
        };

        const req = lib.request(reqOpts, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        if (opts.body) req.write(opts.body);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════
// BAŞLAT
// ═══════════════════════════════════════════════════════════════

main().catch((err) => {
    console.error(`${C.red}${C.bold}HATA: ${err.message}${C.reset}`);
    process.exit(1);
});
