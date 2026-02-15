# 🏗️ VOIDRA — Mimari Dokümantasyon

> Son Güncelleme: 2026-02-13
> Mimari: **Konsept B — Özel Anti-Detect Tarayıcı**

---

## 1. Üst Düzey Mimari

VOIDRA, kullanıcının **kendi elleriyle** internette gezinebildiği, her profilde farklı
dijital kimlik taşıyan özel bir anti-detect tarayıcıdır. Otomasyon özellikleri
(auto-fill, form algılama) kullanıcının isteğine bağlı olarak devreye girer.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VOIDRA APPLICATION                           │
│                      (Electron Desktop App)                         │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    KONTROL PANELİ (React UI)                  │  │
│  │                                                               │  │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │ Dashboard│ │   Profiller  │ │  Başvuru  │ │   Ayarlar  │  │  │
│  │  │          │ │              │ │  Havuzu   │ │            │  │  │
│  │  │ Metrikler│ │ Oluştur/Sil │ │ Kişi CRUD │ │ Proxy List │  │  │
│  │  │ Timeline │ │ Fingerprint │ │ Pasaport  │ │ Bildirimler│  │  │
│  │  │ Durum    │ │ Proxy Atama │ │ İletişim  │ │ Tema       │  │  │
│  │  └──────────┘ └──────┬───────┘ └─────┬────┘ └────────────┘  │  │
│  └──────────────────────┼───────────────┼────────────────────────┘  │
│                         │               │                           │
│                    "Profili Aç"    "Havuzdan Doldur"                │
│                         │               │                           │
│  ┌──────────────────────▼───────────────▼────────────────────────┐  │
│  │                   VOIDRA ENGINE (Core)                         │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │   Profile     │  │  Fingerprint │  │     Network       │   │  │
│  │  │   Manager     │  │  Manager     │  │     Manager       │   │  │
│  │  │              │  │              │  │                   │   │  │
│  │  │ • CRUD       │  │ • Üretim     │  │ • Proxy atama     │   │  │
│  │  │ • Yaşam      │  │ • Kalıcılık  │  │ • Ağ filtreleme   │   │  │
│  │  │   döngüsü   │  │ • Tutarlılık │  │ • İstek yönetimi  │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │   Session     │  │  DataPool    │  │   AutoFill        │   │  │
│  │  │   Manager     │  │  Manager     │  │   Engine          │   │  │
│  │  │              │  │              │  │                   │   │  │
│  │  │ • Browser    │  │ • Kişi CRUD  │  │ • Form algılama   │   │  │
│  │  │   launch     │  │ • Veri import│  │ • Alan eşleştirme │   │  │
│  │  │ • Context    │  │ • Veri export│  │ • Otomatik dolum  │   │  │
│  │  │   yönetimi   │  │ • Havuz      │  │ • İnsansı yazma   │   │  │
│  │  └──────────────┘  └──────────────┘  └───────────────────┘   │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐   │  │
│  │  │                    EVENT BUS                           │   │  │
│  │  │         (Modüller arası asenkron iletişim)             │   │  │
│  │  └───────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                         │                                           │
│                         │ Playwright launch({ channel: 'msedge' })  │
│                         ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              TARAYICI PENCERELERİ (Playwright)                │  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                    │  │
│  │  │  Profil A        │  │  Profil B        │  ...              │  │
│  │  │  Edge Penceresi  │  │  Edge Penceresi  │                   │  │
│  │  │                  │  │                  │                    │  │
│  │  │ ← → 🔄 🔒       │  │ ← → 🔄 🔒       │                   │  │
│  │  │ visa.vfsglobal.. │  │ google.com       │                   │  │
│  │  │ ┌──────────────┐ │  │ ┌──────────────┐ │                   │  │
│  │  │ │  VFS Formu   │ │  │ │              │ │                   │  │
│  │  │ │  [Auto-Fill] │ │  │ │  Kullanıcı   │ │                   │  │
│  │  │ │  aktif       │ │  │ │  serbest     │ │                   │  │
│  │  │ └──────────────┘ │  │ │  gezinir     │ │                   │  │
│  │  │                  │  │ └──────────────┘ │                   │  │
│  │  │ 🟢 Fingerprint A │  │ 🔵 Fingerprint B │                   │  │
│  │  │ 🟢 Proxy TR-IST  │  │ 🔵 Proxy DE-BER  │                   │  │
│  │  │ 🟢 Çerezler izole│  │ 🔵 Çerezler izole│                   │  │
│  │  └─────────────────┘  └─────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Temel Tasarım Prensipleri

