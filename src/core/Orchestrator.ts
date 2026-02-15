/**
 * VOIDRA — Orchestrator (Orkestratör)
 * 
 * ★ TÜM MODÜLLER BU SINIF ÜZERİNDEN KOORDİNE EDİLİR
 * 
 * Sorumluluklar:
 *   1. Modüllerin lifecycle yönetimi (başlatma, durdurma)
 *   2. Session akışı koordinasyonu (profil hazırla → tarayıcı aç → stealth uygula → otomasyon)
 *   3. Hata yönetimi ve retry stratejisi
 *   4. Durum izleme ve raporlama
 * 
 * index.ts artık sadece Electron penceresi + IPC shell'idir.
 * Tüm iş mantığı Orchestrator'dadır.
 */

import { Logger } from '@utils/Logger';
import { config } from '@core/Config';
import { eventBus } from '@core/EventBus';
import { EVENTS } from '@utils/Constants';
import { ProfileManager } from '@managers/ProfileManager';
import { SessionManager } from '@managers/SessionManager';
import { PoolManager } from '@managers/PoolManager';
import type { Profile, CreateProfileParams, UpdateProfileParams, ProfileSummary } from '@models/Profile';
import type { Applicant, CreateApplicantParams, UpdateApplicantParams, ApplicantSummary } from '@models/Applicant';
import {
    startScriptServer,
    stopScriptServer,
    getViolentmonkeyInstallUrl,
} from '@core/ScriptInjector';
import {
    performFullReset,
    quickCleanup,
    detectGateway,
    getCurrentPublicIp,
    type ModemConfig,
} from '@core/FirewallReset';
import { autoFillForm } from '@automation/AutoFillEngine';
import { notificationService } from '@core/NotificationService';
import type { AppointmentInfo } from '@core/NotificationService';

const logger = new Logger('Orchestrator');

// ═══════════════════════════════════════════════════════════════
// Orchestrator Durum Tipleri
// ═══════════════════════════════════════════════════════════════

export type OrchestratorState = 'idle' | 'initializing' | 'ready' | 'running' | 'error' | 'shutting_down';

/** Genel IPC yanıt tipi */
export interface IpcResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

/** Slot monitör yapılandırması */
export interface SlotMonitorConfig {
    profileId: string;
    applicantId?: string;
    country: string;
    autoBook: boolean;
    dateRange?: {
        from: string;   // YYYY-MM-DD
        to: string;
    };
}

/** Orkestratör istatistikleri */
export interface OrchestratorStats {
    state: OrchestratorState;
    totalProfiles: number;
    activeSessions: number;
    poolCount: number;
    autoFillCount: number;
    uptime: number;     // saniye
    lastError: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Orchestrator Sınıfı
// ═══════════════════════════════════════════════════════════════

export class Orchestrator {
    private state: OrchestratorState = 'idle';
    private profileManager!: ProfileManager;
    private sessionManager!: SessionManager;
    private poolManager!: PoolManager;
    private startTime: number = Date.now();
    private lastError: string | null = null;
    private autoFillCount: number = 0;

    // ─── Lifecycle ───────────────────────────────────────────

    /**
     * Orchestrator'ı başlat
     * Tüm alt modülleri initialize eder
     */
    async initialize(dataPath: string): Promise<void> {
        this.state = 'initializing';
        this.startTime = Date.now();

        try {
            // ★ Logger'ı yapılandır — dosya loglaması + UI akışı
            Logger.setLogDirectory(dataPath);
            Logger.setEmitCallback((entry) => {
                eventBus.emit('LOG', entry);
            });

            // 1. Config'i yükle
            config.load(dataPath);
            logger.info('Config yüklendi ✓');

            // 2. Manager'ları oluştur
            this.profileManager = new ProfileManager(dataPath);
            await this.profileManager.initialize();
            logger.info(`ProfileManager hazır — ${this.profileManager.count} profil yüklendi ✓`);

            this.sessionManager = new SessionManager(this.profileManager);
            logger.info('SessionManager hazır ✓');

            this.poolManager = new PoolManager(dataPath);
            await this.poolManager.initialize();
            logger.info(`PoolManager hazır — ${this.poolManager.count} kişi yüklendi ✓`);

            // 3. Script server'ı başlat
            const scriptUrl = startScriptServer(this.poolManager);
            if (scriptUrl) {
                logger.info(`Script server aktif: ${scriptUrl}`);
            }

            // 4. EventBus listener'ları kur
            this.setupEventListeners();

            this.state = 'ready';
            eventBus.emit(EVENTS.APP_READY);
            logger.info('Orchestrator hazır ✓');

        } catch (error) {
            this.state = 'error';
            this.lastError = String(error);
            logger.error('Orchestrator başlatma hatası', error);
            throw error;
        }
    }

