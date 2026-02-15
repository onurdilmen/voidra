/**
 * VOIDRA — Başvuru Havuzu (Data Pool) Sayfası
 * 
 * Başvuru sahiplerini yönetir: ekleme, düzenleme, silme
 * CSV/JSON import/export desteği
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Users, Plus, Search, Download, Upload, Trash2,
    Edit3, Eye, Mail, Phone, MapPin, FileText,
    ChevronDown, X, AlertCircle, CheckCircle, Globe
} from 'lucide-react';

// Başvuru sahibi özet tipi (listede gösterilecek)
interface ApplicantSummary {
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

// Tam detaylı başvuru sahibi
interface ApplicantFull {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    placeOfBirth: string;
    passportNumber: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    passportIssuingAuthority: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    visaType: string;
    travelPurpose: string;
    destinationCountry: string;
    intendedArrivalDate?: string;
    intendedDepartureDate?: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
    usedCount: number;
}

// Boş form verisi
const emptyForm: {
    firstName: string; lastName: string; dateOfBirth: string;
    gender: 'male' | 'female'; nationality: string; placeOfBirth: string;
    passportNumber: string; passportIssueDate: string; passportExpiryDate: string;
    passportIssuingAuthority: string; email: string; phone: string;
    address: string; city: string; postalCode: string; country: string;
    visaType: string; travelPurpose: string; destinationCountry: string;
    intendedArrivalDate: string; intendedDepartureDate: string; notes: string;
} = {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    nationality: '',
    placeOfBirth: '',
    passportNumber: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    passportIssuingAuthority: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    visaType: '',
    travelPurpose: '',
    destinationCountry: '',
    intendedArrivalDate: '',
    intendedDepartureDate: '',
    notes: '',
};

export default function DataPool() {
    const [applicants, setApplicants] = useState<ApplicantSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedApplicant, setSelectedApplicant] = useState<ApplicantFull | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Kişileri yükle
    const loadApplicants = useCallback(async () => {
        try {
            const result = await window.voidra?.pool.list();
            if (result?.success && result.data) {
                setApplicants(result.data);
            }
        } catch (err) {
            console.error('Veri havuzu yüklenemedi:', err);
        }
    }, []);

    useEffect(() => {
        loadApplicants();
        const cleanup = window.voidra?.onEvent((payload: { event: string }) => {
            if (payload.event.startsWith('pool:')) {
                loadApplicants();
            }
        });
        return () => { cleanup?.(); };
    }, [loadApplicants]);

    // Bildirim göster
    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    // Yeni kişi ekle
    const handleAdd = async () => {
        if (!formData.firstName || !formData.lastName || !formData.passportNumber) {
            showNotification('error', 'Ad, soyad ve pasaport numarası zorunlu!');
            return;
        }
        setLoading(true);
        try {
            const result = await window.voidra?.pool.add(formData);
            if (result?.success) {
                showNotification('success', 'Kişi eklendi ✓');
                setShowAddModal(false);
                setFormData(emptyForm);
                await loadApplicants();
            } else {
                showNotification('error', result?.error || 'Ekleme başarısız');
            }
        } catch (err) {
            showNotification('error', 'Hata: ' + String(err));
        } finally {
            setLoading(false);
        }
    };

    // Kişi güncelle
    const handleUpdate = async () => {
        if (!editingId) return;
        setLoading(true);
        try {
            const result = await window.voidra?.pool.update(editingId, formData);
            if (result?.success) {
                showNotification('success', 'Kişi güncellendi ✓');
                setShowAddModal(false);
                setEditingId(null);
                setFormData(emptyForm);
                await loadApplicants();
            } else {
                showNotification('error', result?.error || 'Güncelleme başarısız');
            }
        } catch (err) {
            showNotification('error', 'Hata: ' + String(err));
        } finally {
            setLoading(false);
        }
    };

    // Kişi sil
    const handleDelete = async (id: string) => {
        try {
            const result = await window.voidra?.pool.delete(id);
            if (result?.success) {
                showNotification('success', 'Kişi silindi');
                await loadApplicants();
            }
        } catch (err) {
            showNotification('error', 'Silme hatası');
        }
    };

    // Detay görüntüle
    const handleViewDetail = async (id: string) => {
        try {
            const result = await window.voidra?.pool.get(id);
            if (result?.success && result.data) {
                setSelectedApplicant(result.data);
                setShowDetailModal(true);
            }
        } catch (err) {
            showNotification('error', 'Detay yüklenemedi');
        }
    };

    // Düzenleme modalını aç
    const handleEdit = async (id: string) => {
        try {
            const result = await window.voidra?.pool.get(id);
            if (result?.success && result.data) {
                setFormData({
                    firstName: result.data.firstName || '',
                    lastName: result.data.lastName || '',
                    dateOfBirth: result.data.dateOfBirth || '',
                    gender: result.data.gender || 'male',
                    nationality: result.data.nationality || '',
                    placeOfBirth: result.data.placeOfBirth || '',
                    passportNumber: result.data.passportNumber || '',
                    passportIssueDate: result.data.passportIssueDate || '',
                    passportExpiryDate: result.data.passportExpiryDate || '',
                    passportIssuingAuthority: result.data.passportIssuingAuthority || '',
                    email: result.data.email || '',
                    phone: result.data.phone || '',
                    address: result.data.address || '',
                    city: result.data.city || '',
                    postalCode: result.data.postalCode || '',
                    country: result.data.country || '',
                    visaType: result.data.visaType || '',
                    travelPurpose: result.data.travelPurpose || '',
                    destinationCountry: result.data.destinationCountry || '',
                    intendedArrivalDate: result.data.intendedArrivalDate || '',
                    intendedDepartureDate: result.data.intendedDepartureDate || '',
                    notes: result.data.notes || '',
                });
                setEditingId(id);
                setShowAddModal(true);
            }
        } catch (err) {
            showNotification('error', 'Detay yüklenemedi');
        }
    };

    // Import
    const handleImport = async () => {
        try {
            const result = await window.voidra?.pool.import();
            if (result?.success && result.data) {
                showNotification('success', `${result.data.imported} kişi eklendi${result.data.errors > 0 ? `, ${result.data.errors} hata` : ''}`);
                await loadApplicants();
            } else if (result?.error !== 'İptal edildi') {
                showNotification('error', result?.error || 'Import başarısız');
            }
        } catch (err) {
            showNotification('error', 'Import hatası');
        }
    };

    // Export
    const handleExport = async (format: 'json' | 'csv') => {
        setShowExportMenu(false);
        try {
            const result = await window.voidra?.pool.export(format);
            if (result?.success) {
                showNotification('success', `${format.toUpperCase()} olarak dışa aktarıldı ✓`);
            } else if (result?.error !== 'İptal edildi') {
                showNotification('error', result?.error || 'Export başarısız');
            }
        } catch (err) {
            showNotification('error', 'Export hatası');
        }
    };

    // Arama filtresi
    const filtered = applicants.filter(a => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            a.firstName.toLowerCase().includes(q) ||
            a.lastName.toLowerCase().includes(q) ||
            a.passportNumber.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q) ||
            a.nationality.toLowerCase().includes(q)
        );
    });

    return (
        <div className="animate-fadeIn">
            {/* Bildirim */}
            {notification && (
                <div className={`pool-notification pool-notification--${notification.type}`}>
                    {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Sayfa Başlığı */}
            <div className="page-header">
                <h1 className="page-header__title">Başvuru Havuzu</h1>
                <p className="page-header__subtitle">
                    VFS form otomatik doldurma için başvuru sahibi verileri
                </p>
            </div>

            {/* Araç Çubuğu */}
            <div className="pool-toolbar">
                <div className="pool-toolbar__search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="İsim, pasaport, email ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="pool-toolbar__actions">
                    <button className="btn btn--ghost" onClick={handleImport}>
                        <Upload size={14} /> İçe Aktar
                    </button>
                    <div className="pool-export-wrapper">
                        <button
                            className="btn btn--ghost"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            disabled={applicants.length === 0}
                        >
                            <Download size={14} /> Dışa Aktar <ChevronDown size={12} />
                        </button>
                        {showExportMenu && (
                            <div className="pool-export-menu">
                                <button onClick={() => handleExport('json')}>
                                    <FileText size={14} /> JSON
                                </button>
                                <button onClick={() => handleExport('csv')}>
                                    <FileText size={14} /> CSV
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        className="btn btn--primary"
                        onClick={() => { setFormData(emptyForm); setEditingId(null); setShowAddModal(true); }}
                    >
                        <Plus size={14} /> Kişi Ekle
                    </button>
                </div>
            </div>

            {/* Kişi Listesi */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <Users className="empty-state__icon" />
                    <h3 className="empty-state__title">
                        {searchQuery ? 'Sonuç bulunamadı' : 'Havuzda kişi yok'}
                    </h3>
                    <p className="empty-state__description">
                        {searchQuery
                            ? 'Arama terimlerinizi değiştirmeyi deneyin.'
                            : 'Başvuru sahiplerini ekleyin veya CSV/JSON dosyasından içe aktarın.'
                        }
                    </p>
                    {!searchQuery && (
                        <button className="btn btn--primary" onClick={() => { setFormData(emptyForm); setEditingId(null); setShowAddModal(true); }}>
                            <Plus size={14} /> İlk Kişiyi Ekle
                        </button>
                    )}
                </div>
            ) : (
                <div className="pool-grid animate-stagger">
                    {filtered.map((person) => (
                        <div key={person.id} className="pool-card glass-card">
                            <div className="pool-card__header">
                                <div className="pool-card__avatar">
                                    {person.firstName.charAt(0)}{person.lastName.charAt(0)}
                                </div>
                                <div className="pool-card__info">
                                    <h3 className="pool-card__name">
                                        {person.firstName} {person.lastName}
                                    </h3>
                                    <span className="pool-card__passport">
                                        <FileText size={12} /> {person.passportNumber}
                                    </span>
                                </div>
                                <div className="pool-card__badge">
                                    {person.usedCount > 0 && (
                                        <span className="badge badge--active">
                                            {person.usedCount}× kullanıldı
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="pool-card__details">
                                {person.email && (
                                    <div className="pool-card__detail">
                                        <Mail size={13} /> <span>{person.email}</span>
                                    </div>
                                )}
                                {person.phone && (
                                    <div className="pool-card__detail">
                                        <Phone size={13} /> <span>{person.phone}</span>
                                    </div>
                                )}
                                {person.nationality && (
                                    <div className="pool-card__detail">
                                        <Globe size={13} /> <span>{person.nationality}</span>
                                    </div>
                                )}
                                {person.destinationCountry && (
                                    <div className="pool-card__detail">
                                        <MapPin size={13} /> <span>→ {person.destinationCountry}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pool-card__actions">
                                <button
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => handleViewDetail(person.id)}
                                    title="Detay Görüntüle"
                                >
                                    <Eye size={13} />
                                </button>
                                <button
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => handleEdit(person.id)}
                                    title="Düzenle"
                                >
                                    <Edit3 size={13} />
                                </button>
                                <button
                                    className="btn btn--danger btn--sm"
                                    onClick={() => handleDelete(person.id)}
                                    title="Sil"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Ekleme / Düzenleme Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingId(null); }}>
                    <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Kişi Düzenle' : 'Yeni Kişi Ekle'}</h2>
                            <button className="modal-close" onClick={() => { setShowAddModal(false); setEditingId(null); }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="modal-body modal-body--scroll">
                            {/* Kişisel Bilgiler */}
                            <div className="form-section">
                                <h3 className="form-section__title">Kişisel Bilgiler</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Ad *</label>
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            placeholder="Adı"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Soyad *</label>
                                        <input
                                            type="text"
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            placeholder="Soyadı"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Doğum Tarihi</label>
                                        <input
                                            type="date"
                                            value={formData.dateOfBirth}
                                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Cinsiyet</label>
                                        <select
                                            value={formData.gender}
                                            onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                                        >
                                            <option value="male">Erkek</option>
                                            <option value="female">Kadın</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Uyruk</label>
                                        <input
                                            type="text"
                                            value={formData.nationality}
                                            onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                            placeholder="Ör: Turkish"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Doğum Yeri</label>
                                        <input
                                            type="text"
                                            value={formData.placeOfBirth}
                                            onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
                                            placeholder="Ör: Istanbul"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pasaport Bilgileri */}
                            <div className="form-section">
                                <h3 className="form-section__title">Pasaport Bilgileri</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Pasaport No *</label>
                                        <input
                                            type="text"
                                            value={formData.passportNumber}
                                            onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                                            placeholder="Ör: U12345678"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Veriliş Tarihi</label>
                                        <input
                                            type="date"
                                            value={formData.passportIssueDate}
                                            onChange={(e) => setFormData({ ...formData, passportIssueDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Bitiş Tarihi</label>
                                        <input
                                            type="date"
                                            value={formData.passportExpiryDate}
                                            onChange={(e) => setFormData({ ...formData, passportExpiryDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Veren Makam</label>
                                        <input
                                            type="text"
                                            value={formData.passportIssuingAuthority}
                                            onChange={(e) => setFormData({ ...formData, passportIssuingAuthority: e.target.value })}
                                            placeholder="Ör: Nüfus Müdürlüğü"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* İletişim Bilgileri */}
                            <div className="form-section">
                                <h3 className="form-section__title">İletişim Bilgileri</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="ornek@mail.com"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Telefon</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+90 5XX XXX XXXX"
                                        />
                                    </div>
                                    <div className="form-group form-group--full">
                                        <label>Adres</label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="Sokak ve mahalle"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Şehir</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Posta Kodu</label>
                                        <input
                                            type="text"
                                            value={formData.postalCode}
                                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Ülke</label>
                                        <input
                                            type="text"
                                            value={formData.country}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                            placeholder="Ör: Türkiye"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seyahat Bilgileri */}
                            <div className="form-section">
                                <h3 className="form-section__title">Seyahat Bilgileri</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Vize Türü</label>
                                        <input
                                            type="text"
                                            value={formData.visaType}
                                            onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
                                            placeholder="Ör: Schengen"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Seyahat Amacı</label>
                                        <input
                                            type="text"
                                            value={formData.travelPurpose}
                                            onChange={(e) => setFormData({ ...formData, travelPurpose: e.target.value })}
                                            placeholder="Ör: Tourism"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Hedef Ülke</label>
                                        <input
                                            type="text"
                                            value={formData.destinationCountry}
                                            onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
                                            placeholder="Ör: Germany"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Gidiş Tarihi</label>
                                        <input
                                            type="date"
                                            value={formData.intendedArrivalDate}
                                            onChange={(e) => setFormData({ ...formData, intendedArrivalDate: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Dönüş Tarihi</label>
                                        <input
                                            type="date"
                                            value={formData.intendedDepartureDate}
                                            onChange={(e) => setFormData({ ...formData, intendedDepartureDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notlar */}
                            <div className="form-section">
                                <h3 className="form-section__title">Notlar</h3>
                                <div className="form-group form-group--full">
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Ek notlar..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn--ghost" onClick={() => { setShowAddModal(false); setEditingId(null); }}>
                                İptal
                            </button>
                            <button
                                className="btn btn--primary"
                                onClick={editingId ? handleUpdate : handleAdd}
                                disabled={loading}
                            >
                                {loading ? '...' : editingId ? 'Güncelle' : 'Ekle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detay Modal */}
            {showDetailModal && selectedApplicant && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedApplicant.firstName} {selectedApplicant.lastName}</h2>
                            <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body modal-body--scroll">
                            <div className="detail-grid">
                                <DetailRow label="Ad" value={selectedApplicant.firstName} />
                                <DetailRow label="Soyad" value={selectedApplicant.lastName} />
                                <DetailRow label="Doğum Tarihi" value={selectedApplicant.dateOfBirth} />
                                <DetailRow label="Cinsiyet" value={selectedApplicant.gender === 'male' ? 'Erkek' : 'Kadın'} />
                                <DetailRow label="Uyruk" value={selectedApplicant.nationality} />
                                <DetailRow label="Doğum Yeri" value={selectedApplicant.placeOfBirth} />
                                <DetailRow label="Pasaport No" value={selectedApplicant.passportNumber} highlight />
                                <DetailRow label="Pasaport Veriliş" value={selectedApplicant.passportIssueDate} />
                                <DetailRow label="Pasaport Bitiş" value={selectedApplicant.passportExpiryDate} />
                                <DetailRow label="Veren Makam" value={selectedApplicant.passportIssuingAuthority} />
                                <DetailRow label="Email" value={selectedApplicant.email} />
                                <DetailRow label="Telefon" value={selectedApplicant.phone} />
                                <DetailRow label="Adres" value={selectedApplicant.address} full />
                                <DetailRow label="Şehir" value={selectedApplicant.city} />
                                <DetailRow label="Posta Kodu" value={selectedApplicant.postalCode} />
                                <DetailRow label="Ülke" value={selectedApplicant.country} />
                                <DetailRow label="Vize Türü" value={selectedApplicant.visaType} />
                                <DetailRow label="Seyahat Amacı" value={selectedApplicant.travelPurpose} />
                                <DetailRow label="Hedef Ülke" value={selectedApplicant.destinationCountry} />
                                <DetailRow label="Kullanım" value={`${selectedApplicant.usedCount} kez`} />
                                {selectedApplicant.notes && (
                                    <DetailRow label="Notlar" value={selectedApplicant.notes} full />
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn--ghost" onClick={() => setShowDetailModal(false)}>
                                Kapat
                            </button>
                            <button className="btn btn--primary" onClick={() => {
                                setShowDetailModal(false);
                                handleEdit(selectedApplicant.id);
                            }}>
                                <Edit3 size={14} /> Düzenle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Detay satırı bileşeni
function DetailRow({ label, value, highlight, full }: {
    label: string;
    value: string;
    highlight?: boolean;
    full?: boolean;
}) {
    if (!value) return null;
    return (
        <div className={`detail-row ${full ? 'detail-row--full' : ''}`}>
            <span className="detail-row__label">{label}</span>
            <span className={`detail-row__value ${highlight ? 'detail-row__value--highlight' : ''}`}>
                {value}
            </span>
        </div>
    );
}
