# 🗺️ VOIDRA — Geliştirme Yol Haritası

> Son Güncelleme: 2026-02-13
> Durum: 🔴 Başlangıç Aşaması
> Mimari: **Konsept B — Özel Anti-Detect Tarayıcı**

---

## 📋 Genel Bakış

VOIDRA, kullanıcının kendi elleriyle internette gezinebildiği, her profilde farklı
dijital kimlik taşıyan özel bir anti-detect tarayıcıdır. Geliştirme 7 ana aşamadan
oluşmaktadır.

> **Önemli Mimari Karar:**
> - Electron = Kontrol paneli (profil yönetimi, havuz, ayarlar)
> - Playwright (`channel: 'msedge'`) = Tarayıcı pencerelerini açar
> - Kullanıcı = Playwright pencerelerinde serbest gezinir
> - Bundled Chromium KULLANILMAZ → Sistem Edge/Chrome kullanılır

---

## Aşama 1: Proje İskeleti ve Electron Kabuğu 🔴
**Tahmini Süre:** 2 gün
**Durum:** Başlanmadı
**Dosyalar:** `package.json`, `tsconfig.json`, `src/ui/main/main.ts`, `src/ui/renderer/`

### Hedefler
- [ ] Proje iskeletini kur (Electron + Vite + React + TypeScript)
- [ ] `electron-vite` ile geliştirme ortamı yapılandırması
- [ ] Electron penceresi — temel kontrol paneli kabuğu
  - [ ] Glassmorphism temalı ana layout
  - [ ] Sidebar navigasyon (Dashboard, Profiller, Havuz, Ayarlar)
  - [ ] Sistem tray ikonu
- [ ] IPC iletişim altyapısı (main ↔ renderer)
- [ ] `EventBus` modülü (modüller arası iletişim)
- [ ] `Logger` yardımcı sınıfı (renkli konsol çıktısı)
- [ ] Temel sabitler ve konfigürasyon yapısı

### Başarı Kriterleri
- Electron uygulaması açılıyor, glassmorphism temalı kontrol paneli görünüyor
- Sidebar navigasyonu çalışıyor
- IPC mesajları main ↔ renderer arasında iletilebiliyor

---

## Aşama 2: Profil Yönetimi ve Browser Launch 🔴
**Tahmini Süre:** 2 gün
**Durum:** Başlanmadı
**Dosyalar:** `ProfileManager.ts`, `SessionManager.ts`, `Profile.ts`

