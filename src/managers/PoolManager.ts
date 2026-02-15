/**
 * VOIDRA — Veri Havuzu Yöneticisi (PoolManager)
 * 
 * Başvuru sahiplerinin CRUD işlemleri: ekleme, düzenleme, silme, listeleme
 * Veriler JSON dosyalarında saklanır (data/pool/)
 * CSV ve JSON formatında import/export desteği
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@utils/Logger';
import { eventBus } from '@core/EventBus';
import { EVENTS } from '@utils/Constants';
import type {
    Applicant,
    ApplicantSummary,
    CreateApplicantParams,
    UpdateApplicantParams
} from '@models/Applicant';

const logger = new Logger('PoolManager');

export class PoolManager {
    private poolDir: string;
    private applicants: Map<string, Applicant> = new Map();

    constructor(dataBasePath: string) {
        this.poolDir = join(dataBasePath, 'pool');
    }

    /**
     * PoolManager'ı başlat — dizini oluştur, mevcut verileri yükle
     */
    async initialize(): Promise<void> {
        logger.info('PoolManager başlatılıyor...');
        await mkdir(this.poolDir, { recursive: true });
        await this.loadApplicants();
        logger.info(`PoolManager hazır — ${this.applicants.size} kişi yüklendi ✓`);
    }

    /**
     * Diskteki tüm başvuru sahibi dosyalarını yükle
     */
    private async loadApplicants(): Promise<void> {
        try {
            const files = await readdir(this.poolDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            for (const file of jsonFiles) {
                try {
                    const filePath = join(this.poolDir, file);
                    const raw = await readFile(filePath, 'utf-8');
                    const applicant: Applicant = JSON.parse(raw);
                    this.applicants.set(applicant.id, applicant);
                } catch (err) {
                    logger.error(`Başvuru sahibi yüklenemedi: ${file}`, err);
                }
            }
        } catch (err) {
            logger.warn('Havuz dizini okunamadı, boş başlatılıyor', err);
        }
    }

    /**
     * Başvuru sahibini diske kaydet
     */
    private async saveApplicant(applicant: Applicant): Promise<void> {
        const filePath = join(this.poolDir, `${applicant.id}.json`);
        await writeFile(filePath, JSON.stringify(applicant, null, 2), 'utf-8');
    }

    // ─── CRUD Operasyonları ─────────────────────────────────────

    /**
     * Yeni başvuru sahibi ekle
     */
    async add(params: CreateApplicantParams): Promise<Applicant> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const applicant: Applicant = {
            id,
            firstName: params.firstName,
            lastName: params.lastName,
            dateOfBirth: params.dateOfBirth,
            gender: params.gender,
            nationality: params.nationality,
            placeOfBirth: params.placeOfBirth || '',

            passportNumber: params.passportNumber,
            passportIssueDate: params.passportIssueDate,
            passportExpiryDate: params.passportExpiryDate,
            passportIssuingAuthority: params.passportIssuingAuthority || '',

            email: params.email,
            phone: params.phone,
            address: params.address || '',
            city: params.city || '',
            postalCode: params.postalCode || '',
            country: params.country || '',

            visaType: params.visaType || '',
            travelPurpose: params.travelPurpose || '',
            destinationCountry: params.destinationCountry || '',
            intendedArrivalDate: params.intendedArrivalDate,
            intendedDepartureDate: params.intendedDepartureDate,

            notes: params.notes || '',
            createdAt: now,
            updatedAt: now,
            usedCount: 0,
        };

        this.applicants.set(id, applicant);
        await this.saveApplicant(applicant);

        eventBus.emit(EVENTS.POOL_APPLICANT_ADDED, applicant);
        logger.info(`Kişi eklendi: "${applicant.firstName} ${applicant.lastName}" (${id.substring(0, 8)}...)`);

        return applicant;
    }

    /**
     * Tüm başvuru sahiplerinin özetini döndür (listeleme)
     */
    async list(): Promise<ApplicantSummary[]> {
        const summaries: ApplicantSummary[] = [];

        for (const applicant of this.applicants.values()) {
            summaries.push({
                id: applicant.id,
                firstName: applicant.firstName,
                lastName: applicant.lastName,
                passportNumber: applicant.passportNumber,
                email: applicant.email,
                phone: applicant.phone,
                nationality: applicant.nationality,
                destinationCountry: applicant.destinationCountry,
                usedCount: applicant.usedCount,
            });
        }

        // İsme göre sırala
        summaries.sort((a, b) => a.firstName.localeCompare(b.firstName, 'tr'));

        return summaries;
    }

    /**
     * Belirli bir başvuru sahibini tam detaylarıyla getir
     */
    async get(id: string): Promise<Applicant | null> {
        return this.applicants.get(id) || null;
    }

    /**
     * Başvuru sahibini güncelle
     */
    async update(id: string, params: UpdateApplicantParams): Promise<Applicant | null> {
        const applicant = this.applicants.get(id);
        if (!applicant) {
            logger.warn(`Güncellenecek kişi bulunamadı: ${id}`);
            return null;
        }

        // Gelen alanları güncelle
        Object.assign(applicant, params, { updatedAt: new Date().toISOString() });

        this.applicants.set(id, applicant);
        await this.saveApplicant(applicant);

        eventBus.emit(EVENTS.POOL_APPLICANT_UPDATED, applicant);
        logger.info(`Kişi güncellendi: "${applicant.firstName} ${applicant.lastName}"`);

        return applicant;
    }

    /**
     * Başvuru sahibini sil
     */
    async delete(id: string): Promise<boolean> {
        const applicant = this.applicants.get(id);
        if (!applicant) {
            logger.warn(`Silinecek kişi bulunamadı: ${id}`);
            return false;
        }

        const filePath = join(this.poolDir, `${id}.json`);
        try {
            await unlink(filePath);
        } catch { /* dosya yoksa sorun yok */ }

        this.applicants.delete(id);

        eventBus.emit(EVENTS.POOL_APPLICANT_DELETED, { id });
        logger.info(`Kişi silindi: "${applicant.firstName} ${applicant.lastName}"`);

        return true;
    }

    // ─── Import / Export ─────────────────────────────────────────

    /**
     * JSON dosyasından toplu import
     */
    async importFromJSON(jsonContent: string): Promise<{ imported: number; errors: number }> {
        let imported = 0;
        let errors = 0;

        try {
            const data = JSON.parse(jsonContent);
            const items: CreateApplicantParams[] = Array.isArray(data) ? data : [data];

            for (const item of items) {
                try {
                    // Minimum gerekli alanları kontrol et
                    if (!item.firstName || !item.lastName || !item.passportNumber) {
                        errors++;
                        continue;
                    }
                    await this.add(item);
                    imported++;
                } catch {
                    errors++;
                }
            }
        } catch (err) {
            logger.error('JSON import hatası', err);
            throw new Error('Geçersiz JSON formatı');
        }

        logger.info(`Import tamamlandı: ${imported} eklendi, ${errors} hata`);
        return { imported, errors };
    }

    /**
     * CSV formatından toplu import
     * Beklenen başlık: firstName,lastName,dateOfBirth,gender,nationality,...
     */
    async importFromCSV(csvContent: string): Promise<{ imported: number; errors: number }> {
        let imported = 0;
        let errors = 0;

        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV dosyası en az bir başlık ve bir veri satırı içermeli');
        }

        // Başlık satırı
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Veri satırları
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i]);
                const record: Record<string, string> = {};

                headers.forEach((header, idx) => {
                    record[header] = values[idx] || '';
                });

                // Minimum gerekli alanlar
                if (!record.firstName || !record.lastName || !record.passportNumber) {
                    errors++;
                    continue;
                }

                await this.add({
                    firstName: record.firstName,
                    lastName: record.lastName,
                    dateOfBirth: record.dateOfBirth || '',
                    gender: (record.gender as 'male' | 'female') || 'male',
                    nationality: record.nationality || '',
                    placeOfBirth: record.placeOfBirth,
                    passportNumber: record.passportNumber,
                    passportIssueDate: record.passportIssueDate || '',
                    passportExpiryDate: record.passportExpiryDate || '',
                    passportIssuingAuthority: record.passportIssuingAuthority,
                    email: record.email || '',
                    phone: record.phone || '',
                    address: record.address,
                    city: record.city,
                    postalCode: record.postalCode,
                    country: record.country,
                    visaType: record.visaType,
                    travelPurpose: record.travelPurpose,
                    destinationCountry: record.destinationCountry,
                    notes: record.notes,
                });
                imported++;
            } catch {
                errors++;
            }
        }

        logger.info(`CSV import tamamlandı: ${imported} eklendi, ${errors} hata`);
        return { imported, errors };
    }

    /**
     * CSV satırını ayrıştır (tırnak içindeki virgülleri handle eder)
     */
    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    /**
     * Tüm başvuru sahiplerini JSON formatında dışa aktar
     */
    async exportToJSON(): Promise<string> {
        const applicantsArray = Array.from(this.applicants.values());
        return JSON.stringify(applicantsArray, null, 2);
    }

    /**
     * Tüm başvuru sahiplerini CSV formatında dışa aktar
     */
    async exportToCSV(): Promise<string> {
        const headers = [
            'firstName', 'lastName', 'dateOfBirth', 'gender', 'nationality',
            'placeOfBirth', 'passportNumber', 'passportIssueDate', 'passportExpiryDate',
            'passportIssuingAuthority', 'email', 'phone', 'address', 'city',
            'postalCode', 'country', 'visaType', 'travelPurpose', 'destinationCountry',
            'notes'
        ];

        const rows = [headers.join(',')];

        for (const applicant of this.applicants.values()) {
            const values = headers.map(h => {
                const val = String((applicant as any)[h] || '');
                // Virgül veya tırnak varsa tırnak içine al
                return val.includes(',') || val.includes('"')
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
            });
            rows.push(values.join(','));
        }

        return rows.join('\n');
    }

    // ─── İstatistikler ───────────────────────────────────────────

    /**
     * Toplam kişi sayısı
     */
    get count(): number {
        return this.applicants.size;
    }

    /**
     * Auto-fill kullanım sayacını artır
     */
    async incrementUsedCount(id: string): Promise<void> {
        const applicant = this.applicants.get(id);
        if (applicant) {
            applicant.usedCount += 1;
            applicant.updatedAt = new Date().toISOString();
            this.applicants.set(id, applicant);
            await this.saveApplicant(applicant);
        }
    }
}
