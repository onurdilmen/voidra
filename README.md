<p align="center">
  <h1 align="center">🌀 VOIDRA</h1>
  <p align="center"><strong>"Görünmeden Geç."</strong></p>
  <p align="center">
    Özel Anti-Detect Tarayıcı & VFS Global Randevu Otomasyon Motoru
  </p>
</p>

---

## 🎯 Nedir?

**VOIDRA**, kullanıcının kendi elleriyle internette gezinebildiği, her profilde farklı dijital kimlik taşıyan özel bir anti-detect tarayıcıdır. VFS Global randevu süreçleri için başvuru havuzu ve otomatik form doldurma özellikleri sunar.

- 🌐 **Özel Tarayıcı** — Electron kontrol paneli + Playwright ile gerçek Edge/Chrome pencereleri
- 🔒 **İzole Profiller** — Her profil kendi çerez, localStorage, proxy ve parmak iziyle çalışır
- 🧬 **Tutarlı Parmak İzi** — Profil her açıldığında aynı dijital kimlikle görünür
- � **Proxy Yönetimi** — Profil bazlı proxy atama ve yönetimi
- 📋 **Başvuru Havuzu** — Kişi bilgileri havuzu + tek tıkla otomatik form doldurma
- 🤖 **İnsansı Motor** — WAF sistemlerini atlatan gerçekçi klavye/mouse simülasyonu
- 🎨 **Modern UI** — Electron tabanlı, glassmorphism temalı kontrol paneli

## 🏗️ Nasıl Çalışır?

```
┌─────────────────────────────────────────────────────┐
│              VOIDRA (Electron App)                    │
│                                                     │
│  [Dashboard]  [Profiller]  [Havuz]  [Ayarlar]       │
│                    │                                 │
│           "Profili Aç" butonuna bas                  │
│                    │                                 │
│                    ▼                                 │
│        Playwright → Edge penceresi açılır            │
│        (gerçek TLS fingerprint!)                     │
│                    │                                 │
│        Kullanıcı bu pencerede serbest gezinir        │
│        VFS formuna gelince → Auto-Fill aktif!        │
└─────────────────────────────────────────────────────┘
```

## 🚀 Hızlı Başlangıç

### Ön Gereksinimler
- **Node.js** ≥ 20 LTS
- **Microsoft Edge** (Windows'ta zaten yüklü) veya **Google Chrome**

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# NOT: "npx playwright install" ÇALIŞTIRMA!
# Sistem tarayıcısı (Edge/Chrome) kullanıyoruz.

# Geliştirme modunda çalıştır
npm run dev

# Üretim derlemesi
npm run build

# Windows installer oluştur
npm run build:win
```

## 📁 Proje Yapısı

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
│   │   └── DataPoolManager.ts       # Başvuru havuzu yönetimi
│   ├── automation/                  # Otomasyon modülleri
│   │   ├── AutoFillEngine.ts        # Form algılama + otomatik doldurma
│   │   ├── HumanInteraction.ts      # İnsansı etkileşim motoru
│   │   ├── FormDetector.ts          # VFS form pattern algılama
│   │   └── AppointmentHunter.ts     # Randevu arama + yakalama
│   ├── ui/                          # Electron UI katmanı
│   │   ├── main/                    # Electron ana süreç
│   │   ├── renderer/                # React renderer
│   │   └── assets/                  # UI varlıkları (ikon, font)
│   ├── scripts/                     # Tarayıcıya enjekte edilecek scriptler
│   │   ├── fingerprint-inject.ts    # Navigator/screen override
│   │   ├── autofill-content.ts      # Auto-fill content script
│   │   └── form-detector.ts         # VFS form algılama
│   ├── models/                      # Veri modelleri
│   │   ├── Profile.ts               # Profil arayüzleri
│   │   ├── Fingerprint.ts           # Parmak izi arayüzleri
│   │   ├── Applicant.ts             # Başvuru sahibi arayüzleri
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
│   └── pool/                        # Başvuru havuzu verileri
├── browser_data/                    # Playwright persistent context verileri
├── docs/                            # Dokümantasyon
│   ├── ROADMAP.md                   # Geliştirme yol haritası
│   ├── ARCHITECTURE.md              # Mimari dokümantasyon
│   ├── ANTI-DETECTION.md            # Anti-algılama stratejileri
│   └── TECH-STACK.md                # Teknoloji yığını
├── tests/                           # Test dosyaları
├── package.json
├── tsconfig.json
├── .gitignore
└── .env.example                     # Çevre değişkenleri şablonu
```

## 🛡️ Anti-Algılama Yaklaşımı

VOIDRA, WAF sistemlerinin (Cloudflare, Akamai, PerimeterX) bot tespitinde kullandığı tüm vektörlere karşı savunma katmanları içerir:

| Algılama Vektörü | VOIDRA Çözümü |
|---|---|
| Browser Fingerprint | Profil bazlı tutarlı parmak izi |
| TLS Fingerprint | **Gerçek Edge/Chrome** (`channel: 'msedge'`), bundled Chromium yok! |
| IP Reputation | Profil bazlı proxy rotasyonu |
| Behavioral Analysis | İnsansı etkileşim motoru + kullanıcı bizzat gezinir |
| Cookie/Session | Persistent context + kalıcı çerezler |
| JavaScript Execution | Headful mod, gerçek DOM, kullanıcı etkileşimi |

## 🖥️ Desteklenen Platformlar

| Platform | Tarayıcı Motoru | Durum |
|----------|----------------|-------|
| **Windows 10/11** | Microsoft Edge (pre-installed) | ✅ Birincil |
| **macOS** | Chrome veya Edge | ✅ Desteklenir |

## 📝 Lisans

Bu proje kişisel kullanım amaçlıdır.
