# VFS Global 403 Bypass — Kök Neden Analizi ve Çözüm Stratejisi

> Tarih: 2026-02-14 | VOIDRA Deep Analysis

---

## 🔴 MEVCUT DURUMUN ÖZETİ

### Ne Çalışıyor ✅
- Gerçek Edge binary (`channel: 'msedge'`) → TLS fingerprint gerçek
- Pipe transport (TCP port yok) → Port taraması riski yok
- `ignoreDefaultArgs` → Otomasyon flag'leri temiz
- Ana sayfaya navigasyon → Cloudflare challenge geçiliyor
- `__cf_bm` cookie alınıyor ✅

### Ne Çalışmıyor ❌
- `/login` endpoint'ine ulaşınca → **403201** (bot tespit edildi)
- Doğal buton tıklama ile gidince bile → 403201
- Direkt URL ile gidince → 403201

---

## 🔍 KÖK NEDEN ANALİZİ — "403201 NEDEN VERİYOR?"

### Tespit Noktası 1: `Runtime.enable` CDP Sızıntısı 🔴
**Mevcut Sorun:** `rebrowser-patches` entegre edilmiş AMA çalışıyor mu doğrulanmamış.

```
SessionManager.ts satır 85:
chromium.launchPersistentContext(userDataDir, { channel: 'msedge' })
```

Bu, `chromium.launchPersistentContext()` kullanıyor — yani Playwright hâlâ tam CDP 
kontrolü yapıyor. `rebrowser-patches` olsa bile:
- `Runtime.enable` komutu gönderiliyor olabilir
- Cloudflare bunu sayfadaki JS ile tespit ediyor

**Kanıt:** `index.ts` satır 12-13'te patch env var'ları ayarlanıyor ama 
bunların launchPersistentContext ile uyumluluğu TEST EDİLMEMİŞ.

### Tespit Noktası 2: `addInitScript` Sızıntısı 🟡
**Mevcut Sorun:** StealthEngine `context.addInitScript()` kullanıyor.

```
StealthEngine.ts satır 159:
await context.addInitScript(script);
```

`addInitScript` → Playwright'ın `Page.addScriptToEvaluateOnNewDocument` CDP 
komutuna denk gelir. Cloudflare bunu tespit edebilir:
- Script enjeksiyon zamanlaması farklı
- Enjekte edilen script'in varlığı kontrol edilebilir

### Tespit Noktası 3: Playwright Process Sinyalleri 🟡
Playwright `launchPersistentContext` ile başlatılan tarayıcıya şu argümanları 
otomatik ekler (ignoreDefaultArgs ile bazılarını kaldırsak bile):
- `--remote-debugging-pipe` (pipe transport için)
- `--no-startup-window` (bazı durumlarda)
- Chrome DevTools bağlantı izleri

### Tespit Noktası 4: `cf_clearance` Cookie Eksikliği 🔴
Mevcut kodda `waitForCloudflareChallenge` fonksiyonu sadece sayfa title'ına bakıyor:
```
if (!title.toLowerCase().includes('just a moment'))
```
Ama Cloudflare Turnstile, **görünmez** challenge yapabilir — title değişmez!
Bu durumda `cf_clearance` cookie üretilmez → login 403.

### Tespit Noktası 5: IP Reputation 🟠
Daha önce yapılan otomasyon denemeleri IP'yi flaglemiş olabilir.
Cloudflare'ın IP blacklist'i agresif ve uzun süreli.

---

## 🏗️ ÇÖZÜM STRATEJİLERİ — 3 KADEMELİ YAKLAŞIM

---

### 📦 Kademe 1: Mevcut Altyapıyı İyileştirme (Hızlı Düzeltmeler)

**Başarı Tahmini: %40-50**

#### 1A. rebrowser-patches Doğrulaması
```bash
# Debug modunda çalıştır
set REBROWSER_PATCHES_DEBUG=1
npm run dev
```
- Console'da `[rebrowser-patches]` mesajlarını kontrol et
- `Runtime.enable` gerçekten engellenmiş mi?

#### 1B. Stealth Script'i Kaldır
`addInitScript` kullanmayı TAMAMEN DURDUR.
Gerçek Edge binary zaten `navigator.webdriver = false` döndürmez.
`addInitScript` kullanmak sızıntı riski ekliyor.