### 2.1 Electron = Kontrol Paneli, Playwright = Tarayıcı Penceresi

```
Electron Rolü:
├── Kontrol paneli UI (React)
├── Profil yönetimi arayüzü
├── Başvuru havuzu yönetimi
├── Ayarlar ve konfigürasyon
├── Sistem tray ikonu
└── IPC ile Playwright engine'e komut gönderme

Playwright Rolü:
├── Gerçek Edge/Chrome penceresi açma (channel: 'msedge')
├── Profil bazlı BrowserContext oluşturma
├── Fingerprint injection (addInitScript)
├── Proxy ayarlama
├── Çerez/session kalıcılığı
├── Auto-fill için sayfa DOM'una erişim
└── Kullanıcı pencerelerde serbest gezinir
```

> **Neden Electron BrowserView değil de Playwright?**
> - Playwright'ın `addInitScript()` ile fingerprint enjeksiyonu çok güçlü
> - `BrowserContext` izolasyonu native destekli
> - `channel: 'msedge'` ile gerçek Edge TLS fingerprint'i
> - `storageState` ile çerez kalıcılığı
> - Sayfa içeriğine müdahale (auto-fill) için zengin API

### 2.2 System Browser Stratejisi (Bundled Chromium Yok!)

```
❌ YANLIŞ: Playwright bundled Chromium → Sahte TLS fingerprint, +180MB boyut
✅ DOĞRU:  Playwright channel: 'msedge' → Gerçek Edge, WAF'lar normal kullanıcı görür

Tarayıcı Seçim Önceliği:
1. Microsoft Edge  → Windows'ta pre-installed, her zaman mevcut
2. Google Chrome   → Kullanıcıda varsa, en yaygın tarayıcı
3. Hata            → "Edge veya Chrome yüklü olmalıdır!"
```

### 2.3 Modüler, Gevşek Bağlı Mimari
Her manager sınıfı bağımsız çalışabilir. Modüller arası iletişim `EventBus` üzerinden
yapılır (Observer pattern). Bu sayede:
- Bir modül çökerse diğerleri etkilenmez
- Test yazması kolay (mock injection)
- Yeni modül eklemek mevcut kodu değiştirmez (Open/Closed Principle)

### 2.4 Veri Akışı

```
Profil Açma Akışı (Kullanıcı gezinmeye başlar):
───────────────────────────────────────────────

Kullanıcı (UI) ──► "Profili Aç" butonuna basar
                        │
                        ▼
                  SessionManager.openProfile(id)
                        │
                        ├──► ProfileManager.load(id) → profil verisi
                        │
                        ├──► FingerprintManager.load(id) → fingerprint
                        │
                        ├──► NetworkManager.getProxy(id) → proxy config
                        │
                        └──► playwright.chromium.launch({
                                 channel: 'msedge',     ← Gerçek Edge!
                                 headless: false         ← Kullanıcı görecek
                             })
                                 │
                                 └──► browser.newContext({
                                          storageState: kalıcı çerezler,
                                          userAgent: fingerprint.ua,
                                          viewport: fingerprint.viewport,
                                          locale: fingerprint.locale,
                                          timezoneId: fingerprint.timezone,
                                          proxy: proxyConfig
                                      })
                                          │
                                          ├──► addInitScript() ile
                                          │    navigator/screen override
                                          │
                                          ├──► addInitScript() ile
                                          │    auto-fill content script
                                          │
                                          └──► context.newPage()
                                               │
                                               └──► Kullanıcı bu pencerede
                                                    serbest gezinir! 🏄


Auto-Fill Akışı (Form algılandığında):
──────────────────────────────────────

Kullanıcı VFS formuna gelir
        │
        ▼
  Content Script (addInitScript) form alanlarını algılar
        │
        ├──► MutationObserver ile DOM değişikliklerini izler
        │
        ├──► VFS form pattern eşleşmesi bulunursa:
        │        │
        │        ├──► Electron'a IPC mesajı gönderir
        │        │
        │        └──► Electron UI'da "Auto-Fill" butonu aktif olur
        │
        └──► Kullanıcı "Havuzdan Doldur" butonuna basarsa:
                 │
                 ├──► DataPoolManager.getApplicant(id) → kişi verisi
                 │
                 └──► AutoFillEngine.fill(page, applicantData)
                          │
                          ├──► İsim alanı → insansı hızda yazar
                          ├──► Soyisim alanı → insansı hızda yazar
                          ├──► Pasaport no → insansı hızda yazar
                          ├──► Tarih alanları → dropdown/datepicker ile
                          └──► Select alanları → doğru option seçimi
```