    /**
     * Orchestrator'ı kapat
     * Tüm oturumları kapat, kaynakları serbest bırak
     */
    async shutdown(): Promise<void> {
        this.state = 'shutting_down';
        logger.info('Orchestrator kapatılıyor...');

        try {
            // 1. Script server'ı kapat
            stopScriptServer();

            // 2. Tüm oturumları kapat
            if (this.sessionManager) {
                await this.sessionManager.closeAll();
            }

            // 3. Config'i kaydet
            config.save();

            this.state = 'idle';
            logger.info('Orchestrator kapatıldı ✓');
        } catch (error) {
            logger.error('Orchestrator kapatma hatası', error);
        }
    }

    // ─── Profil Yönetimi ─────────────────────────────────────

    async listProfiles(): Promise<IpcResult<ProfileSummary[]>> {
        try {
            const data = await this.profileManager.list();
            return { success: true, data };
        } catch (error) {
            return this.handleError('Profil listeleme', error);
        }
    }

    async createProfile(params: CreateProfileParams): Promise<IpcResult<Profile>> {
        try {
            const profile = await this.profileManager.create(params);
            return { success: true, data: profile };
        } catch (error) {
            return this.handleError('Profil oluşturma', error);
        }
    }

    async updateProfile(id: string, params: UpdateProfileParams): Promise<IpcResult<Profile>> {
        try {
            const profile = await this.profileManager.update(id, params);
            if (!profile) return { success: false, error: 'Profil bulunamadı' };
            return { success: true, data: profile };
        } catch (error) {
            return this.handleError('Profil güncelleme', error);
        }
    }

    async deleteProfile(id: string): Promise<IpcResult> {
        try {
            // Aktif oturumu varsa önce kapat
            if (this.sessionManager.isActive(id)) {
                await this.sessionManager.closeSession(id);
            }
            const result = await this.profileManager.delete(id);
            return { success: result, error: result ? undefined : 'Profil silinemedi' };
        } catch (error) {
            return this.handleError('Profil silme', error);
        }
    }

    // ─── Oturum Yönetimi ─────────────────────────────────────

