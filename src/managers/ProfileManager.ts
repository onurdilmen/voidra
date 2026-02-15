/**
 * VOIDRA — Profil Yöneticisi (ProfileManager)
 * 
 * Profil CRUD işlemleri: oluşturma, okuma, güncelleme, silme
 * Profil verileri JSON dosyalarında saklanır (data/profiles/)
 * Her profil benzersiz bir ID, parmak izi ve tarayıcı verisi dizinine sahiptir
 */

import { readFile, writeFile, readdir, unlink, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@utils/Logger';
import { eventBus } from '@core/EventBus';
import { generateFingerprint } from '@core/FingerprintGenerator';
import { EVENTS, PROFILE_COLORS, buildVfsLoginUrl } from '@utils/Constants';
import type {
    Profile,
    ProfileSummary,
    CreateProfileParams,
    UpdateProfileParams
} from '@models/Profile';

const logger = new Logger('ProfileManager');

export class ProfileManager {
    private profilesDir: string;
    private browserDataDir: string;
    private profiles: Map<string, Profile> = new Map();
    private colorIndex: number = 0;

    constructor(dataBasePath: string) {
        this.profilesDir = join(dataBasePath, 'profiles');
        this.browserDataDir = join(dataBasePath, '..', 'browser_data');
    }

    /**
     * ProfileManager'ı başlat — dizinleri oluştur, mevcut profilleri yükle
     */
    async initialize(): Promise<void> {
        logger.info('ProfileManager başlatılıyor...');

        // Dizinleri oluştur
        await mkdir(this.profilesDir, { recursive: true });
        await mkdir(this.browserDataDir, { recursive: true });

        // Mevcut profilleri yükle
        await this.loadProfiles();

        logger.info(`ProfileManager hazır — ${this.profiles.size} profil yüklendi ✓`);
    }

    /**
     * Diskteki tüm profil dosyalarını yükle
     */
    private async loadProfiles(): Promise<void> {
        try {
            const files = await readdir(this.profilesDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            for (const file of jsonFiles) {
                try {
                    const filePath = join(this.profilesDir, file);
                    const raw = await readFile(filePath, 'utf-8');
                    const profile: Profile = JSON.parse(raw);

                    // Durum sıfırla (uygulama yeniden başladığında tüm profiller idle olmalı)
                    profile.status = 'idle';
                    this.profiles.set(profile.id, profile);
                } catch (err) {
                    logger.error(`Profil yüklenemedi: ${file}`, err);
                }
            }
        } catch (err) {
            logger.warn('Profil dizini okunamadı, boş başlatılıyor', err);
        }
    }

    /**
     * Profili diske kaydet
     */
    private async saveProfile(profile: Profile): Promise<void> {
        const filePath = join(this.profilesDir, `${profile.id}.json`);
        await writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    }

    /**
     * Sonraki profil rengini al (döngüsel rotasyon)
     */
    private getNextColor(): string {
        const color = PROFILE_COLORS[this.colorIndex % PROFILE_COLORS.length];
        this.colorIndex++;
        return color;
    }

    // ─── CRUD Operasyonları ─────────────────────────────────────

    /**
     * Yeni profil oluştur
     */
    async create(params: CreateProfileParams): Promise<Profile> {
        const id = uuidv4();
        const now = new Date().toISOString();

        // Parmak izi oluştur
        const fingerprint = generateFingerprint();

        const profile: Profile = {
            id,
            name: params.name,
            color: params.color || this.getNextColor(),
            status: 'idle',
            notes: params.notes || '',
            browserChannel: params.browserChannel || 'firefox',
            startUrl: params.vfsCountry
                ? buildVfsLoginUrl(params.vfsCountry)
                : params.startUrl || 'https://visa.vfsglobal.com/tur/en/nld/',
            vfsCountry: params.vfsCountry || 'nld',
            fingerprint,
            proxy: params.proxy,
            createdAt: now,
            lastUsedAt: null,
            totalSessions: 0,
            tags: params.tags || [],
        };

        // Profil tarayıcı veri dizinini oluştur
        const profileBrowserDir = join(this.browserDataDir, id);
        await mkdir(profileBrowserDir, { recursive: true });

        // Belleğe ve diske kaydet
        this.profiles.set(id, profile);
        await this.saveProfile(profile);

        // Olay yayınla
        eventBus.emit(EVENTS.PROFILE_CREATED, profile);
        logger.info(`Profil oluşturuldu: "${profile.name}" (${id.substring(0, 8)}...)`);

        return profile;
    }

    /**
     * Tüm profillerin özetini döndür (listeleme)
     */
    async list(): Promise<ProfileSummary[]> {
        const summaries: ProfileSummary[] = [];

        for (const profile of this.profiles.values()) {
            summaries.push({
                id: profile.id,
                name: profile.name,
                color: profile.color,
                status: profile.status,
                browserChannel: profile.browserChannel,
                lastUsedAt: profile.lastUsedAt,
                totalSessions: profile.totalSessions,
                tags: profile.tags,
                hasProxy: !!profile.proxy,
                vfsCountry: profile.vfsCountry || '',
            });
        }

        // Son kullanılana göre sırala (en yeni ilk)
        summaries.sort((a, b) => {
            if (!a.lastUsedAt && !b.lastUsedAt) return 0;
            if (!a.lastUsedAt) return 1;
            if (!b.lastUsedAt) return -1;
            return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        });

        return summaries;
    }

    /**
     * Belirli bir profili tam detaylarıyla getir
     */
    async get(id: string): Promise<Profile | null> {
        return this.profiles.get(id) || null;
    }

    /**
     * Profili güncelle
     */
    async update(id: string, params: UpdateProfileParams): Promise<Profile | null> {
        const profile = this.profiles.get(id);
        if (!profile) {
            logger.warn(`Güncellenecek profil bulunamadı: ${id}`);
            return null;
        }

        // Sadece gelen alanları güncelle
        if (params.name !== undefined) profile.name = params.name;
        if (params.color !== undefined) profile.color = params.color;
        if (params.browserChannel !== undefined) profile.browserChannel = params.browserChannel;
        if (params.startUrl !== undefined) profile.startUrl = params.startUrl;
        if (params.notes !== undefined) profile.notes = params.notes;
        if (params.proxy !== undefined) profile.proxy = params.proxy;
        if (params.tags !== undefined) profile.tags = params.tags;
        // vfsCountry değişirse startUrl'i de güncelle
        if (params.vfsCountry !== undefined) {
            profile.vfsCountry = params.vfsCountry;
            profile.startUrl = buildVfsLoginUrl(params.vfsCountry);
        }

        // Belleğe ve diske kaydet
        this.profiles.set(id, profile);
        await this.saveProfile(profile);

        eventBus.emit(EVENTS.PROFILE_UPDATED, profile);
        logger.info(`Profil güncellendi: "${profile.name}" (${id.substring(0, 8)}...)`);

        return profile;
    }

    /**
     * Profili sil
     */
    async delete(id: string): Promise<boolean> {
        const profile = this.profiles.get(id);
        if (!profile) {
            logger.warn(`Silinecek profil bulunamadı: ${id}`);
            return false;
        }

        // Aktif oturum varsa silinemez
        if (profile.status === 'active' || profile.status === 'launching') {
            logger.warn(`Aktif profil silinemez: "${profile.name}"`);
            return false;
        }

        // Profil JSON dosyasını sil
        const filePath = join(this.profilesDir, `${id}.json`);
        try {
            await unlink(filePath);
        } catch {
            // Dosya zaten yoksa sorun yok
        }

        // Tarayıcı veri dizinini sil (çerezler, session storage, vs.)
        const profileBrowserDir = join(this.browserDataDir, id);
        try {
            await rm(profileBrowserDir, { recursive: true, force: true });
        } catch {
            logger.warn(`Tarayıcı veri dizini silinemedi: ${profileBrowserDir}`);
        }

        // Bellekten kaldır
        this.profiles.delete(id);

        eventBus.emit(EVENTS.PROFILE_DELETED, { id });
        logger.info(`Profil silindi: "${profile.name}" (${id.substring(0, 8)}...)`);

        return true;
    }

    // ─── Durum Yönetimi ──────────────────────────────────────────

    /**
     * Profilin durumunu güncelle (iç kullanım)
     */
    setStatus(id: string, status: Profile['status']): void {
        const profile = this.profiles.get(id);
        if (profile) {
            profile.status = status;
            this.profiles.set(id, profile);
        }
    }

    /**
     * Oturum açıldığında istatistikleri güncelle
     */
    async recordSessionStart(id: string): Promise<void> {
        const profile = this.profiles.get(id);
        if (profile) {
            profile.lastUsedAt = new Date().toISOString();
            profile.totalSessions += 1;
            profile.status = 'active';
            this.profiles.set(id, profile);
            await this.saveProfile(profile);
        }
    }

    /**
     * Oturum kapatıldığında durumu güncelle
     */
    async recordSessionEnd(id: string): Promise<void> {
        const profile = this.profiles.get(id);
        if (profile) {
            profile.status = 'idle';
            this.profiles.set(id, profile);
            await this.saveProfile(profile);
        }
    }

    /**
     * Profilin tarayıcı veri dizin yolunu döndür
     */
    getBrowserDataPath(id: string): string {
        return join(this.browserDataDir, id);
    }

    /**
     * Toplam profil sayısı
     */
    get count(): number {
        return this.profiles.size;
    }

    /**
     * Aktif (çalışan) profil sayısı
     */
    get activeCount(): number {
        let count = 0;
        for (const profile of this.profiles.values()) {
            if (profile.status === 'active') count++;
        }
        return count;
    }
}
