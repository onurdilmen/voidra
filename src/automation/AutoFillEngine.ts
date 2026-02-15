/**
 * VOIDRA — Auto-Fill Engine
 * 
 * Playwright sayfalarında VFS Global formlarını otomatik doldurur.
 * Her alan için akıllı selector eşleştirmesi yapar.
 * İnsan benzeri gecikme ve etkileşim simülasyonu uygular.
 */

import type { Page } from 'playwright';
import { Logger } from '@utils/Logger';
import { eventBus } from '@core/EventBus';
import { EVENTS } from '@utils/Constants';
import type { Applicant } from '@models/Applicant';

const logger = new Logger('AutoFill');

// Form alanı eşleştirme kuralları (VFS Global'e özel)
interface FieldMapping {
    // Alan için olası label/placeholder/name metinleri
    selectors: string[];
    // Başvuru sahibinden hangi alan kullanılacak
    applicantField: keyof Applicant;
    // Alan tipi (doldurma stratejisi belirler)
    type: 'text' | 'select' | 'date' | 'radio' | 'tel' | 'email';
}

// VFS Global form alanları eşleştirme haritası
const VFS_FIELD_MAPPINGS: FieldMapping[] = [
    // Kişisel bilgiler
    {
        selectors: ['first name', 'ad', 'name', 'given name', 'firstname', 'adı'],
        applicantField: 'firstName',
        type: 'text',
    },
    {
        selectors: ['last name', 'soyad', 'surname', 'family name', 'lastname', 'soyadı'],
        applicantField: 'lastName',
        type: 'text',
    },
    {
        selectors: ['date of birth', 'doğum tarihi', 'birth date', 'dob', 'birthday'],
        applicantField: 'dateOfBirth',
        type: 'date',
    },
    {
        selectors: ['gender', 'cinsiyet', 'sex'],
        applicantField: 'gender',
        type: 'select',
    },
    {
        selectors: ['nationality', 'uyruk', 'vatandaşlık', 'citizenship'],
        applicantField: 'nationality',
        type: 'select',
    },
    {
        selectors: ['place of birth', 'doğum yeri', 'birth place'],
        applicantField: 'placeOfBirth',
        type: 'text',
    },

    // Pasaport bilgileri
    {
        selectors: ['passport number', 'pasaport no', 'passport no', 'document number'],
        applicantField: 'passportNumber',
        type: 'text',
    },
    {
        selectors: ['issue date', 'veriliş tarihi', 'date of issue', 'passport issue'],
        applicantField: 'passportIssueDate',
        type: 'date',
    },
    {
        selectors: ['expiry date', 'bitiş tarihi', 'geçerlilik', 'valid until', 'date of expiry', 'expiration'],
        applicantField: 'passportExpiryDate',
        type: 'date',
    },
    {
        selectors: ['issuing authority', 'veren makam', 'issued by'],
        applicantField: 'passportIssuingAuthority',
        type: 'text',
    },

    // İletişim bilgileri
    {
        selectors: ['email', 'e-posta', 'e-mail', 'mail'],
        applicantField: 'email',
        type: 'email',
    },
    {
        selectors: ['phone', 'telefon', 'mobile', 'contact number', 'tel'],
        applicantField: 'phone',
        type: 'tel',
    },
    {
        selectors: ['address', 'adres', 'street'],
        applicantField: 'address',
        type: 'text',
    },
    {
        selectors: ['city', 'şehir', 'il'],
        applicantField: 'city',
        type: 'text',
    },
    {
        selectors: ['postal code', 'posta kodu', 'zip code', 'zip'],
        applicantField: 'postalCode',
        type: 'text',
    },
    {
        selectors: ['country', 'ülke'],
        applicantField: 'country',
        type: 'select',
    },
];

/**
 * İnsan benzeri rastgele gecikme (ms)
 */
function humanDelay(min = 80, max = 250): number {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Metni karakter karakter yaz (insan benzeri)
 */
async function humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await page.waitForTimeout(humanDelay(100, 300));

    // Mevcut değeri temizle
    await page.fill(selector, '');
    await page.waitForTimeout(humanDelay(50, 150));

    // Karakter karakter yaz
    for (const char of text) {
        await page.type(selector, char, { delay: humanDelay(30, 120) });
    }
}

/**
 * Sayfadaki form alanlarını tara ve eşleştir
 */
