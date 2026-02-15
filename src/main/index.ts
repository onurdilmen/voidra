/**
 * VOIDRA — Electron Ana Süreç (Main Process)
 * 
 * ★ SADECE Electron penceresi + IPC shell
 * Tüm iş mantığı Orchestrator'dadır.
 * 
 * Bu dosya:
 *   1. Electron penceresi oluşturur
 *   2. IPC handler'ları Orchestrator'a bağlar
 *   3. EventBus → Renderer köprüsünü kurar
 */
// ★ Windows konsolunda Türkçe karakter düzeltmesi
// chcp 65001 → UTF-8 code page. ş, ç, ğ, ı, ö, ü doğru görünür.
if (process.platform === 'win32') {
    try {
        require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
    } catch { /* sessizce atla */ }
    // stdout/stderr encoding
    if (process.stdout && typeof (process.stdout as any).setEncoding === 'function') {
        (process.stdout as any).setEncoding('utf-8');
    }
    if (process.stderr && typeof (process.stderr as any).setEncoding === 'function') {
        (process.stderr as any).setEncoding('utf-8');
    }
}

// ★ rebrowser-patches — CDP Runtime.enable leak düzeltici
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';
process.env.REBROWSER_PATCHES_SOURCE_URL = 'app.js';

import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Logger } from '@utils/Logger';
import { WINDOW_CONFIG, IPC_CHANNELS, APP_NAME, EVENTS } from '@utils/Constants';
import { eventBus } from '@core/EventBus';
import { orchestrator } from '@core/Orchestrator';

const logger = new Logger('Main');

// Global referanslar
let mainWindow: BrowserWindow | null = null;

// ═══════════════════════════════════════════════════════════════
// Pencere Oluşturma
// ═══════════════════════════════════════════════════════════════

function createWindow(): void {
    Logger.printBanner();
    logger.info('VOIDRA başlatılıyor...');

    mainWindow = new BrowserWindow({
        width: WINDOW_CONFIG.DEFAULT_WIDTH,
        height: WINDOW_CONFIG.DEFAULT_HEIGHT,
        minWidth: WINDOW_CONFIG.MIN_WIDTH,
        minHeight: WINDOW_CONFIG.MIN_HEIGHT,
        title: APP_NAME,
        icon: join(__dirname, '../../resources/icon.png'),
        frame: false,
        backgroundColor: '#07070d',
        show: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
        }
    });

    // Pencere hazır olunca göster
    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
        logger.info('Ana pencere gösterildi');
    });

    // Harici linkleri varsayılan tarayıcıda aç
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Geliştirme modunda DevTools aç
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Renderer'ı yükle
    if (process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
        logger.info('Vite dev server\'a bağlanıldı');
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
        logger.info('Üretim build\'i yüklendi');
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ═══════════════════════════════════════════════════════════════
// IPC Handler'ları — Orchestrator'a Delege
// ═══════════════════════════════════════════════════════════════

function setupIPC(): void {
    logger.info('IPC handler\'ları kaydediliyor...');

    // ─── Pencere Kontrolleri ─────────────────────────────────
    ipcMain.on('window:minimize', () => mainWindow?.minimize());

    ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });

    ipcMain.on('window:close', () => mainWindow?.close());

    ipcMain.handle('window:isMaximized', () => {
        return mainWindow?.isMaximized() || false;
    });

    mainWindow?.on('maximize', () => {
        mainWindow?.webContents.send('window:maximized', true);
    });

    mainWindow?.on('unmaximize', () => {
        mainWindow?.webContents.send('window:maximized', false);
    });

    // ─── Profil Yönetimi ─────────────────────────────────────
    // Tüm iş mantığı Orchestrator'da — IPC sadece köprü
    ipcMain.handle(IPC_CHANNELS.PROFILE_LIST, () =>
        orchestrator.listProfiles()
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_CREATE, (_event, data) =>
        orchestrator.createProfile(data)
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_UPDATE, (_event, id, data) =>
        orchestrator.updateProfile(id, data)
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_DELETE, (_event, id) =>
        orchestrator.deleteProfile(id)
    );

    // ─── Oturum Yönetimi ─────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.PROFILE_OPEN, (_event, id) =>
        orchestrator.openSession(id)
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_CLOSE, (_event, id) =>
        orchestrator.closeSession(id)
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_CONNECT, (_event, id) =>
        orchestrator.connectAfterLogin(id)
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_SESSION_INFO, (_event, id) =>
        orchestrator.getSessionInfo(id)
    );

    ipcMain.handle(IPC_CHANNELS.PROFILE_LAUNCH_CLEAN, (_event, id, modemConfig?) =>
        orchestrator.launchCleanSession(id, modemConfig)
    );

    // ─── Veri Havuzu (Pool) ──────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.POOL_LIST, () =>
        orchestrator.listPool()
    );

    ipcMain.handle(IPC_CHANNELS.POOL_ADD, (_event, data) =>
        orchestrator.addToPool(data)
    );

    ipcMain.handle(IPC_CHANNELS.POOL_UPDATE, (_event, id, data) =>
        orchestrator.updateInPool(id, data)
    );

    ipcMain.handle(IPC_CHANNELS.POOL_DELETE, (_event, id) =>
        orchestrator.deleteFromPool(id)
    );

    ipcMain.handle(IPC_CHANNELS.POOL_IMPORT, async () => {
        // Dosya seçme dialogu — UI sorumluluğu burada kalır
        const result = await dialog.showOpenDialog(mainWindow!, {
            title: 'Veri İçe Aktar',
            filters: [
                { name: 'JSON Dosyaları', extensions: ['json'] },
                { name: 'CSV Dosyaları', extensions: ['csv'] },
            ],
            properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'İptal edildi' };
        }

        const filePath = result.filePaths[0];
        const content = await readFile(filePath, 'utf-8');
        const format = filePath.endsWith('.csv') ? 'csv' as const : 'json' as const;

        return orchestrator.importPool(content, format);
    });

    ipcMain.handle(IPC_CHANNELS.POOL_EXPORT, async (_event, format: 'json' | 'csv') => {
        const exportResult = await orchestrator.exportPool(format);
        if (!exportResult.success || !exportResult.data) return exportResult;

        // Kaydetme dialogu — UI sorumluluğu
        const saveResult = await dialog.showSaveDialog(mainWindow!, {
            title: 'Veri Dışa Aktar',
            defaultPath: `voidra_pool_export.${format}`,
            filters: [
                { name: format === 'csv' ? 'CSV Dosyası' : 'JSON Dosyası', extensions: [format] },
            ],
        });

        if (saveResult.canceled || !saveResult.filePath) {
            return { success: false, error: 'İptal edildi' };
        }

        await writeFile(saveResult.filePath, exportResult.data, 'utf-8');
        logger.info(`Dışa aktarıldı: ${saveResult.filePath}`);
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.POOL_GET, (_event, id) =>
        orchestrator.getFromPool(id)
    );

    // ─── Auto-Fill ───────────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.AUTOFILL_TRIGGER, (_event, profileId, applicantId) =>
        orchestrator.triggerAutoFill(profileId, applicantId)
    );

    // ─── Dashboard İstatistikleri ────────────────────────────
    ipcMain.handle(IPC_CHANNELS.STATS_GET, () => {
        return orchestrator.getStats();
    });

    // ─── Log ─────────────────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.LOG_HISTORY, () => {
        return Logger.getHistory();
    });

    // ─── Script Server & Violentmonkey ───────────────────────
    ipcMain.handle(IPC_CHANNELS.SCRIPT_SERVER_URL, () =>
        orchestrator.getScriptServerUrl()
    );

    ipcMain.handle(IPC_CHANNELS.SCRIPT_VIOLENTMONKEY_URL, (_event, channel: 'msedge' | 'chrome') =>
        orchestrator.getViolentmonkeyUrl(channel)
    );

    // ─── Firewall Reset ──────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.FIREWALL_FULL_RESET, (_event, modemConfig?) =>
        orchestrator.performFullReset(modemConfig)
    );

    ipcMain.handle(IPC_CHANNELS.FIREWALL_QUICK_CLEANUP, () =>
        orchestrator.performQuickCleanup()
    );

    ipcMain.handle(IPC_CHANNELS.FIREWALL_DETECT_GATEWAY, () =>
        orchestrator.detectGateway()
    );

    ipcMain.handle(IPC_CHANNELS.FIREWALL_GET_IP, () =>
        orchestrator.getCurrentIp()
    );

    // ─── Config ──────────────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () =>
        orchestrator.getConfig()
    );

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, path: string, value: any) =>
        orchestrator.updateConfig(path, value)
    );

    // ─── Bildirimler ─────────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.NOTIFICATION_TEST, () =>
        orchestrator.testNotifications()
    );

    ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SEND, (_event, type: string, payload: any) =>
        orchestrator.sendNotification(type as any, payload)
    );

    logger.info('IPC handler\'ları kaydedildi ✓');
}