---

## 3. Dosya Yapısı Detayı

### 3.1 Güncellenmiş Proje Yapısı

```
voidra/
├── src/
│   ├── core/                        # Çekirdek motor
│   │   ├── VoidraEngine.ts          # Ana orkestratör
│   │   └── EventBus.ts              # Modüller arası iletişim
│   ├── managers/                    # Yönetici sınıfları
│   │   ├── ProfileManager.ts        # Profil CRUD + yaşam döngüsü
│   │   ├── SessionManager.ts        # Playwright browser/context yönetimi
│   │   ├── FingerprintManager.ts    # Parmak izi üretimi + kalıcılığı
│   │   ├── NetworkManager.ts        # Proxy + ağ filtreleme
│   │   └── DataPoolManager.ts       # Başvuru havuzu yönetimi (YENİ!)
│   ├── automation/                  # Otomasyon modülleri
│   │   ├── AutoFillEngine.ts        # Form algılama + otomatik doldurma (YENİ!)
│   │   ├── HumanInteraction.ts      # İnsansı etkileşim motoru
│   │   ├── FormDetector.ts          # VFS form pattern algılama (YENİ!)
│   │   └── AppointmentHunter.ts     # Randevu arama + yakalama
│   ├── ui/                          # Electron UI katmanı
│   │   ├── main/                    # Electron ana süreç
│   │   │   ├── main.ts              # Electron entry point
│   │   │   ├── ipc-handlers.ts      # IPC mesaj yönetimi
│   │   │   └── tray.ts              # Sistem tray ikonu
│   │   ├── renderer/                # React renderer
│   │   │   ├── App.tsx              # Ana uygulama
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx    # Ana panel
│   │   │   │   ├── Profiles.tsx     # Profil yönetimi
│   │   │   │   ├── DataPool.tsx     # Başvuru havuzu (YENİ!)
│   │   │   │   └── Settings.tsx     # Ayarlar
│   │   │   └── components/          # Paylaşılan bileşenler
│   │   └── assets/                  # UI varlıkları (ikon, font)
│   ├── scripts/                     # Tarayıcıya enjekte edilecek scriptler
│   │   ├── fingerprint-inject.ts    # Navigator/screen override
│   │   ├── autofill-content.ts      # Auto-fill content script (YENİ!)
│   │   └── form-detector.ts         # VFS form algılama (YENİ!)
│   ├── models/                      # Veri modelleri
│   │   ├── Profile.ts               # Profil arayüzleri
│   │   ├── Fingerprint.ts           # Parmak izi arayüzleri
│   │   ├── Applicant.ts             # Başvuru sahibi arayüzleri (YENİ!)
│   │   └── Config.ts                # Konfigürasyon arayüzleri
│   ├── utils/                       # Yardımcı araçlar
│   │   ├── Logger.ts                # Renkli loglama
│   │   ├── CryptoUtils.ts           # Şifreleme yardımcıları
│   │   └── Constants.ts             # Sabitler
│   └── index.ts                     # Ana giriş noktası
├── data/
│   ├── profiles/                    # Profil JSON verileri
│   ├── fingerprints/                # Parmak izi veritabanı
│   ├── sessions/                    # Kaydedilmiş oturum durumları
│   └── pool/                        # Başvuru havuzu verileri (YENİ!)
│       ├── applicants.json          # Başvuru sahipleri listesi
│       └── templates/               # Form şablonları
├── browser_data/                    # Playwright persistent context verileri
│   └── {profile_id}/
├── docs/
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md              # Bu dosya
│   ├── ANTI-DETECTION.md
│   └── TECH-STACK.md
├── tests/
├── package.json
├── tsconfig.json
├── .gitignore
└── .env.example
```