#### 1C. cf_clearance Cookie Bekleme İyileştirmesi
Cookie appearance'ı bekle, title değil:
```typescript
// Title yerine cookie bekle
while (Date.now() - start < maxWait) {
    const cookies = await page.context().cookies();
    const hasClearance = cookies.some(c => c.name === 'cf_clearance');
    if (hasClearance) break;
    await page.waitForTimeout(2000);
}
```

#### 1D. İnsan Davranışı Artır
Mevcut: 2-3 mouse hareketi + 1 scroll
Gereken: Çok daha fazla etkileşim — EN AZ 10-15 saniye sayfa keşfi.

---

### 📦 Kademe 2: Teknoloji Değişikliği — `playwright-extra` + Stealth Plugin

**Başarı Tahmini: %60-70**

#### Neden?
`puppeteer-extra-plugin-stealth` deprecated olmuş AMA `playwright-extra` 
hala aktif ve Playwright ile doğrudan çalışıyor. Bu plugin:
- Canvas/WebGL fingerprint gürültüsü ekler
- Chrome runtime objeleri spoof eder (Edge için de geçerli)
- `addInitScript` yerine daha düşük seviyeli enjeksiyon kullanır
- CDP sızıntılarını daha iyi maskeler

#### Kurulum
```bash
npm install playwright-extra puppeteer-extra-plugin-stealth
```

#### Kullanım
```typescript
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'msedge',
    headless: false,
    // ... mevcut config
});
```

#### ⚠️ Uyumluluk Notu
`rebrowser-playwright` ile `playwright-extra` AYNI ANDA kullanılamaz.
Birini seçmek gerekiyor:
- **Seçenek A:** `rebrowser-playwright` + manuel stealth (mevcut)
- **Seçenek B:** `playwright-extra` + stealth plugin (önerilen)

---

### 📦 Kademe 3: Radikal Mimari Değişiklik — Hibrit Yaklaşım ⭐ ÖNERİLEN

**Başarı Tahmini: %85-95**

#### Konsept: "Playwright'sız Login, Playwright'lı Otomasyon"

```
┌─────────────────────────────────────────────────────┐
│                    VOIDRA v2                         │
│                                                     │
│  AŞAMA 1: Login (Playwright YOK)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │ 1. child_process.spawn → Gerçek Edge          │  │
│  │ 2. Kullanıcı ELLE login olur                  │  │
│  │ 3. Cookie/session otomatik kaydedilir          │  │
│  │ 4. Login başarılı → sinyal gönder              │  │
│  └───────────────────────────────────────────────┘  │
│                       ↓                             │
│  AŞAMA 2: Otomasyon (Playwright CDP bağlantısı)     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 1. connectOverCDP → Login olmuş tarayıcıya     │  │
│  │    bağlan                                     │  │
│  │ 2. Cookie zinciri ZATEN mevcut                 │  │
│  │ 3. Auto-fill + Randevu arama                  │  │
│  │ 4. İnsan-benzeri davranış simülasyonu          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### Neden Bu Çalışır?

1. **Login anında Playwright YOK** → CDP sızıntısı yok, Runtime.enable yok
2. **Gerçek Edge tamamen saf** → TLS fingerprint %100 gerçek
3. **Kullanıcı elle login** → Turnstile otomatik geçer (insan doğrulaması)
4. **Login sonrası CDP bağlantı** → Sadece form doldurma/navigasyon için
5. **Cloudflare login'de sıkı, sonrasında gevşek** → Login geçilince güvenli

#### Teknik Uygulama

```typescript
// AŞAMA 1: Saf Edge başlat (Playwright olmadan!)
import { spawn } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const edgeProcess = spawn(edgePath, [
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-port=0',  // Rastgele port — sonra bağlanılacak
    '--no-first-run',
    '--no-default-browser-check',
    'https://visa.vfsglobal.com/tur/en/nld',  // Direkt ana sayfaya git
], { detached: true });

// Edge'in debug port'unu bul (stderr'den okur)
// Port bilgisi: DevTools listening on ws://127.0.0.1:XXXXX/devtools/browser/...
```

```typescript
// AŞAMA 2: Kullanıcı login olduktan sonra → CDP ile bağlan
import { chromium } from 'playwright'; // veya rebrowser-playwright

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
const context = browser.contexts()[0];
const page = context.pages()[0];