// ═══════════════════════════════════════════════════════════════
// EventBus → Renderer Köprüsü
// ═══════════════════════════════════════════════════════════════

function bridgeEventsToRenderer(): void {
    const eventsToForward = [
        EVENTS.PROFILE_CREATED,
        EVENTS.PROFILE_UPDATED,
        EVENTS.PROFILE_DELETED,
        EVENTS.SESSION_STARTED,
        EVENTS.SESSION_ENDED,
        EVENTS.SESSION_ERROR,
        EVENTS.SESSION_PHASE_CHANGED,
        EVENTS.POOL_APPLICANT_ADDED,
        EVENTS.POOL_APPLICANT_UPDATED,
        EVENTS.POOL_APPLICANT_DELETED,
        EVENTS.AUTOFILL_STARTED,
        EVENTS.AUTOFILL_COMPLETED,
        EVENTS.AUTOFILL_ERROR,
        EVENTS.FIREWALL_RESET_STARTED,
        EVENTS.FIREWALL_RESET_COMPLETED,
        EVENTS.FIREWALL_RESET_STEP,
        EVENTS.FIREWALL_RESET_ERROR,
        'LOG',  // ★ Canlı log akışı — terminal logları UI'a iletilir
    ];

    for (const eventName of eventsToForward) {
        eventBus.on(eventName, (data: any) => {
            mainWindow?.webContents.send('event:bridge', {
                event: eventName,
                data
            });
        });
    }

    logger.debug('Event köprüsü kuruldu — olaylar renderer\'a iletilecek');
}

// ═══════════════════════════════════════════════════════════════
// Uygulama Yaşam Döngüsü
// ═══════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
    logger.info('Electron hazır');

    // Veri dizini yolunu belirle
    const DATA_PATH = join(app.getAppPath(), 'data');

    // ★ Orchestrator'ı başlat — tüm modülleri initialize eder
    await orchestrator.initialize(DATA_PATH);

    // Ana pencereyi oluştur
    createWindow();

    // IPC handler'larını kur
    setupIPC();

    // EventBus → Renderer köprüsü
    bridgeEventsToRenderer();

    // macOS: dock'tan tekrar açma
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    logger.info('VOIDRA başarıyla başlatıldı ✓');
});

// Tüm pencereler kapatıldığında (macOS hariç)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Uygulama kapanırken temizlik
app.on('before-quit', async () => {
    logger.info('VOIDRA kapatılıyor...');
    await orchestrator.shutdown();
});