    /**
     * ★ TEMİZ OTURUM: Tek butonla her şeyi yap
     * 
     * 1. Mevcut oturumları kapat
     * 2. Full firewall reset (modem restart + cookie temizle + DNS flush)
     * 3. Temiz tarayıcı başlat
     * 4. Kullanıcı login olacak → connectAfterLogin
     * 
     * Bu fonksiyon 403201 sorununu çözmek için tasarlandı.
     */
    async launchCleanSession(profileId: string, modemConfig?: Partial<ModemConfig>): Promise<IpcResult> {
        try {
            logger.info('═══════════════════════════════════════════════════════');
            logger.info('🚀 TEMİZ OTURUM BAŞLATILIYOR');
            logger.info('   Adım 1: Mevcut oturumları kapat');
            logger.info('   Adım 2: Full firewall reset');
            logger.info('   Adım 3: Temiz tarayıcı aç');
            logger.info('═══════════════════════════════════════════════════════');

            eventBus.emit(EVENTS.SESSION_STARTED, {
                profileId,
                status: 'launching',
                message: 'Temiz oturum hazırlanıyor — lütfen bekleyin...',
            });

            // ADIM 1: Mevcut oturumları kapat
            if (this.sessionManager.activeSessionCount > 0) {
                logger.info('📌 Adım 1: Mevcut oturumlar kapatılıyor...');
                await this.sessionManager.closeAll();
                logger.info('   ✅ Oturumlar kapatıldı');
            } else {
                logger.info('📌 Adım 1: Aktif oturum yok — devam');
            }

            // ADIM 2: Full firewall reset
            logger.info('📌 Adım 2: Full firewall reset başlıyor...');
            eventBus.emit(EVENTS.SESSION_STARTED, {
                profileId,
                status: 'launching',
                message: 'Firewall reset — cookie temizleme + DNS flush + modem restart...',
            });

            const resetReport = await performFullReset(modemConfig, true);

            logger.info(`   IP değişti: ${resetReport.ipChanged ? '✅ EVET' : '❌ HAYIR'}`);
            logger.info(`   Eski IP: ${resetReport.oldIp || 'Bilinmiyor'}`);
            logger.info(`   Yeni IP: ${resetReport.newIp || 'Bilinmiyor'}`);

            if (!resetReport.ipChanged) {
                logger.warn('   ⚠️ IP değişmedi — VFS hâlâ bloklayabilir');
                logger.warn('   💡 Modemi fiziksel olarak kapatıp tekrar açmayı deneyin');
            }

            // ADIM 3: Temiz tarayıcı başlat
            logger.info('📌 Adım 3: Temiz tarayıcı başlatılıyor...');
            eventBus.emit(EVENTS.SESSION_STARTED, {
                profileId,
                status: 'launching',
                message: `Temiz tarayıcı başlatılıyor — IP: ${resetReport.newIp || 'Bilinmiyor'}`,
            });

            const sessionResult = await this.sessionManager.openSession(profileId);

            if (!sessionResult) {
                return { success: false, error: 'Tarayıcı başlatılamadı' };
            }

            logger.info('═══════════════════════════════════════════════════════');
            logger.info('✅ TEMİZ OTURUM HAZIR');
            logger.info(`   🌐 Yeni IP: ${resetReport.newIp || 'Bilinmiyor'}`);
            logger.info('   🍪 Tüm cookie\'ler temizlendi');
            logger.info('   🔄 DNS cache temizlendi');
            logger.info('   📋 Login olun → "Login Tamamlandı" butonuna basın');
            logger.info('═══════════════════════════════════════════════════════');

            return {
                success: true,
                data: {
                    resetReport,
                    ipChanged: resetReport.ipChanged,
                    newIp: resetReport.newIp,
                    message: 'Temiz oturum hazır — login olun',
                }
            };

        } catch (error) {
            return this.handleError('Temiz oturum başlatma', error);
        }
    }

    /**
     * Profil için tarayıcı oturumu aç
     * İzole profil + proxy + stealth uygulanır
     */
    async openSession(profileId: string): Promise<IpcResult> {
        try {
            logger.info(`Oturum açılıyor: ${profileId.substring(0, 8)}...`);
            const result = await this.sessionManager.openSession(profileId);
            return { success: result, error: result ? undefined : 'Oturum açılamadı' };
        } catch (error) {
            return this.handleError('Oturum başlatma', error);
        }
    }

    /**
     * Login sonrası CDP bağlantısı kur
     * Kullanıcı manuel login yaptıktan sonra çağrılır
     */
    async connectAfterLogin(profileId: string): Promise<IpcResult> {
        try {
            logger.info(`CDP bağlantısı istendi: ${profileId.substring(0, 8)}...`);
            const result = await this.sessionManager.connectAfterLogin(profileId);
            return { success: result, error: result ? undefined : 'CDP bağlantısı kurulamadı' };
        } catch (error) {
            return this.handleError('CDP bağlantı', error);
        }
    }

    /**
     * Oturum durumu sorgula
     */
    getSessionInfo(profileId: string): IpcResult {
        try {
            const info = this.sessionManager.getSessionInfo(profileId);
            return { success: true, data: info };
        } catch (error) {
            return this.handleError('Oturum bilgisi', error);
        }
    }

    /**
     * Oturumu kapat
     */
    async closeSession(profileId: string): Promise<IpcResult> {
        try {
            const result = await this.sessionManager.closeSession(profileId);
            return { success: result, error: result ? undefined : 'Oturum kapatılamadı' };
        } catch (error) {
            return this.handleError('Oturum kapatma', error);
        }
    }

    // ─── Havuz (Pool) Yönetimi ───────────────────────────────

