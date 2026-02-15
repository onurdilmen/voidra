# 🔧 VOIDRA — Teknoloji Yığını ve Bağımlılık Haritası

> Son Güncelleme: 2026-02-13
> Mimari: **Konsept B — Özel Anti-Detect Tarayıcı**

---

## 1. Core Teknoloji Yığını

### 1.1 Runtime ve Dil

| Teknoloji | Sürüm | Rol | Neden? |
|-----------|-------|-----|--------|
| **Node.js** | ≥ 20 LTS | Runtime ortamı | Asenkron I/O, geniş ekosistem, Playwright uyumu |
| **TypeScript** | ≥ 5.3 | Programlama dili | Tip güvenliği, IDE desteği, refactoring kolaylığı |
| **tsx** | Latest | TS runner | Derleme adımı olmadan doğrudan .ts çalıştırma (geliştirme) |

### 1.2 Tarayıcı Motoru

| Teknoloji | Sürüm | Rol | Neden? |
|-----------|-------|-----|--------|
| **Playwright** | ≥ 1.41 | Tarayıcı kontrolü | En gelişmiş auto-wait, BrowserContext izolasyonu, addInitScript |
| **Microsoft Edge** | Sistem yüklü | Tarayıcı motoru | Gerçek TLS fingerprint, Windows'ta pre-installed |
| **Google Chrome** | Sistem yüklü (fallback) | Alternatif motor | En yaygın tarayıcı, en düşük bot şüphesi |

> **⚠️ KRİTİK KARAR: Bundled Chromium KULLANILMAYACAK!**
>
> Playwright'ın kendi indirdiği Chromium binary'si (`npx playwright install chromium`) **kullanılmayacak**.
> Bunun yerine sistem tarayıcısı kullanılacak:
>
> ```typescript
> // ✅ DOĞRU — Gerçek Edge (Windows'ta her zaman mevcut)
> const browser = await chromium.launch({ channel: 'msedge' });
>
> // ✅ DOĞRU — Gerçek Chrome (kullanıcıda yüklüyse)
> const browser = await chromium.launch({ channel: 'chrome' });
>
> // ❌ YANLIŞ — Playwright Chromium (sahte TLS, +180MB boyut)
> const browser = await chromium.launch();
> ```
>
> **Sebepleri:**
> - Gerçek TLS fingerprint → WAF'lar normal kullanıcı gibi görür
> - Windows'ta Edge pre-installed → kullanıcıya ek yük yok
> - Uygulama boyutu ~180 MB azalır
> - Anti-detect için en güvenli yaklaşım

### 1.3 Masaüstü Uygulaması

| Teknoloji | Sürüm | Rol | Neden? |
|-----------|-------|-----|--------|
| **Electron** | ≥ 28 | Masaüstü uygulama kabuğu | Kontrol paneli UI, IPC hub, sistem tray |
| **React** | ≥ 18 | UI framework | Component tabanlı, geniş ekosistem |
| **Vite** | ≥ 5 | Build tool | Hızlı HMR, minimal konfigürasyon |
| **Framer Motion** | ≥ 11 | Animasyon kütüphanesi | Declarative animasyonlar, gesture desteği |

> **Electron'un Rolü Değişti!**
>
> Eski mimari: Electron = Tarayıcının kendisi (BrowserView ile)
> Yeni mimari: Electron = **Sadece kontrol paneli** (profil yönetimi, havuz, ayarlar)
>
> Tarayıcı pencereleri **Playwright** tarafından açılır ve yönetilir.
> Kullanıcı bu Playwright pencerelerinde serbest gezinir.

### 1.4 UI Tasarım Sistemi

| Teknoloji | Rol | Neden? |
|-----------|-----|--------|
| **Vanilla CSS** | Ana stil sistemi | Maksimum kontrol, glassmorphism özel efektler |
| **CSS Custom Properties** | Tema sistemi | Runtime tema değişimi, profil bazlı renk kodlama |
| **Google Fonts** | Tipografi | Inter/Outfit — modern, okunabilir |
| **Lucide Icons** | İkon seti | Hafif, SVG tabanlı, tutarlı tasarım dili |

---

## 2. Geliştirme Araçları

| Araç | Rol | Neden? |
|------|-----|--------|
| **ESLint** | Kod kalitesi | Hata önleme, tutarlı stil |
| **Prettier** | Kod formatlama | Otomatik formatlama, tartışmasız stil |
| **Vitest** | Test framework | Vite uyumu, hızlı çalışma, TypeScript desteği |
| **nodemon** | Hot-reload (CLI) | Geliştirme sırasında otomatik yeniden başlatma |
| **electron-builder** | Paketleme | Windows .exe ve macOS .dmg oluşturma |

---

## 3. Veri Yönetimi

| Yaklaşım | Rol | Neden? |
|-----------|-----|--------|
| **JSON dosyalar** | Profil/fingerprint/havuz depolama | Basitlik, taşınabilirlik, kolay yedekleme |
| **AES-256 şifreleme** | Hassas veri koruma | Başvuru havuzundaki kişisel veriler şifreli |
| **Playwright storageState** | Çerez/localStorage kalıcılığı | Native API, güvenilir serializasyon |
| **Dosya sistemi** | Persistent browser data | Playwright'ın native desteklediği yaklaşım |

> **Neden SQLite/MongoDB değil?**
> - Profil ve başvuru sayısı düşük (10-100 arası) → veritabanı overhead'i gereksiz
> - Her profil bağımsız JSON dosyası = kolayca kopyalanabilir/taşınabilir
> - Git ile versiyonlanabilir (gizli bilgiler hariç)
> - Gelecekte gerekirse kolayca veritabanına migrate edilebilir

