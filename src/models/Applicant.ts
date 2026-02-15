/**
 * VOIDRA — Başvuru Sahibi Modeli
 * VFS formları için kişi bilgileri veri yapısı
 * Hassas veriler AES-256 ile şifrelenir
 */

// Başvuru sahibi veri modeli
export interface Applicant {
    id: string;

    // Kişisel bilgiler
    firstName: string;
    lastName: string;
    dateOfBirth: string;        // YYYY-MM-DD
    gender: 'male' | 'female';
    nationality: string;        // ISO 3166-1 alpha-2 ülke kodu (TR, DE, FR...)
    placeOfBirth: string;

    // Pasaport bilgileri
    passportNumber: string;
    passportIssueDate: string;  // YYYY-MM-DD
    passportExpiryDate: string; // YYYY-MM-DD
    passportIssuingAuthority: string;

    // İletişim bilgileri
    email: string;
    phone: string;              // Uluslararası format: +90 555 123 4567
    address: string;
    city: string;
    postalCode: string;
    country: string;            // ISO 3166-1 alpha-2

    // VFS Başvuru bilgileri
    visaType: string;           // Turist, İş, Eğitim, vb.
    travelPurpose: string;
    destinationCountry: string; // ISO 3166-1 alpha-2
    intendedArrivalDate?: string;
    intendedDepartureDate?: string;

    // Ek notlar
    notes: string;

    // Meta veriler
    createdAt: string;          // ISO 8601
    updatedAt: string;          // ISO 8601
    usedCount: number;          // Kaç kez auto-fill'de kullanıldı
}

// Başvuru sahibi ekleme parametreleri
export interface CreateApplicantParams {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'male' | 'female';
    nationality: string;
    placeOfBirth?: string;

    passportNumber: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    passportIssuingAuthority?: string;

    email: string;
    phone: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;

    visaType?: string;
    travelPurpose?: string;
    destinationCountry?: string;
    intendedArrivalDate?: string;
    intendedDepartureDate?: string;

    notes?: string;
}

// Başvuru sahibi güncelleme parametreleri
export type UpdateApplicantParams = Partial<CreateApplicantParams>;

// Başvuru sahibi özet (listeleme için)
export interface ApplicantSummary {
    id: string;
    firstName: string;
    lastName: string;
    passportNumber: string;
    email: string;
    phone: string;
    nationality: string;
    destinationCountry: string;
    usedCount: number;
}