async function scanFormFields(page: Page): Promise<Map<string, string>> {
    const fieldMap = new Map<string, string>();

    // Tüm input, select ve textarea elemanlarını tara
    const fields = await page.evaluate(() => {
        const elements = document.querySelectorAll('input, select, textarea');
        const result: Array<{
            tagName: string;
            type: string;
            name: string;
            id: string;
            placeholder: string;
            label: string;
            selector: string;
        }> = [];

        elements.forEach((el) => {
            const htmlEl = el as HTMLInputElement;

            // Label ara — for attribute veya parent label
            let label = '';
            const labelEl = htmlEl.id
                ? document.querySelector(`label[for="${htmlEl.id}"]`)
                : null;

            if (labelEl) {
                label = labelEl.textContent?.trim() || '';
            } else {
                // Parent label kontrol
                const parentLabel = htmlEl.closest('label');
                if (parentLabel) {
                    label = parentLabel.textContent?.trim() || '';
                }
            }

            // Benzersiz selector oluştur
            let selector = '';
            if (htmlEl.id) selector = `#${htmlEl.id}`;
            else if (htmlEl.name) selector = `[name="${htmlEl.name}"]`;
            else selector = `${htmlEl.tagName.toLowerCase()}[placeholder="${htmlEl.placeholder || ''}"]`;

            result.push({
                tagName: htmlEl.tagName,
                type: htmlEl.type || 'text',
                name: htmlEl.name || '',
                id: htmlEl.id || '',
                placeholder: htmlEl.placeholder || '',
                label,
                selector,
            });
        });

        return result;
    });

    // VFS mapping kuralları ile eşleştir
    for (const field of fields) {
        const searchText = [field.label, field.placeholder, field.name, field.id]
            .join(' ')
            .toLowerCase();

        for (const mapping of VFS_FIELD_MAPPINGS) {
            const matched = mapping.selectors.some(s => searchText.includes(s.toLowerCase()));
            if (matched) {
                fieldMap.set(mapping.applicantField, field.selector);
                break;
            }
        }
    }

    return fieldMap;
}

/**
 * VFS Global formunu otomatik doldur
 */
export async function autoFillForm(
    page: Page,
    applicant: Applicant,
    profileId: string
): Promise<{ filled: number; total: number; errors: string[] }> {
    logger.info(`Auto-fill başlatılıyor: ${applicant.firstName} ${applicant.lastName}`);

    eventBus.emit(EVENTS.AUTOFILL_STARTED, {
        profileId,
        applicantId: applicant.id,
        applicantName: `${applicant.firstName} ${applicant.lastName}`,
    });

    const errors: string[] = [];
    let filled = 0;
    let total = 0;

    try {
        // 1. Sayfadaki form alanlarını tara
        const fieldMap = await scanFormFields(page);
        total = fieldMap.size;

        logger.info(`${total} form alanı eşleştirildi`);

        if (total === 0) {
            logger.warn('Hiçbir form alanı eşleştirilemedi');
            eventBus.emit(EVENTS.AUTOFILL_ERROR, {
                profileId,
                error: 'Form alanı bulunamadı',
            });
            return { filled: 0, total: 0, errors: ['Form alanı bulunamadı'] };
        }

        // 2. Her alanı doldur
        for (const [applicantField, selector] of fieldMap.entries()) {
            try {
                const value = String((applicant as unknown as Record<string, unknown>)[applicantField] || '');
                if (!value) continue;

                // İlgili mapping'i bul
                const mapping = VFS_FIELD_MAPPINGS.find(m => m.applicantField === applicantField);
                if (!mapping) continue;

                // Alan tipine göre doldur
                switch (mapping.type) {
                    case 'text':
                    case 'email':
                    case 'tel':
                        await humanType(page, selector, value);
                        break;

                    case 'date':
                        // Tarih formatını kontrol et ve doldur
                        await page.fill(selector, value);
                        break;

                    case 'select':
                        // Dropdown menüden seç
                        try {
                            await page.selectOption(selector, { label: value });
                        } catch {
                            // Label ile bulamazsa value ile dene
                            try {
                                await page.selectOption(selector, value);
                            } catch {
                                errors.push(`Select doldurulamadı: ${applicantField}`);
                                continue;
                            }
                        }
                        break;
                }

                filled++;
                await page.waitForTimeout(humanDelay(200, 500));

                logger.debug(`✓ ${applicantField}: "${value.substring(0, 20)}..."`);

            } catch (fieldError) {
                const errMsg = `Alan doldurulamadı: ${applicantField} — ${fieldError}`;
                errors.push(errMsg);
                logger.warn(errMsg);
            }
        }

        logger.info(`Auto-fill tamamlandı: ${filled}/${total} alan dolduruldu`);

        eventBus.emit(EVENTS.AUTOFILL_COMPLETED, {
            profileId,
            applicantId: applicant.id,
            filled,
            total,
            errors,
        });

    } catch (err) {
        logger.error('Auto-fill hatası', err);
        eventBus.emit(EVENTS.AUTOFILL_ERROR, {
            profileId,
            error: String(err),
        });
        errors.push(String(err));
    }

    return { filled, total, errors };
}

/**
 * Form alanlarını sadece tara (doldurma) — debug amaçlı
 */
export async function scanForm(page: Page): Promise<Map<string, string>> {
    return await scanFormFields(page);
}