    async listPool(): Promise<IpcResult<ApplicantSummary[]>> {
        try {
            return { success: true, data: await this.poolManager.list() };
        } catch (error) {
            return this.handleError('Havuz listeleme', error);
        }
    }

    async addToPool(data: CreateApplicantParams): Promise<IpcResult<Applicant>> {
        try {
            const applicant = await this.poolManager.add(data);
            return { success: true, data: applicant };
        } catch (error) {
            return this.handleError('Kişi ekleme', error);
        }
    }

    async getFromPool(id: string): Promise<IpcResult<Applicant>> {
        try {
            const applicant = await this.poolManager.get(id);
            if (!applicant) return { success: false, error: 'Kişi bulunamadı' };
            return { success: true, data: applicant };
        } catch (error) {
            return this.handleError('Kişi getirme', error);
        }
    }

    async updateInPool(id: string, data: UpdateApplicantParams): Promise<IpcResult<Applicant>> {
        try {
            const applicant = await this.poolManager.update(id, data);
            if (!applicant) return { success: false, error: 'Kişi bulunamadı' };
            return { success: true, data: applicant };
        } catch (error) {
            return this.handleError('Kişi güncelleme', error);
        }
    }

    async deleteFromPool(id: string): Promise<IpcResult> {
        try {
            const result = await this.poolManager.delete(id);
            return { success: result };
        } catch (error) {
            return this.handleError('Kişi silme', error);
        }
    }

    async importPool(content: string, format: 'json' | 'csv'): Promise<IpcResult> {
        try {
            const result = format === 'csv'
                ? await this.poolManager.importFromCSV(content)
                : await this.poolManager.importFromJSON(content);
            return { success: true, data: result };
        } catch (error) {
            return this.handleError('Import', error);
        }
    }

    async exportPool(format: 'json' | 'csv'): Promise<IpcResult<string>> {
        try {
            const content = format === 'csv'
                ? await this.poolManager.exportToCSV()
                : await this.poolManager.exportToJSON();
            return { success: true, data: content };
        } catch (error) {
            return this.handleError('Export', error);
        }
    }

    // ─── Auto-Fill ───────────────────────────────────────────

    async triggerAutoFill(profileId: string, applicantId: string): Promise<IpcResult> {
        try {
            const applicant = await this.poolManager.get(applicantId);
            if (!applicant) return { success: false, error: 'Kişi bulunamadı' };

            const pages = this.sessionManager.getPages(profileId);
            if (pages.length === 0) return { success: false, error: 'Aktif sayfa bulunamadı' };

            const result = await autoFillForm(pages[0], applicant, profileId);
            await this.poolManager.incrementUsedCount(applicantId);
            this.autoFillCount++;

            return { success: true, data: result };
        } catch (error) {
            return this.handleError('Auto-fill', error);
        }
    }

    // ─── Firewall Reset ──────────────────────────────────────

    async performFullReset(modemConfig?: Partial<ModemConfig>): Promise<IpcResult> {
        try {
            logger.info('🔥 Firewall tam sıfırlama tetiklendi');
            eventBus.emit(EVENTS.FIREWALL_RESET_STARTED, { type: 'full' });

            // Önce tüm aktif oturumları kapat
            if (this.sessionManager.activeSessionCount > 0) {
                logger.info('Aktif oturumlar kapatılıyor...');
                await this.sessionManager.closeAll();
            }

            const report = await performFullReset(modemConfig, true);
            return { success: report.success, data: report };
        } catch (error) {
            eventBus.emit(EVENTS.FIREWALL_RESET_ERROR, { error: String(error) });
            return this.handleError('Firewall reset', error);
        }
    }

    async performQuickCleanup(): Promise<IpcResult> {
        try {
            logger.info('⚡ Hızlı VFS temizleme tetiklendi');
            eventBus.emit(EVENTS.FIREWALL_RESET_STARTED, { type: 'quick' });

            if (this.sessionManager.activeSessionCount > 0) {
                logger.info('Aktif oturumlar kapatılıyor...');
                await this.sessionManager.closeAll();
            }

            const report = await quickCleanup();
            return { success: report.success, data: report };
        } catch (error) {
            return this.handleError('Hızlı temizleme', error);
        }
    }