### 3.2 Core Modüller

| Dosya | Sorumluluk | Bağımlılıklar |
|-------|-----------|---------------|
| `VoidraEngine.ts` | Ana orkestratör, tüm manager'ları başlatır | Tüm manager'lar |
| `EventBus.ts` | Pub/Sub olay sistemi | Yok (bağımsız) |
| `ProfileManager.ts` | Profil CRUD, veri kalıcılığı | EventBus |
| `SessionManager.ts` | Playwright browser/context yaşam döngüsü | Profile, Fingerprint, Network |
| `FingerprintManager.ts` | Fingerprint üretimi ve yönetimi | EventBus |
| `NetworkManager.ts` | Proxy ve ağ kuralları | EventBus |
| `DataPoolManager.ts` | **Başvuru havuzu CRUD** | EventBus |

### 3.3 Otomasyon Modülleri

| Dosya | Sorumluluk | Bağımlılıklar |
|-------|-----------|---------------|
| `AutoFillEngine.ts` | **Form doldurma motoru** | DataPool, HumanInteraction |
| `FormDetector.ts` | **VFS form pattern algılama** | Yok (content script) |
| `HumanInteraction.ts` | İnsansı klavye/mouse/scroll | Yok (stateless utility) |
| `AppointmentHunter.ts` | Randevu arama ve yakalama | AutoFill, EventBus |

### 3.4 Veri Dosyaları

```
data/
├── profiles/
│   ├── voidra_prof_a1b2c3.json     # Profil metadatası
│   └── voidra_prof_d4e5f6.json
├── fingerprints/
│   ├── voidra_fp_a1b2c3.json       # Profil A fingerprint'i
│   └── voidra_fp_d4e5f6.json
├── sessions/
│   ├── voidra_sess_a1b2c3.json     # Profil A çerez/storage state
│   └── voidra_sess_d4e5f6.json
└── pool/                            # Başvuru Havuzu (YENİ!)
    ├── applicants.json              # Tüm başvuru sahipleri
    └── templates/
        └── vfs_turkey.json          # VFS Türkiye form eşleştirme şablonu

browser_data/
├── a1b2c3/                          # Profil A persistent browser data
│   ├── Default/
│   ├── Cookies
│   └── Local Storage/
└── d4e5f6/                          # Profil B persistent browser data
```

---

## 4. Başvuru Havuzu (Data Pool) Sistemi

### 4.1 Veri Modeli

```typescript
// Applicant (Başvuru Sahibi) veri yapısı
interface Applicant {
    id: string;                      // Benzersiz ID
    // Kişisel Bilgiler
    firstName: string;               // Ad
    lastName: string;                // Soyad
    birthDate: string;               // Doğum tarihi (YYYY-MM-DD)
    nationality: string;             // Uyruk
    gender: 'male' | 'female';      // Cinsiyet
    // Pasaport Bilgileri
    passportNumber: string;          // Pasaport numarası
    passportIssueDate: string;       // Pasaport veriliş tarihi
    passportExpiryDate: string;      // Pasaport bitiş tarihi
    passportIssuingAuthority: string;// Veren makam
    // İletişim Bilgileri
    email: string;                   // E-posta
    phone: string;                   // Telefon
    address: string;                 // Adres
    city: string;                    // Şehir
    postalCode: string;              // Posta kodu
    country: string;                 // Ülke
    // VFS Özel
    appointmentCategory: string;     // Randevu kategorisi
    visaType: string;                // Vize türü
    travelDate: string;              // Seyahat tarihi
    // Metadata
    createdAt: string;
    updatedAt: string;
    notes: string;                   // Notlar
}
```