// Artık login olmuş sayfada otomasyon yapılabilir
await autoFillForm(page, applicant, profileId);
```

#### Bu Yaklaşımın Avantajları
| Özellik | Mevcut (Kademe 0) | Kademe 3 (Hibrit) |
|---|---|---|
| Login anında CDP | ✅ Aktif (sızıntı riski) | ❌ YOK (sıfır risk) |
| TLS Fingerprint | ✅ Gerçek Edge | ✅ Gerçek Edge |
| Runtime.enable | ⚠️ rebrowser-patches ile | ❌ Login'de Playwright yok |
| addInitScript | ⚠️ Stealth script | ❌ Login'de script yok |
| Turnstile | ⚠️ Otomatik geçmeye çalış | ✅ İnsan elle geçer |
| Cloudflare tespit | 🔴 Yüksek risk | 🟢 Minimal risk |

---

## 🔧 ALTERNATİF TEKNOLOJİLER DEĞERLENDİRMESİ

### 1. Camoufox (Firefox Anti-Detect)
| Özellik | Değerlendirme |
|---|---|
| Dil | Python (Node.js entegrasyonu zor) |
| Tarayıcı | Firefox (farklı TLS fingerprint ✅) |
| Durum (2026) | Aktif geliştirmede ama performans sorunları |
| VOIDRA uyumu | ❌ — Proje TypeScript/Node.js tabanlı |
| Alternatif | Node.js wrapper var (`@askjo/camoufox-browser`) ama REST API |

**Sonuç:** Doğrudan entegrasyon zor. Python subprocess olarak kullanılabilir ama karmaşıklık artar.

### 2. playwright-extra + stealth plugin
| Özellik | Değerlendirme |
|---|---|
| Dil | TypeScript/Node.js ✅ |
| Uyumluluk | rebrowser-playwright ile çakışır ⚠️ |
| Etkinlik | Temel fingerprint koruma, yeterli olmayabilir |
| Kullanım | Drop-in replacement, kolay entegre |

**Sonuç:** Kademe 2 için uygun ama tek başına yetmeyebilir.

### 3. CAPTCHA Çözücü Servisler (2Captcha, CapSolver)
| Özellik | Değerlendirme |
|---|---|
| Turnstile desteği | ✅ Var |
| Maliyet | $2-3 per 1000 çözüm |
| Güvenilirlik | %90+ başarı oranı |
| Entegrasyon | API tabanlı, kolay |

**Sonuç:** Kademe 3 ile birlikte kullanılabilir. Login'de insan geçerse zaten gerekmez.

### 4. Browserless.io / ScrapFly API
| Özellik | Değerlendirme |
|---|---|
| Özellik | Managed anti-detect + proxy + CAPTCHA |
| Maliyet | Aylık abonelik |
| Kontrol | Daha az kontrol, daha çok bağımlılık |

**Sonuç:** Overkill — VOIDRA kendi altyapısını zaten sağlıyor.

---

## 📋 ÖNERİLEN UYGULAMA PLANI

### Faz 1: Acil Test (Bugün) — 30 dakika
1. **IP Testi:** Normal Edge'de VFS login sayfasını aç
   - Çalışıyorsa → Sorun otomasyon tespitinde
   - Çalışmıyorsa → Modem restart veya mobil hotspot
2. **rebrowser-patches Debug:** `REBROWSER_PATCHES_DEBUG=1` ile çalıştır

### Faz 2: Kademe 1 Düzeltmeleri — 1-2 saat
1. StealthEngine addInitScript'i kaldır
2. cf_clearance cookie bekleme mekanizmasını düzelt
3. İnsan davranış simülasyonunu güçlendir
4. Test et

### Faz 3: Kademe 3 Hibrit Mimari — 3-4 saat ⭐
1. `child_process.spawn` ile saf Edge başlatma
2. Kullanıcı login UI akışı (Electron'dan yönetim)
3. Login sonrası CDP bağlantı mekanizması
4. Auto-fill entegrasyonu
5. Tam test

---

## 🎯 TAVSİYEM

**Kademe 3 (Hibrit Yaklaşım)** direkt uygulanmalı. Sebepleri:

1. Login sırasında Playwright'ın hiçbir izi yok → Cloudflare bunu tespit edemez
2. Kullanıcı zaten tarayıcı başında — elle login 30 saniye sürer
3. Login sonrasında Cloudflare geçiş yumuşak — CDP sızıntısı tolere edilir
4. Bu yaklaşım `vfsauto` (BAS tabanlı) projesinin de kullandığı paradigmadır:
   "İnsan login yapsın, bot form doldursun"
5. En az teknoloji değişikliği gerektirir (mevcut altyapı büyük ölçüde korunur)