### Hedefler
- [ ] `Profile` veri modelini tanımla (interface + type'lar)
- [ ] `ProfileManager` sınıfını yaz
  - [ ] Profil oluşturma (create)
  - [ ] Profil listeleme (list)
  - [ ] Profil silme (delete)
  - [ ] Profil güncelleme (update)
- [ ] `SessionManager` sınıfını yaz
  - [ ] `playwright.chromium.launch({ channel: 'msedge' })` ile Edge penceresi açma
  - [ ] Fallback: `channel: 'chrome'` (Edge yoksa Chrome dene)
  - [ ] Profil bazlı `BrowserContext` oluşturma
  - [ ] `storageState` ile çerez/localStorage kalıcılığı
  - [ ] Profil kapatıldığında state'i diske kaydetme
  - [ ] Profil açıldığında state'i diskten geri yükleme
- [ ] UI: Profil kartları sayfası
  - [ ] Profil oluşturma modal'ı
  - [ ] Profil listesi (glassmorphism kartlar)
  - [ ] "Profili Aç" / "Kapat" butonları
  - [ ] Profil durumu göstergeleri (aktif/pasif)

### Başarı Kriterleri
- UI'dan "Profili Aç" → Gerçek Edge penceresi açılıyor
- Kullanıcı bu pencerede serbest gezinebiliyor
- Profil A ve Profil B farklı çerez deposuna sahip (izolasyon kanıtı)
- Profil kapatılıp açıldığında çerezler korunuyor (kalıcılık kanıtı)
- Edge bulunamazsa Chrome'a düşüyor, ikisi de yoksa hata veriyor

---

## Aşama 3: Parmak İzi Tutarlılığı 🔴
**Tahmini Süre:** 2 gün
**Durum:** Başlanmadı
**Dosyalar:** `FingerprintManager.ts`, `Fingerprint.ts`, `fingerprint-inject.ts`

### Hedefler
- [ ] `Fingerprint` veri modelini tanımla
  - [ ] UserAgent, Viewport, Locale, Timezone, Platform
  - [ ] WebGL Renderer, Hardware Concurrency, Device Memory
  - [ ] Canvas/Audio fingerprint noise seed
- [ ] `FingerprintManager` sınıfını yaz
  - [ ] Yeni profil için tutarlı fingerprint üretimi
  - [ ] Fingerprint'i profile bağlama ve JSON'a kaydetme
  - [ ] Profil açıldığında aynı fingerprint'i yükleme (ASLA değişmemeli!)
  - [ ] BrowserContext'e fingerprint uygulama (addInitScript ile)
- [ ] `fingerprint-inject.ts` — Tarayıcıya enjekte edilecek script
  - [ ] `navigator.webdriver` → `undefined`
  - [ ] `navigator.plugins` → gerçekçi plugin listesi
  - [ ] `navigator.languages` → locale ile uyumlu
  - [ ] `screen.width/height` → viewport ile uyumlu
  - [ ] WebGL renderer/vendor override
  - [ ] Canvas fingerprint gürültü enjeksiyonu
- [ ] UA/Viewport/Platform kombinasyon tutarlılığı
  - [ ] Windows UA + macOS platform → YASAK
  - [ ] Mobil UA + masaüstü viewport → YASAK

### Başarı Kriterleri
- creepjs.com veya browserleaks.com'da tutarlı fingerprint görünüyor
- bot.sannysoft.com'da tüm testler yeşil
- Aynı profil 10 kez açılıp kapatılınca fingerprint değişmiyor
- Farklı profillerin fingerprint'leri birbirinden farklı

---

## Aşama 4: Ağ ve Proxy Yönetimi 🔴
**Tahmini Süre:** 1 gün
**Durum:** Başlanmadı
**Dosyalar:** `NetworkManager.ts`

### Hedefler
- [ ] `NetworkManager` sınıfını yaz
  - [ ] Profil bazlı proxy atama (HTTP/HTTPS/SOCKS5)
  - [ ] Proxy kimlik doğrulama (username:password)
  - [ ] Proxy sağlık kontrolü (bağlantı testi)
  - [ ] Proxy rotasyonu desteği
- [ ] Ağ filtreleme kuralları (opsiyonel, hız için)
  - [ ] Gereksiz medya isteklerini engelle
  - [ ] ⚠️ WAF script'lerini ENGELLEME (Cloudflare, ReCaptcha)
- [ ] UI: Proxy ayarları sayfası
  - [ ] Proxy listesi yönetimi (ekleme/silme/test)
  - [ ] Profil-proxy eşleştirme

### Başarı Kriterleri
- Profil A farklı IP, Profil B farklı IP gösteriyor
- Proxy bağlantı testi çalışıyor
- WAF challenge'ları düzgün çalışıyor (engellenmemiş)

---

## Aşama 5: Başvuru Havuzu ve Auto-Fill 🔴
**Tahmini Süre:** 3 gün
**Durum:** Başlanmadı
**Dosyalar:** `DataPoolManager.ts`, `AutoFillEngine.ts`, `FormDetector.ts`, `Applicant.ts`

### Hedefler
- [ ] `Applicant` veri modelini tanımla
  - [ ] Kişisel bilgiler (ad, soyad, doğum tarihi, uyruk, cinsiyet)
  - [ ] Pasaport bilgileri (numara, veriliş/bitiş tarihi, veren makam)
  - [ ] İletişim bilgileri (email, telefon, adres)
  - [ ] VFS özel bilgiler (randevu kategorisi, vize türü, seyahat tarihi)
- [ ] `DataPoolManager` sınıfını yaz
  - [ ] Başvuru sahibi CRUD (oluşturma/okuma/güncelleme/silme)
  - [ ] Toplu veri import (CSV/JSON)
  - [ ] Veri export
  - [ ] Şifreli depolama (AES-256)
- [ ] `FormDetector` — Tarayıcıya enjekte edilecek content script
  - [ ] MutationObserver ile DOM değişikliklerini izleme
  - [ ] VFS form pattern eşleştirme (input name, label text, placeholder)
  - [ ] Form algılandığında Electron'a IPC ile bildirim
- [ ] `AutoFillEngine` — Form doldurma motoru
  - [ ] Form alanlarını başvuru verileriyle eşleştirme
  - [ ] İnsansı hızda metin girişi
  - [ ] Select/dropdown seçimi
  - [ ] Tarih alanları (datepicker) doldurma
  - [ ] Checkbox/radio button seçimi
- [ ] UI: Başvuru Havuzu sayfası
  - [ ] Başvuru sahibi kartları/tablo görünümü
  - [ ] Yeni başvuru sahibi ekleme formu
  - [ ] CSV import butonu
  - [ ] Auto-fill butonları (tarayıcı penceresinde form algılandığında aktif)

### Başarı Kriterleri
- Havuza kişi eklenebiliyor, düzenlenebiliyor, silinebiliyor
- VFS formuna gidildiğinde auto-fill butonu otomatik aktif oluyor
- "Doldur" butonuna basınca form insansı hızda dolduruluyor
- Tüm VFS form alanları (text, select, date) doğru eşleştiriliyor

---

## Aşama 6: İnsansı Etkileşim Motoru 🔴
**Tahmini Süre:** 2 gün
**Durum:** Başlanmadı
**Dosyalar:** `HumanInteraction.ts`

### Hedefler
- [ ] `typeLikeHuman(locator, text)` — İnsansı klavye girişi
  - [ ] Karakter karakter yazma (80-150ms arası rastgele gecikme)
  - [ ] Yazma hızı varyasyonu
  - [ ] Occasional typo + backspace simülasyonu (opsiyonel)
- [ ] `clickLikeHuman(locator)` — İnsansı tıklama
  - [ ] Hover → bekleme → click pattern'i
  - [ ] Tıklama öncesi kısa bekleme (100-300ms)
- [ ] `scrollLikeHuman(page)` — İnsansı kaydırma
  - [ ] Smooth scroll animasyonu
  - [ ] Rastgele duraklamalar
- [ ] Mouse hareket simülasyonu
  - [ ] Bezier curve tabanlı doğal mouse hareketi

### Başarı Kriterleri
- Cloudflare behavioral analysis'e takılmıyor
- Form doldurma süreleri insan tempolarına uygun
- Mouse hareketleri doğal eğriler çiziyor

---

## Aşama 7: Paketleme ve Dağıtım 🔴
**Tahmini Süre:** 1-2 gün
**Durum:** Başlanmadı
**Dosyalar:** `electron-builder.yml`, CI/CD scripts

### Hedefler
- [ ] `electron-builder` konfigürasyonu
  - [ ] Windows `.exe` installer (NSIS)
  - [ ] Windows portable `.zip`
  - [ ] macOS `.dmg` disk image
- [ ] Uygulama ikonu ve splash screen
- [ ] Otomatik güncelleme sistemi (`electron-updater`)
- [ ] Kod imzalama (opsiyonel)
  - [ ] Windows: EV Code Signing Certificate
  - [ ] macOS: Apple Developer notarization

### Başarı Kriterleri
- Windows'ta `.exe` installer çalışıyor
- macOS'ta `.dmg` açılıyor
- Uygulama boyutu < 150 MB
- Edge/Chrome bulunamazsa anlamlı hata mesajı

---

## 🔮 Gelecek Vizyonu (Post v1.0)

| Özellik | Açıklama | Öncelik |
|---------|----------|---------|
| Telegram Bot | Randevu bulunduğunda Telegram bildirimi | Yüksek |
| Discord Webhook | Discord kanalına anlık bildirim | Orta |
| Captcha Çözücü | 2Captcha/Anti-Captcha entegrasyonu | Yüksek |
| Randevu Avcısı | Otomatik randevu arama + yakalama motoru | Yüksek |
| Multi-Site | iDATA, TLSContact gibi diğer platformlar | Orta |
| Profil Marketplace | Hazır profil şablonları paylaşımı | Düşük |
| AI Davranış Motoru | ML tabanlı insan davranışı öğrenme | Düşük |
| OCR Entegrasyonu | Pasaport tarama → otomatik havuza ekleme | Orta |

---

## 📊 İlerleme Özeti

| Aşama | Durum | İlerleme |
|-------|-------|----------|
| 1. Proje İskeleti + Electron | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |
| 2. Profil Yönetimi + Browser | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |
| 3. Parmak İzi Tutarlılığı | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |
| 4. Ağ ve Proxy Yönetimi | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |
| 5. Başvuru Havuzu + Auto-Fill | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |
| 6. İnsansı Etkileşim Motoru | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |
| 7. Paketleme + Dağıtım | 🔴 Başlanmadı | ░░░░░░░░░░ 0% |

**Genel İlerleme: ░░░░░░░░░░ 0%**