---

## 4. Proje Yapılandırma Dosyaları

### 4.1 package.json Yapısı

```json
{
  "name": "voidra",
  "version": "0.1.0",
  "description": "Anti-Detect Tarayıcı & VFS Global Randevu Otomasyon Motoru",
  "main": "src/ui/main/main.ts",
  "scripts": {
    "dev": "electron-vite dev",
    "start": "electron-vite preview",
    "build": "electron-vite build",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "test": "vitest",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "keywords": ["anti-detect", "browser", "playwright", "automation", "voidra"],
  "author": "YASO",
  "license": "UNLICENSED",
  "private": true
}
```

### 4.2 tsconfig.json Yapısı

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@managers/*": ["src/managers/*"],
      "@models/*": ["src/models/*"],
      "@utils/*": ["src/utils/*"],
      "@automation/*": ["src/automation/*"],
      "@ui/*": ["src/ui/*"],
      "@scripts/*": ["src/scripts/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "data", "browser_data"]
}
```

---

## 5. Bağımlılık Haritası

```
CORE DEPENDENCIES (Zorunlu)
─────────────────────────────
playwright          → Tarayıcı kontrolü (channel: 'msedge')
typescript          → Geliştirme dili
electron            → Masaüstü uygulama kabuğu

UI DEPENDENCIES
─────────────────────────────
react               → UI framework
react-dom           → React DOM renderer
vite                → Build tool
framer-motion       → Animasyonlar
lucide-react        → İkonlar

DEV DEPENDENCIES (Geliştirme)
─────────────────────────────
tsx                 → TypeScript çalıştırıcı
@types/node         → Node.js tip tanımları
eslint              → Kod kalitesi
prettier            → Kod formatlama
vitest              → Test framework
electron-builder    → Uygulama paketleme
electron-vite       → Electron + Vite entegrasyonu
```

---

## 6. Kullanıcı Kurulum Gereksinimleri

### 6.1 Son Kullanıcı (Installer ile)

| Platform | Ön Gereksinim | Kurulum |
|----------|--------------|---------|
| **Windows 10/11** | Microsoft Edge (pre-installed ✅) | `VOIDRA-Setup.exe` çift tıkla |
| **macOS** | Chrome veya Edge yüklü olmalı | `VOIDRA.dmg` sürükle-bırak |

### 6.2 Geliştirici (Kaynak koddan)

```bash
# Ön gereksinimler
# - Node.js ≥ 20
# - Microsoft Edge VEYA Google Chrome yüklü

# Kurulum
git clone <repo-url>
cd voidra
npm install

# NOT: npx playwright install ÇALIŞTIRMA!
# Sistem tarayıcısı (Edge/Chrome) kullanıyoruz, bundled Chromium değil.

# Geliştirme
npm run dev
```

### 6.3 Uygulama Boyutu Tahmini

| Bileşen | Boyut |
|---------|-------|
| Electron runtime | ~90 MB |
| Uygulama kodu + React | ~20 MB |
| Bağımlılıklar (node_modules) | ~30 MB |
| **Toplam (.exe installer)** | **~140 MB** |

> ✅ Playwright Chromium bundle edilmiyor → **~180 MB tasarruf!**
> Karşılaştırma: Multilogin ~400 MB, GoLogin ~350 MB

---

## 7. Klasör Adlandırma Kuralları (VOIDRA Branding)

| Konum | Adlandırma | Örnek |
|-------|-----------|-------|
| GitHub repo | `voidra` | github.com/YASO/voidra |
| Ana klasör | `voidra/` | Proje kök dizini |
| Profil dosyaları | `voidra_prof_{id}` | `voidra_prof_a1b2c3.json` |
| Fingerprint dosyaları | `voidra_fp_{id}` | `voidra_fp_a1b2c3.json` |
| Session dosyaları | `voidra_sess_{id}` | `voidra_sess_a1b2c3.json` |
| Havuz dosyaları | `voidra_pool` | `voidra_pool_applicants.json` |
| Log dosyaları | `voidra_{tarih}.log` | `voidra_2026-02-13.log` |
| Ana sınıf | `VoidraEngine` | Motor orkestratörü |
| npm package name | `voidra` | package.json > name |
| Electron app name | `VOIDRA` | Pencere başlığı |
| Config dosyası | `.voidra.config.json` | Kök dizindeki yapılandırma |

---

## 8. Ortam Değişkenleri

```env
# .env.example — VOIDRA Çevre Değişkenleri

# Genel
VOIDRA_ENV=development
VOIDRA_LOG_LEVEL=debug
VOIDRA_DATA_DIR=./data
VOIDRA_BROWSER_DATA_DIR=./browser_data

# Tarayıcı
VOIDRA_HEADLESS=false
VOIDRA_BROWSER_CHANNEL=msedge
VOIDRA_SLOW_MO=0

# Proxy (Varsayılan — profil bazlı override edilebilir)
VOIDRA_DEFAULT_PROXY_SERVER=
VOIDRA_DEFAULT_PROXY_USERNAME=
VOIDRA_DEFAULT_PROXY_PASSWORD=

# VFS Global
VOIDRA_VFS_BASE_URL=https://visa.vfsglobal.com
VOIDRA_VFS_CHECK_INTERVAL_MS=30000
VOIDRA_VFS_MAX_RETRIES=3

# Bildirimler
VOIDRA_TELEGRAM_BOT_TOKEN=
VOIDRA_TELEGRAM_CHAT_ID=
VOIDRA_DISCORD_WEBHOOK_URL=

# Güvenlik
VOIDRA_ENCRYPTION_KEY=
```