### 4.2 Auto-Fill Akışı

```
┌─────────────────────────────────────────────────────┐
│                  AUTO-FILL SİSTEMİ                   │
│                                                     │
│  1. FormDetector (content script)                   │
│     │                                               │
│     ├──► MutationObserver ile DOM izleme            │
│     ├──► VFS form pattern eşleştirme                │
│     │    (input[name], label text, placeholder)     │
│     └──► Form bulundu → IPC ile Electron'a bildir   │
│                                                     │
│  2. Electron UI                                     │
│     │                                               │
│     ├──► "Auto-Fill" butonu aktif olur               │
│     ├──► Kullanıcı havuzdan bir kişi seçer          │
│     └──► "Doldur" butonuna basar                    │
│                                                     │
│  3. AutoFillEngine                                  │
│     │                                               │
│     ├──► DataPoolManager'dan kişi verisini alır     │
│     ├──► Form alanlarını kişi verileriyle eşler     │
│     └──► HumanInteraction ile insansı hızda doldurur│
│                                                     │
│  4. Sonuç                                           │
│     │                                               │
│     ├──► Form dolduruldu ✅                          │
│     └──► Log kaydı oluşturuldu                      │
└─────────────────────────────────────────────────────┘
```

---

## 5. IPC (Inter-Process Communication) Mimarisi

Electron'un Main process'i ile Playwright engine arasındaki iletişim:

```
┌──────────────┐         IPC          ┌──────────────────┐
│  Electron    │ ◄──────────────────► │  Playwright      │
│  Main Process│                      │  Engine           │
│              │  profile:open        │                   │
│  • UI yönetimi│ ──────────────────► │ • Browser launch  │
│  • IPC hub   │                      │ • Context yönetimi│
│  • Tray icon │  page:form-detected  │ • Script inject   │
│              │ ◄─────────────────── │ • Auto-fill       │
│              │                      │                   │
│              │  autofill:execute    │                   │
│              │ ──────────────────► │                   │
│              │                      │                   │
│              │  profile:closed      │                   │
│              │ ◄─────────────────── │                   │
└──────────────┘                      └──────────────────┘
       │
       │ IPC (contextBridge)
       ▼
┌──────────────┐
│  Electron    │
│  Renderer    │
│  (React UI)  │
│              │
│  • Dashboard │
│  • Profiller │
│  • Havuz     │
│  • Ayarlar   │
└──────────────┘
```

---

## 6. Güvenlik Katmanları

### 6.1 Fingerprint Tutarlılık Matrisi
(Değişmedi — ANTI-DETECTION.md'ye referans)

### 6.2 Veri Güvenliği
- Başvuru havuzundaki kişisel veriler **şifreli** saklanır (AES-256)
- Proxy kimlik bilgileri `.env` dosyasında, git'e eklenmez
- Profil verileri kullanıcının bilgisayarında kalır, cloud'a gönderilmez

---

## 7. Teknoloji Kararları ve Gerekçeleri

| Karar | Alternatifler | Neden Bu? |
|-------|--------------|-----------| 
| Playwright + msedge | Puppeteer, Selenium | Gerçek Edge TLS fingerprint, BrowserContext izolasyonu |
| channel: 'msedge' | Bundled Chromium | Gerçek TLS, Windows'ta pre-installed, -180MB boyut |
| Electron | Tauri, Web UI | Playwright ile aynı process'te çalışabilir, zengin IPC |
| React | Vue, Svelte | Geniş ekosistem, Electron ile kanıtlanmış uyum |
| EventBus | Direct calls | Gevşek bağlılık, test kolaylığı |
| JSON dosyalar | SQLite, MongoDB | Basitlik, taşınabilirlik, profil başına bağımsız dosya |