    async detectGateway(): Promise<IpcResult> {
        try {
            const gateway = await detectGateway();
            return { success: true, data: gateway };
        } catch (error) {
            return this.handleError('Gateway tespiti', error);
        }
    }

    async getCurrentIp(): Promise<IpcResult<string>> {
        try {
            const ip = await getCurrentPublicIp();
            return { success: true, data: ip };
        } catch (error) {
            return this.handleError('IP tespiti', error);
        }
    }

    // ─── Script & Araçlar ────────────────────────────────────

    getScriptServerUrl(): IpcResult<string> {
        const url = startScriptServer(this.poolManager);
        return { success: !!url, data: url || undefined };
    }

    getViolentmonkeyUrl(channel: 'msedge' | 'chrome'): IpcResult<string> {
        return { success: true, data: getViolentmonkeyInstallUrl(channel) };
    }

    // ─── İstatistikler ───────────────────────────────────────

    getStats(): OrchestratorStats {
        return {
            state: this.state,
            totalProfiles: this.profileManager?.count ?? 0,
            activeSessions: this.sessionManager?.activeSessionCount ?? 0,
            poolCount: this.poolManager?.count ?? 0,
            autoFillCount: this.autoFillCount,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            lastError: this.lastError,
        };
    }

    // ─── Config Erişimi ──────────────────────────────────────

    getConfig(): IpcResult {
        return { success: true, data: config.toJSON() };
    }

    updateConfig(path: string, value: any): IpcResult {
        try {
            config.set(path, value);
            config.save();
            return { success: true };
        } catch (error) {
            return this.handleError('Config güncelleme', error);
        }
    }

    // ─── Bildirimler ─────────────────────────────────────────

    async testNotifications(): Promise<IpcResult> {
        try {
            const results = await notificationService.sendTest();
            return { success: true, data: results };
        } catch (error) {
            return this.handleError('Bildirim testi', error);
        }
    }

    async sendNotification(type: 'appointment' | 'error' | 'info', payload: any): Promise<IpcResult> {
        try {
            switch (type) {
                case 'appointment':
                    await notificationService.sendAppointmentFound(payload);
                    break;
                case 'error':
                    await notificationService.sendError(payload.context, payload.message);
                    break;
                case 'info':
                    await notificationService.sendInfo(payload.message);
                    break;
            }
            return { success: true };
        } catch (error) {
            return this.handleError('Bildirim gönderme', error);
        }
    }

    // ─── İç Yardımcılar ──────────────────────────────────────

    /**
     * Standart hata yönetimi — tüm IPC handler'larında kullanılır
     */
    private handleError(context: string, error: unknown): IpcResult {
        const message = error instanceof Error ? error.message : String(error);
        this.lastError = `[${context}] ${message}`;
        logger.error(`${context} hatası`, error);
        return { success: false, error: message };
    }

    /**
     * EventBus listener'ları — modüller arası olayları izle
     */
    private setupEventListeners(): void {
        // Session hataları
        eventBus.on(EVENTS.SESSION_ERROR, (data: any) => {
            this.lastError = `Session: ${data?.error || 'bilinmeyen hata'}`;
            logger.warn(`Oturum hatası yakalandı: ${this.lastError}`);
        });

        // Firewall reset tamamlandığında
        eventBus.on(EVENTS.FIREWALL_RESET_COMPLETED, (data: any) => {
            logger.info('Firewall reset tamamlandı', data);
        });

        // Randevu bulunduğunda → Bildirim gönder
        eventBus.on(EVENTS.APPOINTMENT_FOUND, async (data: any) => {
            logger.info('🎯 RANDEVU BULUNDU!', data);

            // ★ Tüm bildirim kanallarını tetikle
            await notificationService.sendAppointmentFound({
                date: data?.date,
                time: data?.time,
                center: data?.center,
                country: data?.country,
                profileName: data?.profileName,
                url: data?.url,
            });
        });

        logger.debug('EventBus listener\'ları kuruldu');
    }
}

// ═══════════════════════════════════════════════════════════════
// Global Singleton
// ═══════════════════════════════════════════════════════════════

export const orchestrator = new Orchestrator();
