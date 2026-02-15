/**
 * VOIDRA — Logger v2
 * Renkli konsol + dosya loglaması + UI akışı
 * 
 * ★ ÜÇ KATMANLI LOGLAMA:
 *   1. Konsol — renkli ANSI çıktısı (terminal)
 *   2. Dosya — data/logs/voidra_YYYY-MM-DD.log (kalıcı)
 *   3. UI — EventBus callback ile Canlı Log paneline (canlı)
 * 
 * Kullanım:
 *   const logger = new Logger('ProfileManager');
 *   logger.info('Profil oluşturuldu', { id: '123' });
 *   logger.error('Hata oluştu', error);
 * 
 * Callback bağlama (Orchestrator'da):
 *   Logger.setEmitCallback((entry) => eventBus.emit('LOG', entry));
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Log seviyeleri
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
}

// Konsol renk kodları (ANSI)
const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m'
};

// Log seviye etiketleri ve renkleri
const LEVEL_CONFIG: Record<number, { label: string; color: string }> = {
    [LogLevel.DEBUG]: { label: 'DEBUG', color: COLORS.dim },
    [LogLevel.INFO]: { label: 'INFO ', color: COLORS.cyan },
    [LogLevel.WARN]: { label: 'WARN ', color: COLORS.yellow },
    [LogLevel.ERROR]: { label: 'ERROR', color: COLORS.red }
};

// Log girişi tipi
export interface LogEntry {
    timestamp: string;
    level: string;
    source: string;
    message: string;
    data?: any;
}

export class Logger {
    private module: string;
    private static globalLevel: LogLevel = LogLevel.DEBUG;
    private static logHistory: LogEntry[] = [];

    // ★ UI'ya log gönderme callback'i — Orchestrator tarafından set edilir
    private static emitCallback: ((entry: LogEntry) => void) | null = null;

    // ★ Dosya log dizini
    private static logDir: string | null = null;
    private static logFileDate: string = '';
    private static logFilePath: string = '';

    constructor(module: string) {
        this.module = module;
    }

    /**
     * ★ UI log callback'ini bağla
     * Orchestrator.initialize() içinde çağrılır:
     *   Logger.setEmitCallback((entry) => eventBus.emit('LOG', entry));
     */
    static setEmitCallback(callback: (entry: LogEntry) => void): void {
        Logger.emitCallback = callback;
        console.log(`${COLORS.green}[Logger] UI log callback bağlandı ✓${COLORS.reset}`);
    }

    /**
     * ★ Dosya log dizinini ayarla
     * data/logs/ altında günlük log dosyaları oluşturur
     */
    static setLogDirectory(dataPath: string): void {
        Logger.logDir = join(dataPath, 'logs');
        if (!existsSync(Logger.logDir)) {
            mkdirSync(Logger.logDir, { recursive: true });
        }
        Logger.updateLogFile();
        console.log(`${COLORS.green}[Logger] Dosya loglaması aktif: ${Logger.logDir}${COLORS.reset}`);
    }

    /**
     * Gün değiştiğinde yeni log dosyası oluştur
     */
    private static updateLogFile(): void {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        if (today !== Logger.logFileDate && Logger.logDir) {
            Logger.logFileDate = today;
            Logger.logFilePath = join(Logger.logDir, `voidra_${today}.log`);
        }
    }

    /**
     * Dosyaya log yaz
     */
    private static writeToFile(timestamp: string, level: string, module: string, message: string, data?: any): void {
        if (!Logger.logDir) return;

        Logger.updateLogFile();

        try {
            let line = `[${timestamp}] ${level.padEnd(5)} [${module}] ${message}`;
            if (data) {
                try {
                    line += ' ' + JSON.stringify(data, null, 0).substring(0, 500);
                } catch {
                    line += ' [data-stringify-error]';
                }
            }
            appendFileSync(Logger.logFilePath, line + '\n', 'utf-8');
        } catch {
            // Dosya yazma hatası — sessizce geç
        }
    }

    /**
     * Global log seviyesini ayarla
     */
    static setLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }

    /**
     * Log geçmişini döndür (UI'da göstermek için)
     */
    static getHistory(): LogEntry[] {
        return [...Logger.logHistory];
    }

    /**
     * Log geçmişini temizle
     */
    static clearHistory(): void {
        Logger.logHistory = [];
    }

    /**
     * Zaman damgası oluştur
     */
    private getTimestamp(): string {
        const now = new Date();
        return now.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
    }

    /**
     * Log mesajını formatla ve yazdır
     */
    private log(level: LogLevel, message: string, ...data: any[]): void {
        if (level < Logger.globalLevel) return;

        const timestamp = this.getTimestamp();
        const config = LEVEL_CONFIG[level];

        if (!config) return;

        const levelLabel = config.label.trim();

        // 1. Konsola renkli yazdır
        const prefix = `${COLORS.dim}${timestamp}${COLORS.reset} ${config.color}${config.label}${COLORS.reset} ${COLORS.magenta}[${this.module}]${COLORS.reset}`;

        if (data.length > 0) {
            console.log(`${prefix} ${message}`, ...data);
        } else {
            console.log(`${prefix} ${message}`);
        }

        // 2. Dosyaya yaz (TÜM loglar — DEBUG dahil)
        Logger.writeToFile(timestamp, levelLabel, this.module, message, data.length > 0 ? data : undefined);

        // 3. Geçmişe kaydet (son 1000 log)
        const entry: LogEntry = {
            timestamp,
            level: levelLabel,
            source: this.module,
            message,
            data: data.length > 0 ? data : undefined
        };

        Logger.logHistory.push(entry);

        if (Logger.logHistory.length > 1000) {
            Logger.logHistory.shift();
        }

        // 4. ★ UI'ya gönder — static callback ile (circular dependency yok)
        // DEBUG hariç — UI'da fazla gürültü yapmasın
        if (level >= LogLevel.INFO && Logger.emitCallback) {
            try {
                Logger.emitCallback(entry);
            } catch {
                // Callback hatası — sessizce geç
            }
        }
    }

    debug(message: string, ...data: any[]): void {
        this.log(LogLevel.DEBUG, message, ...data);
    }

    info(message: string, ...data: any[]): void {
        this.log(LogLevel.INFO, message, ...data);
    }

    warn(message: string, ...data: any[]): void {
        this.log(LogLevel.WARN, message, ...data);
    }

    error(message: string, ...data: any[]): void {
        this.log(LogLevel.ERROR, message, ...data);
    }

    /**
     * Başlangıç banner'ı yazdır
     */
    static printBanner(): void {
        console.log(`
${COLORS.cyan}
  ██╗   ██╗ ██████╗ ██╗██████╗ ██████╗  █████╗ 
  ██║   ██║██╔═══██╗██║██╔══██╗██╔══██╗██╔══██╗
  ██║   ██║██║   ██║██║██║  ██║██████╔╝███████║
  ╚██╗ ██╔╝██║   ██║██║██║  ██║██╔══██╗██╔══██║
   ╚████╔╝ ╚██████╔╝██║██████╔╝██║  ██║██║  ██║
    ╚═══╝   ╚═════╝ ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
${COLORS.reset}
  ${COLORS.dim}Anti-Detect Browser & VFS Automation Engine${COLORS.reset}
  ${COLORS.dim}v0.1.0 — "Görünmeden Geç."${COLORS.reset}
`);
    }
}
