# 🎯 VOIDRA — STRATEJİK PLAN
## Anti-Detect Browser & VFS Güvenlik Zafiyet Analiz Motoru

**Tarih:** Şubat 2026  
**Amaç:** VFS Global güvenlik zafiyetlerinin cerrahi hassasiyetle raporlanması  
**Durum:** Güvenlik araştırma (penetration testing) kapsamı

---

## 📑 İçindekiler

1. [Mevcut Durum Analizi](#1-mevcut-durum)
2. [VFS Güvenlik Katman Haritası](#2-guvenlik-katmanlari)
3. [İzole Tarayıcı Mimarisi](#3-izole-tarayici)
4. [Fazlara Ayrılmış Yol Haritası](#4-yol-haritasi)
5. [Modül Detayları](#5-modul-detaylari)
6. [Risk Analizi & Karşı Önlemler](#6-risk-analizi)
7. [Test Matrisi](#7-test-matrisi)

---

## 1. Mevcut Durum Analizi {#1-mevcut-durum}

### 1.1 Proje Yapısı

```
voidra/
├── src/
│   ├── main/index.ts              — Electron ana süreç + IPC
│   ├── core/
│   │   ├── BrowserLauncher.ts     — Edge/Chrome başlatma + CDP
│   │   ├── FingerprintGenerator.ts— Firefox tabanlı parmak izi
│   │   ├── StealthEngine.ts       — Otomasyon izi temizleme
│   │   ├── ScriptInjector.ts      — VFS Bot Pro enjeksiyon
│   │   ├── ProfileWarmer.ts       — Profil ısındırma
│   │   ├── EventBus.ts            — Olay yönetimi
│   │   └── FirewallReset.ts       — Ağ sıfırlama
│   ├── managers/
│   │   ├── SessionManager.ts      — Oturum yönetimi
│   │   ├── ProfileManager.ts      — Profil CRUD
│   │   └── PoolManager.ts         — Başvuru sahibi havuzu
│   ├── automation/
│   │   └── AutoFillEngine.ts      — Form doldurma motoru
│   ├── models/
│   │   ├── Profile.ts             — Profil veri modeli
│   │   └── Applicant.ts           — Başvuru sahibi modeli
│   ├── renderer/                  — React UI (Electron)
│   └── utils/
│       ├── Constants.ts           — Sabitler
│       └── Logger.ts              — Log sistemi
├── dist/VFS-Firewall-Reset/       — PowerShell ağ sıfırlama aracı
├── vfs-turkey-netherlands-auto-book-pro.user.js  — VFS Bot Pro (122KB)
└── extensions/                    — Tarayıcı eklentileri
```

### 1.2 Çalışan Bileşenler

| Bileşen | Durum | Notlar |
|---------|-------|--------|
| Electron Shell | ✅ Çalışıyor | IPC, pencere yönetimi |
| ProfileManager | ✅ Çalışıyor | Profil CRUD, JSON storage |
| PoolManager | ✅ Çalışıyor | Başvuru sahibi yönetimi |
| SessionManager | ✅ Çalışıyor | TEK tarayıcı, CDP bağlantı |
| BrowserLauncher | ✅ Çalışıyor | Edge + sistem profili |
| ScriptInjector | ✅ Çalışıyor | Local server + CDP fallback |
| FingerprintGenerator | ⚠️ Kısmi | Firefox UA + WebGL üretir, uygulanmıyor |
| StealthEngine | ⚠️ Kısmi | Sadece webdriver temizle, full stealth yok |
| ProfileWarmer | ⚠️ Kısmi | Dosya kopyalama var, aktif kullanılmıyor |
| AutoFillEngine | ⚠️ Kısmi | Selector mapping var, test edilmedi |
| FirewallReset | ✅ Çalışıyor | PowerShell + Fingerprint sıfırlama |
| VFS Bot Pro Script | ✅ Çalışıyor | 122KB userscript, enjekte ediliyor |
| React UI | ⚠️ Temel | Profil listesi, session kontrolü |

### 1.3 Kritik Eksiklikler

```
┌─────────────────────────────────────────────────────────┐
│  ❌ SORUN: Tarayıcı sistemden İZOLE DEĞİL               │
│                                                         │
│  Mevcut: Edge + kullanıcının GERÇEK profili              │
│  ⤷ Kişisel cookie'ler, history, eklentiler PAYLAŞILIYOR │
│  ⤷ Fingerprint gerçek donanıma bağlı                    │
│  ⤷ IP adresi değiştirilmiyor                            │
│  ⤷ WebRTC ile gerçek IP sızabilir                       │
│                                                         │
│  Gerekli: Tamamen izole, sahte kimlikli tarayıcı         │
│  ⤷ Ayrı profil dizini (kendi cookie/cache/history)      │
│  ⤷ Kontrol edilen fingerprint bileşenleri               │
│  ⤷ Proxy/VPN entegrasyonu                               │
│  ⤷ WebRTC leak koruması                                 │
│  ⤷ TLS fingerprint yönetimi                             │
└─────────────────────────────────────────────────────────┘
```

---

## 2. VFS Güvenlik Katman Haritası {#2-guvenlik-katmanlari}

VFS Global'in güvenlik altyapısı birden fazla katmandan oluşur. Her katmanı ayrı ayrı aşmamız gerekiyor:

```
╔══════════════════════════════════════════════════════════════════╗
║                VFS GLOBAL GÜVENLİK KATMANLARI                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  KATMAN 7 — Uygulama Mantığı                                   ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • Rate limiting (aynı hesaptan çok sık istek)            │   ║
║  │ • Timer koruması (öğe seçim zaman aşımı)                 │   ║
║  │ • Slot kilitleme (concurrent booking engeli)              │   ║
║  │ • CAPTCHA (Turnstile) — bazı işlemlerde                  │   ║
║  │ • API response şifreleme / obfuscation                   │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                            ▲                                    ║
║  KATMAN 6 — Oturum & Kimlik Doğrulama                          ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • JWT token doğrulama                                    │   ║
║  │ • Session binding (IP + fingerprint)                     │   ║
║  │ • CSRF token kontrolü                                    │   ║
║  │ • Account fingerprinting                                 │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                            ▲                                    ║
║  KATMAN 5 — JavaScript Güvenlik                                 ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • Otomasyon tespiti (navigator.webdriver)                 │   ║
║  │ • DevTools algılama (debugger, console override)         │   ║
║  │ • Event pattern analizi (mouse, keyboard)                │   ║
║  │ • HeadlessChrome / Puppeteer tespiti                     │   ║
║  │ • Stack trace analizi (CDP izleri)                       │   ║
║  │ • Timing analizi (insan dışı hız)                        │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                            ▲                                    ║
║  KATMAN 4 — Cloudflare WAF                                      ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • JavaScript Challenge (5s bekleme)                      │   ║
║  │ • Turnstile CAPTCHA                                      │   ║
║  │ • cf_clearance / __cf_bm cookie                          │   ║
║  │ • Bot Score hesaplama                                    │   ║
║  │ • TLS Fingerprint (JA3/JA4) analizi                     │   ║
║  │ • HTTP/2 fingerprinting (AKAMAI H2)                     │   ║
║  │ • Browser integrity check                                │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                            ▲                                    ║
║  KATMAN 3 — Fingerprint Katmanı                                 ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • Canvas fingerprint hash                                │   ║
║  │ • WebGL vendor/renderer                                  │   ║
║  │ • Audio fingerprint                                      │   ║
║  │ • Font enumeration                                       │   ║
║  │ • Screen resolution + color depth                        │   ║
║  │ • navigator.* API değerleri                              │   ║
║  │ • Timezone + locale tutarlılığı                          │   ║
║  │ • Plugin listesi                                         │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                            ▲                                    ║
║  KATMAN 2 — Ağ Katmanı                                          ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • IP reputasyon kontrolü                                 │   ║
║  │ • IP geolocation ↔ timezone tutarlılığı                  │   ║
║  │ • WebRTC IP sızıntısı tespiti                            │   ║
║  │ • DNS leak kontrolü                                      │   ║
║  │ • VPN/Proxy/Datacenter IP tespiti                        │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                            ▲                                    ║
║  KATMAN 1 — TLS/HTTP Katmanı                                    ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │ • TLS Client Hello fingerprint (JA3/JA4)                 │   ║
║  │ • HTTP/2 settings frame                                  │   ║
║  │ • Header sıralaması ve içeriği                           │   ║
║  │ • accepted-encoding / accept-language                    │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

### Her Katman İçin Strateji

| Katman | Mevcut Durum | Strateji |
|--------|-------------|----------|
| **K1: TLS/HTTP** | ❌ Kontrol yok | Firefox kullan (farklı JA3), header yönetimi |
| **K2: Ağ** | ⚠️ Kısmi (FW Reset) | Residential proxy, WebRTC block, DNS koruma |
| **K3: Fingerprint** | ⚠️ Üretiliyor ama uygulanmıyor | İzole profil + consistent fingerprint |
| **K4: Cloudflare** | ✅ cf_clearance mevcut | Manuel challenge + cookie aktarma |
| **K5: JS Güvenlik** | ✅ StealthEngine (webdriver) | Genişletilecek (CDP izlerini gizle) |
| **K6: Oturum** | ✅ Gerçek login | Session persistence + cookie yönetimi |
| **K7: Uygulama** | ⚠️ Script var | Timer bypass, slot monitoring, auto-book |

---

## 3. İzole Tarayıcı Mimarisi {#3-izole-tarayici}

### 3.1 Hedef Mimari

```
╔══════════════════════════════════════════════════════════════╗
║                    VOIDRA ELECTRON APP                       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │                    REACT UI (Renderer)                  │  ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  ║
║  │  │ Profiller │ │  Havuz   │ │ Monitör  │ │ Raporlar │  │  ║
║  │  │ Yönetimi │ │ Yönetimi │ │  & Log   │ │ & Analiz │  │  ║
║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  ║
║  └──────────────────────┬─────────────────────────────────┘  ║
║                         │ IPC                                 ║
║  ┌──────────────────────┴─────────────────────────────────┐  ║
║  │                  MAIN PROCESS (Node.js)                 │  ║
║  │                                                         │  ║
║  │  ┌─────────────────────────────────────────────────┐   │  ║
║  │  │            ORCHESTRATOR (Orkestratör)             │   │  ║
║  │  │  Tüm modülleri koordine eder                     │   │  ║
║  │  │  • Session lifecycle yönetimi                     │   │  ║
║  │  │  • Hata yönetimi & retry stratejisi              │   │  ║
║  │  │  • Zamanlama & scheduler                         │   │  ║
║  │  └──────────────┬──────────────────────────────────┘   │  ║
║  │                 │                                       │  ║
║  │  ┌──────────────┴──────────────────────────────────┐   │  ║
║  │  │         İZOLE TARAYICI KATMANI                    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ PROFIL İZOLASYONU                         │    │   │  ║
║  │  │  │ Her profil = ayrı dizin                    │    │   │  ║
║  │  │  │ ├── cookies/        (ayrı cookie store)   │    │   │  ║
║  │  │  │ ├── cache/          (ayrı cache)          │    │   │  ║
║  │  │  │ ├── history/        (ayrı geçmiş)         │    │   │  ║
║  │  │  │ ├── extensions/     (warm-up'tan)         │    │   │  ║
║  │  │  │ └── fingerprint.json(sabitlenmiş fp)      │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ FINGERPRINT MOTORU                        │    │   │  ║
║  │  │  │ • Tutarlı fingerprint üretimi              │    │   │  ║
║  │  │  │ • Canvas noise injection                   │    │   │  ║
║  │  │  │ • WebGL renderer spoofing                  │    │   │  ║
║  │  │  │ • Audio context hashing                    │    │   │  ║
║  │  │  │ • Font enumeration kontrolü                │    │   │  ║
║  │  │  │ • Donanım tutarlılık doğrulama             │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ STEALTH MOTORU (Genişletilmiş)            │    │   │  ║
║  │  │  │ • navigator.webdriver temizleme            │    │   │  ║
║  │  │  │ • CDP izlerini gizleme                     │    │   │  ║
║  │  │  │ • Stack trace temizleme                    │    │   │  ║
║  │  │  │ • Playwright global'lerini kaldırma        │    │   │  ║
║  │  │  │ • Error.stack normalizasyonu               │    │   │  ║
║  │  │  │ • Permission API tutarlılığı               │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ AĞ KATMANI                                │    │   │  ║
║  │  │  │ • Proxy rotasyonu (residential)            │    │   │  ║
║  │  │  │ • WebRTC IP leak koruması                  │    │   │  ║
║  │  │  │ • DNS leak koruması                        │    │   │  ║
║  │  │  │ • IP ↔ timezone ↔ locale tutarlılığı       │    │   │  ║
║  │  │  │ • Firewall Reset entegrasyonu              │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ İNSAN SİMÜLASYONU                         │    │   │  ║
║  │  │  │ • Bezier eğrisi mouse hareketi             │    │   │  ║
║  │  │  │ • Gaussian typing gecikme                  │    │   │  ║
║  │  │  │ • Rastgele scroll pattern                  │    │   │  ║
║  │  │  │ • Sayfa gezinme sıralaması                 │    │   │  ║
║  │  │  │ • İdle/duraklama simülasyonu               │    │   │  ║
║  │  │  │ • Focus/blur event üretimi                 │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  └─────────────────────────────────────────────────┘   │  ║
║  │                                                         │  ║
║  │  ┌─────────────────────────────────────────────────┐   │  ║
║  │  │            VFS OTOMASYON KATMANI                  │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ NAVIGASYON MOTORU                         │    │   │  ║
║  │  │  │ • Doğal sayfa geçişi (link tıklama)       │    │   │  ║
║  │  │  │ • Cloudflare challenge bekleme            │    │   │  ║
║  │  │  │ • Login akışı yönetimi                    │    │   │  ║
║  │  │  │ • Session timeout algılama & yenileme     │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ SLOT MONİTÖR                              │    │   │  ║
║  │  │  │ • Periyodik slot kontrolü (akıllı aralık) │    │   │  ║
║  │  │  │ • API response parsing                    │    │   │  ║
║  │  │  │ • Slot bulunduğunda instant bildirim       │    │   │  ║
║  │  │  │ • Multi-tarih arama                       │    │   │  ║
║  │  │  │ • Slot lock algılama                      │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ AUTO-BOOK MOTORU                          │    │   │  ║
║  │  │  │ • Form doldurma (applicant data)          │    │   │  ║
║  │  │  │ • Tarih/saat seçimi                       │    │   │  ║
║  │  │  │ • Doğrulama & onay                        │    │   │  ║
║  │  │  │ • Hata durumunda retry                    │    │   │  ║
║  │  │  │ • Başarı/başarısızlık raporlama            │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  │                                                   │   │  ║
║  │  │  ┌──────────────────────────────────────────┐    │   │  ║
║  │  │  │ BİLDİRİM MOTORU                           │    │   │  ║
║  │  │  │ • Telegram bot entegrasyonu                │    │   │  ║
║  │  │  │ • Desktop notification                    │    │   │  ║
║  │  │  │ • Sesli uyarı                             │    │   │  ║
║  │  │  │ • Detaylı log kayıtları                   │    │   │  ║
║  │  │  └──────────────────────────────────────────┘    │   │  ║
║  │  └─────────────────────────────────────────────────┘   │  ║
║  └─────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════╝
```

### 3.2 İzole Profil Dizin Yapısı

Her profil tamamen bağımsız bir tarayıcı profili olacak:

```
data/profiles/{profile-id}/
├── profile.json              — Profil meta verileri
├── fingerprint.json          — Sabitlenmiş parmak izi
├── browser_data/
│   └── Default/
│       ├── Cookies            — İzole cookie store
│       ├── History            — Warm-up'tan kopyalanan geçmiş
│       ├── Web Data           — Form verileri
│       ├── Bookmarks          — Bookmarklar
│       ├── Preferences        — Tarayıcı tercihleri (randomized ID)
│       ├── Local Storage/     — Site bazlı depolama
│       ├── Session Storage/   — Oturum depolama
│       ├── IndexedDB/         — IndexedDB verileri
│       ├── Service Worker/    — SW kayıtları
│       ├── Extensions/        — Warm-up'tan kopyalanan eklentiler
│       └── GPUCache/          — GPU shader cache
├── logs/                      — Profil bazlı log
└── screenshots/               — Hata durumunda ekran görüntüsü
```

### 3.3 Tarayıcı Seçimi Stratejisi

```
┌──────────────────────────────────────────────────────────────┐
│              TARAYICI SEÇİMİ KARAR AĞACI                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SEÇENEK A: Firefox + Playwright (ÖNCELİKLİ)               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✅ Avantajlar:                                         │  │
│  │    • Farklı TLS fingerprint (Cloudflare DB'de az)     │  │
│  │    • CDP yerine Juggler protokolü (daha az iz)        │  │
│  │    • navigator.webdriver leak riski düşük               │  │
│  │    • Turnstile genellikle otomatik geçiyor              │  │
│  │    • Firefox'ta deviceMemory API yok (doğal)           │  │
│  │    • Chromium botlarının %95'i engelleniyor,            │  │
│  │      Firefox botları çok nadir                          │  │
│  │ ❌ Dezavantajlar:                                       │  │
│  │    • Extension uyumluluğu daha sınırlı                 │  │
│  │    • Playwright Firefox desteği Chromium kadar olgun ⌀ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  SEÇENEK B: Edge/Chrome + CDP (MEVCUT — YEDEK PLAN)        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✅ Avantajlar:                                         │  │
│  │    • Gerçek kullanıcı profili kullanılabilir            │  │
│  │    • Extension desteği mükemmel                        │  │
│  │    • CDP ile tam kontrol                                │  │
│  │ ❌ Dezavantajlar:                                       │  │
│  │    • Chromium TLS fingerprint çok bilinen               │  │
│  │    • CDP izleri tespit edilebilir                       │  │
│  │    • navigator.webdriver flag yönetimi zor              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  KARAR: Firefox ÖNCELİKLİ, Edge YEDEK                       │
│  FingerprintGenerator zaten Firefox tabanlı ✓                │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Fazlara Ayrılmış Yol Haritası {#4-yol-haritasi}

### FAZ 0 — Temel Altyapı Düzeltmeleri (1-2 gün)
**Amaç:** Mevcut kodun kararlı çalışmasını sağla

```
□ 0.1  Orchestrator modülü oluştur — tüm modüllerin lifecycle yönetimi
□ 0.2  Hata yönetimi standardize et (her modüle try-catch + log)
□ 0.3  IPC handler'ları temizle ve dökümante et
□ 0.4  EventBus event tiplerini standardize et
□ 0.5  Config dosyası oluştur (hardcoded değerleri taşı)
```

### FAZ 1 — İzole Profil Sistemi (2-3 gün)
**Amaç:** Her profil tamamen bağımsız bir dijital kimlik

```
□ 1.1  ProfileManager'ı güncelle:
       └── Her profil için ayrı browser_data dizini
       └── Profil oluşturmada fingerprint sabitlenmesi
       └── Profil silmede tüm verilerin güvenli silinmesi

□ 1.2  BrowserLauncher'ı güncelle:
       └── --user-data-dir ile profil dizinini kullan (sistem profili DEĞİL)
       └── Firefox desteği ekle (playwright firefox)
       └── Proxy parametresi desteği

□ 1.3  ProfileWarmer'ı aktive et:
       └── İlk çalıştırmada gerçek profilden warm-up
       └── Geçmiş, bookmark, extension kopyalama
       └── Cookie'leri kopyalaMa (her oturum temiz başlasın)
       └── Preferences dosyasında ID'leri randomize et

□ 1.4  Session izolasyonu:
       └── Her profil kendi session'ı
       └── Profil kapanınca session verilerini koru
       └── Sonraki açılışta devam edebilsin
```

### FAZ 2 — Fingerprint Tutarlılık Motoru (2-3 gün)
**Amaç:** Profil başına tutarlı ve gerçekçi fingerprint

```
□ 2.1  FingerprintGenerator genişlet:
       └── Canvas noise seed (profil bazlı deterministik)
       └── Audio fingerprint seed
       └── Font listesi varyasyonu
       └── ClientRects noise
       └── Speech voices varyasyonu

□ 2.2  StealthEngine v3 — Katmanlı stealth:
       ┌── Katman 1: Otomasyon izi temizleme (mevcut)
       ├── Katman 2: CDP iz gizleme
       │   └── Runtime.enable stack trace temizleme
       │   └── Playwright iç değişkenleri temizleme
       │   └── Error.stack normalizasyonu
       ├── Katman 3: Canvas/Audio noise injection
       │   └── Sabit seed ile her seferinde aynı sonuç
       │   └── Profil değiştirince farklı sonuç
       └── Katman 4: Donanım tutarlılık doğrulama
           └── WebGL ↔ Canvas ↔ Audio hash'leri tutarlı mı?
           └── Screen ↔ viewport ↔ DPR tutarlı mı?
           └── IP ↔ timezone ↔ locale tutarlı mı?

□ 2.3  Fingerprint doğrulama servisi:
       └── bot.sannysoft.com testi
       └── browserleaks.com kontrolleri
       └── CreepJS score kontrolü
       └── Otomatik rapor oluşturma
```

### FAZ 3 — Ağ İzolasyonu & Proxy (1-2 gün)
**Amaç:** IP/DNS/WebRTC seviyesinde tam izolasyon

```
□ 3.1  Proxy entegrasyonu:
       └── Profil bazlı proxy atama
       └── HTTP/HTTPS/SOCKS5 desteği
       └── Proxy health check (bağlantı testi)
       └── Proxy rotasyonu stratejisi

□ 3.2  WebRTC koruması:
       └── WebRTC IP leak engelleme
       └── mdns ICE candidate filtreleme
       └── Firefox: media.peerconnection.enabled=false

□ 3.3  DNS koruması:
       └── DNS over HTTPS zorlama
       └── DNS leak testi
       └── Custom DNS resolver

□ 3.4  IP ↔ Metadata tutarlılığı:
       └── Proxy IP'nin geolocation'ını al
       └── Timezone'u otomatik ayarla
       └── Locale'i bölgeye uygun yap
```

### FAZ 4 — İnsan Simülasyon Motoru (2-3 gün)
**Amaç:** Bot algılamayı atlatan gerçekçi etkileşim

```
□ 4.1  Mouse hareket motoru:
       └── Bezier eğrisi ile doğal hareket
       └── Hedef elemana yakınken yavaşlama
       └── Rastgele sapma (overshoot + correction)
       └── İdle durumda micro-movement

□ 4.2  Klavye simülasyonu:
       └── Gaussian dağılımlı tuş basma süresi
       └── Kelime arası farklı gecikme
       └── Typo + düzeltme simülasyonu (nadiren)
       └── Paste yerine typing

□ 4.3  Scroll simülasyonu:
       └── İnertia bazlı scroll (momentum)
       └── Okuma hızına uygun scroll
       └── Rastgele duraklamalar

□ 4.4  Sayfa etkileşim paterni:
       └── İlk yüklenmede birkaç saniye bekle
       └── Sayfayı "oku" (scroll down)
       └── Elemanlara hover et (merak simülasyonu)
       └── Focus/blur event'leri üret
       └── Tab switching simülasyonu
```

### FAZ 5 — VFS Otomasyon Akışı (3-4 gün)
**Amaç:** Login → Slot arama → Booking tam döngüsü

```
□ 5.1  Navigasyon motoru:
       └── Ana sayfa → "Book Appointment" tıkla
       └── Cloudflare challenge algıla ve bekle
       └── cf_clearance cookie kontrol et
       └── Login sayfasına doğal geçiş

□ 5.2  Login motoru:
       └── Email/password doldurma (insan benzeri)
       └── Turnstile/CAPTCHA algılama
       └── Manuel CAPTCHA için kullanıcıya bildirim
       └── Login başarı/hata kontrolü
       └── Session token yakalama

□ 5.3  Slot monitör:
       └── Appointment sayfasına navigasyon
       └── Kategori/alt kategori seçimi
       └── Uygun tarih arama motoru
       └── API response yakalama (CDP network)
       └── Polling aralığı yönetimi (rate limit'e dikkat)
       └── Multi-tarih paralel arama

□ 5.4  Auto-book motoru:
       └── Slot bulunduğunda anında form doldurma
       └── Applicant verilerini doğru alanlara eşleştirme
       └── Tarih/saat seçimi
       └── Onay butonu tıklama
       └── Booking confirmation yakalama
       └── Hata durumunda akıllı retry

□ 5.5  Timer bypass:
       └── VFS'in session timer'ını yönetme
       └── Sayfa yenileme stratejisi
       └── Token yenileme
```

### FAZ 6 — Bildirim & Raporlama (1-2 gün)
**Amaç:** Anlık bildirim ve detaylı zafiyet raporu

```
□ 6.1  Telegram bot:
       └── Slot bulunduğunda bildirim
       └── Booking başarılı/başarısız bildirim
       └── Sistem durumu raporu
       └── Hata bildirimi

□ 6.2  Desktop bildirim:
       └── Windows notification
       └── Sesli uyarı (slot bulunduğunda)
       └── Tray icon durum göstergesi

□ 6.3  Zafiyet rapor motoru:
       └── Her oturumun detaylı log'u
       └── Bypass edilen güvenlik katmanları
       └── Tespit edilen zafiyetler
       └── Önerilen iyileştirmeler
       └── PDF/HTML rapor çıktısı
```

### FAZ 7 — UI & Polish (2-3 gün)
**Amaç:** Profesyonel, kullanılabilir arayüz

```
□ 7.1  Dashboard:
       └── Aktif profiller ve durumları
       └── Slot arama durumu (canlı)
       └── Son bulunan slotlar
       └── Başarı istatistikleri

□ 7.2  Profil yönetimi UI:
       └── Profil oluşturma/düzenleme
       └── Fingerprint önizleme
       └── Proxy ayarları
       └── Warm-up durumu

□ 7.3  Havuz yönetimi UI:
       └── Başvuru sahibi ekleme/düzenleme
       └── CSV/JSON import/export
       └── Toplu işlem

□ 7.4  Log görüntüleyici:
       └── Canlı log akışı
       └── Filtreleme (seviye, kaynak)
       └── Arama
```

---

## 5. Modül Detayları {#5-modul-detaylari}

### 5.1 Orchestrator (YENİ — Merkezi Koordinasyon)

```typescript
// Orchestrator — tüm modüllerin lifecycle'ını yönetir
class Orchestrator {
    // Tam çalışma döngüsü
    async runFullCycle(profileId: string, applicantId: string): Promise<CycleResult> {
        // 1. Profili hazırla (warm-up, fingerprint)
        // 2. Tarayıcıyı başlat (izole profil + proxy)
        // 3. Stealth uygula
        // 4. Navigasyon: ana sayfa → login
        // 5. Login (manuel veya otomatik)
        // 6. Slot arama döngüsü başlat
        // 7. Slot bulunursa → auto-book
        // 8. Sonucu raporla
        // 9. Hata durumunda → retry stratejisi
    }
    
    // Slot arama döngüsü
    async startSlotMonitor(session: ActiveSession, config: MonitorConfig): Promise<void> {}
    
    // Hata yönetimi
    async handleError(error: VoidraError, context: ErrorContext): Promise<Action> {}
    
    // Zafiyet raporu oluştur
    async generateReport(sessionId: string): Promise<Report> {}
}
```

### 5.2 CanvasNoiseInjector (YENİ)

```typescript
// Canvas fingerprint için deterministik noise
class CanvasNoiseInjector {
    // Profil seed'i ile her seferinde aynı noise
    buildNoiseScript(seed: string): string {
        return `
        // toDataURL intercept — sabit seed ile noise ekle
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            const ctx = this.getContext('2d');
            if (ctx) {
                // Seed'e bağlı deterministik noise
                const rng = mulberry32(hashSeed('${seed}'));
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] += (rng() % 3) - 1;     // R: -1, 0, +1
                    imageData.data[i+1] += (rng() % 3) - 1;   // G
                    imageData.data[i+2] += (rng() % 3) - 1;   // B
                }
                ctx.putImageData(imageData, 0, 0);
            }
            return origToDataURL.apply(this, args);
        };`;
    }
}
```

### 5.3 HumanInteraction (YENİ)

```typescript
// İnsan benzeri etkileşim motoru
class HumanInteraction {
    // Bezier eğrisi ile mouse hareketi
    async moveMouse(page: Page, from: Point, to: Point): Promise<void> {}
    
    // Gaussian typing
    async typeText(page: Page, selector: string, text: string): Promise<void> {}
    
    // İnertia scroll
    async scrollTo(page: Page, target: number): Promise<void> {}
    
    // Rastgele sayfa keşfi (bot olmadığını kanıtla)
    async explorePageNaturally(page: Page): Promise<void> {}
}
```

---

## 6. Risk Analizi & Karşı Önlemler {#6-risk-analizi}

| Risk | Olasılık | Etki | Karşı Önlem |
|------|----------|------|-------------|
| Cloudflare challenge geçememe | Yüksek | Kritik | Firefox TLS + Manuel ilk geçiş + Cookie aktarma |
| Canvas fingerprint tespiti | Orta | Yüksek | Deterministik noise + tutarlılık doğrulama |
| IP engellenmesi | Yüksek | Yüksek | Residential proxy + rotasyon + FW Reset |
| Session timeout | Yüksek | Orta | Token yenileme + session monitoring |
| Rate limiting | Orta | Orta | Akıllı polling aralığı + backoff |
| Account ban | Düşük | Kritik | Doğal etkileşim + düşük frekans |
| WebRTC IP sızıntısı | Orta | Yüksek | WebRTC disable + mDNS bloklama |
| CDP tespiti | Orta | Yüksek | Firefox Juggler + stack trace temizleme |
| Slot kilitleme (concurrent) | Orta | Orta | Hızlı booking + retry mekanizması |

---

## 7. Test Matrisi {#7-test-matrisi}

### 7.1 Fingerprint Testleri

| Test | Araç | Geçme Kriteri |
|------|------|---------------|
| WebDriver tespiti | bot.sannysoft.com | ✅ "missing" |
| Canvas fingerprint tutarlılığı | browserleaks.com | Aynı profil = aynı hash |
| WebGL bilgi tutarlılığı | browserleaks.com | Vendor/renderer doğal |
| CreepJS skoru | abrahamjuliot.github.io/creepjs | Skor < 35% (düşük şüphe) |
| Headless tespiti | infosimples/detect-headless | ✅ Tüm testler geç |
| CDP tespiti | pptr.dev/antibot | ❌ Tespit edilemedi |
| TLS fingerprint | ja3er.com | Firefox JA3 hash'i |

### 7.2 VFS Fonksiyonel Testler

| Test | Senaryo | Beklenen Sonuç |
|------|---------|---------------|
| Ana sayfa erişim | vfsglobal.com/tur/en/nld/ | 200 OK + CF geçiş |
| Login sayfası | /login | 200 OK (403201 OLMAMALI) |
| Slot arama | appointment sayfası | API yanıtı alınmalı |
| Form doldurma | Tüm alanlar | Hatasız doldurulmalı |
| Booking | Mevcut slot | Onay alınmalı |

### 7.3 İzolasyon Testleri

| Test | Kontrol | Beklenen Sonuç |
|------|---------|---------------|
| Profil A cookies | Profil B'de görünüyor mu? | ❌ Hayır |
| Profil A fingerprint | Profil B ile aynı mı? | ❌ Farklı |
| WebRTC IP | Gerçek IP sızıyor mu? | ❌ Proxy IP görünmeli |
| DNS leak | DNS resolve proxy üzerinden mi? | ✅ Proxy DNS |

---

## 📅 Tahmini Zaman Çizelgesi

```
FAZ 0: Temel Düzeltmeler     ████░░░░░░░░░░░░░░░░░░░░  1-2 gün
FAZ 1: İzole Profil          ░░░░████████░░░░░░░░░░░░  2-3 gün
FAZ 2: Fingerprint Motoru    ░░░░░░░░░░░░████████░░░░  2-3 gün
FAZ 3: Ağ İzolasyonu         ░░░░░░░░░░░░░░░░████░░░░  1-2 gün
FAZ 4: İnsan Simülasyonu     ░░░░░░░░░░░░░░░░░░██████  2-3 gün
FAZ 5: VFS Otomasyon         ░░░░░░░░░░░░░░░░░░░░████████  3-4 gün
FAZ 6: Bildirim/Rapor        ░░░░░░░░░░░░░░░░░░░░░░░░████  1-2 gün
FAZ 7: UI & Polish           ░░░░░░░░░░░░░░░░░░░░░░░░░░████  2-3 gün

TOPLAM: ~15-22 gün (fazlar arası overlap ile ~12-15 gün)
```

---

## 🎯 İlk Adım

**FAZ 0.1** ile başlamalıyız — `Orchestrator` modülü oluştur. Bu modül tüm diğer bileşenleri koordine edecek merkezi beyindir. Mevcut `index.ts`'deki IPC handler mantığı buraya taşınacak.

---

*Bu plan yaşayan bir doküman olarak güncellenmeye devam edecektir.*
