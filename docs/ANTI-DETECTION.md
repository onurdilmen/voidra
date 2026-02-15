# 🛡️ VOIDRA — Anti-Algılama Strateji Dokümantasyonu

> Son Güncelleme: 2026-02-13
> Bu belge, WAF/bot koruma sistemlerinin algılama vektörlerini ve
> VOIDRA'nın bunlara karşı savunma stratejilerini detaylandırır.

---

## 1. WAF Algılama Vektörleri ve Karşı Önlemler

### 1.1 Browser Fingerprinting

**Tehdit:** WAF sistemleri (Cloudflare, Akamai, PerimeterX) tarayıcının
JavaScript API'lerinden toplanan verileri kullanarak benzersiz bir "parmak izi" oluşturur.
Bot yazılımları genellikle eksik veya tutarsız fingerprint verir.

**VOIDRA Stratejisi:**

```
Algılama Noktası          │ Karşı Önlem
──────────────────────────┼────────────────────────────────────────
navigator.webdriver       │ addInitScript ile undefined yapılır
navigator.plugins         │ Gerçekçi plugin dizisi enjekte edilir
navigator.languages       │ Locale ile tutarlı dil dizisi
navigator.hardwareConcurrency │ Profil bazlı sabit değer (4/8/16)
navigator.deviceMemory    │ Profil bazlı sabit değer (4/8)
navigator.platform        │ UA ile tutarlı platform string'i
screen.width/height       │ Viewport ile tutarlı ekran boyutu
WebGL renderer/vendor     │ Profil bazlı sabit GPU bilgisi
canvas fingerprint        │ Gürültü enjeksiyonu ile benzersizleştirme
AudioContext fingerprint  │ Küçük sapma enjeksiyonu
```

### 1.2 TLS Fingerprinting (JA3/JA4)

**Tehdit:** Her tarayıcının TLS el sıkışmasında (handshake) benzersiz bir parametre
seti gönderir. Headless tarayıcılar ve bundled Chromium farklı JA3 hash'i üretebilir.

**VOIDRA Stratejisi:**
- ❌ Playwright'ın bundled Chromium'u **KULLANILMAZ** (farklı TLS fingerprint riski)
- ✅ `channel: 'msedge'` ile **sistemdeki gerçek Microsoft Edge** kullanılır
- ✅ Edge, Windows'ta pre-installed → her zaman gerçek TLS fingerprint
- ✅ Fallback olarak `channel: 'chrome'` ile sistem Chrome kullanılabilir
- ✅ Headful mod (görünür pencere) → kullanıcı bizzat o pencerede gezinir

### 1.3 Behavioral Analysis (Davranış Analizi)

**Tehdit:** WAF'lar kullanıcının mouse hareketi, klavye hızı, scroll pattern'i gibi
davranışsal sinyalleri analiz eder. Bot'lar genellikle:
- Sabit hızda yazar (insan rastgele hızda yazar)
- Mouse'u düz çizgide hareket ettirir (insan eğri çizer)
- Anında tıklar (insan önce "bakar", sonra tıklar)
- Hiç scroll yapmaz (insan sayfayı keşfeder)

**VOIDRA Stratejisi (HumanInteraction modülü):**

```typescript
// ❌ BOT gibi davranış — WAF bunu yakalar
await page.fill('#email', 'user@mail.com');     // Anında doldurur
await page.click('#submit');                      // Anında tıklar

// ✅ VOIDRA insansı davranış
await typeLikeHuman(page.locator('#email'), 'user@mail.com');
// → 80-150ms arası rastgele gecikme ile karakter karakter yazar
// → Occasional typo + düzeltme simülasyonu

await clickLikeHuman(page.locator('#submit'));
// → Önce elementin üzerine hover
// → 100-300ms bekleme ("bakma" simülasyonu)
// → Sonra tıklama
```

### 1.4 IP Reputation ve Rate Limiting

**Tehdit:** Aynı IP'den çok sayıda istek → şüpheli aktivite.
Datacenter IP'leri → yüksek bot skoru.

**VOIDRA Stratejisi:**
- Profil bazlı residential/mobile proxy atama
- İstekler arası insansı bekleme süreleri
- Rate limit eşiklerini aşmamak için akıllı scheduling

### 1.5 Cookie/Session Analizi

**Tehdit:** Bot'lar genellikle çerez taşımaz, her ziyarette "yeni kullanıcı" olarak görünür.
WAF'lar ilk ziyarette challenge cookie yerleştirir, sonraki ziyarette kontrol eder.

**VOIDRA Stratejisi:**
- `storageState` ile çerezler diske kaydedilir
- Profil her açıldığında önceki çerezlerle yüklenir
- Cloudflare `cf_clearance` ve `__cf_bm` çerezleri korunur
- Session cookie'leri profil bazında izole edilir

---

## 2. Kritik "Yapma" Kuralları

### 🚫 Asla Yapılmaması Gerekenler

1. **Tracker script'leri engelleme**
   - Google Analytics, ReCaptcha, hCaptcha script'leri ENGELLENMEMELİ
   - Bu script'lerin çalışmaması WAF'a "bu bir bot" sinyali verir
   - WAF'lar kendi script'lerinin (Cloudflare challenge.js) çalışıp çalışmadığını kontrol eder

2. **Her istekte farklı fingerprint kullanma**
   - Aynı oturumda fingerprint değişmesi → %100 bot tespiti
   - VOIDRA: Profil oluşturulduğunda fingerprint sabitlenir, ASLA değişmez

3. **navigator.webdriver = false yapma**
   - `false` demek bile şüpheli → "biri bunu gizlemeye çalışıyor"
   - VOIDRA: Doğrudan `delete` veya `undefined` — property hiç yokmuş gibi

4. **Çok hızlı sayfa geçişleri**
   - İnsan bir sayfayı en az 2-3 saniye "okur"
   - VOIDRA: Sayfalar arası rastgele 2-8 saniye bekleme

5. **Headless mod kullanma**
   - Modern WAF'lar headless Chrome'u tespit edebilir
   - VOIDRA: Her zaman headful (görünür pencere) mod

---

## 3. Algılama Test Araçları

VOIDRA profillerinin güvenliğini test etmek için kullanılacak siteler:

| Site | Test Ettiği Şey | Hedef Skor |
|------|-----------------|------------|
| [creepjs.com](https://abrahamjuliot.github.io/creepjs/) | Kapsamlı fingerprint analizi | Yüksek trust score |
| [browserleaks.com](https://browserleaks.com/) | WebGL, Canvas, Font fingerprint | Tutarlı sonuçlar |
| [bot.sannysoft.com](https://bot.sannysoft.com/) | Headless/bot algılama | Tüm testler yeşil |
| [pixelscan.net](https://pixelscan.net/) | Fingerprint tutarlılık | "Consistent" sonucu |
| [whatismybrowser.com](https://www.whatismybrowser.com/) | UA/platform tutarlılık | Bilinen tarayıcı görünümü |

---

## 4. Fingerprint Üretim Stratejisi

### 4.1 Gerçekçi Kombinasyon Havuzu

VOIDRA, rastgele değil **gerçek dünya verilerine dayalı** kombinasyonlar üretir:

```
Windows Profil Şablonu:
├── UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
├── Platform: "Win32"
├── Viewport: 1920x1080 | 1536x864 | 1366x768
├── Language: "tr-TR"
├── Timezone: "Europe/Istanbul"
├── HardwareConcurrency: 8 | 12 | 16
├── DeviceMemory: 8 | 16
└── GPU: "ANGLE (NVIDIA GeForce GTX 1650)" | "ANGLE (Intel UHD Graphics 630)"

macOS Profil Şablonu:
├── UserAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
├── Platform: "MacIntel"
├── Viewport: 1440x900 | 2560x1440 | 1680x1050
├── Language: "tr-TR"
├── Timezone: "Europe/Istanbul"
├── HardwareConcurrency: 8 | 10 | 12
├── DeviceMemory: 8 | 16
└── GPU: "ANGLE (Apple M1)" | "ANGLE (Apple M2)" | "ANGLE (Intel Iris Plus Graphics)"
```

### 4.2 Fingerprint Yaşam Döngüsü

```
Profil Oluştur ──► Fingerprint Üret ──► JSON'a Kaydet
                                              │
                    ┌─────────────────────────┘
                    ▼
              Profil Aç ──► JSON'dan Oku ──► Context'e Uygula
                                              │
                    ┌─────────────────────────┘
                    ▼
              Profil Kapat ──► Fingerprint DEĞİŞMEZ
                                (Sadece session/cookie güncellenir)
```

**Kritik Kural:** Fingerprint, profil silinene kadar **ASLA** değişmez.
Güncelleme gerekiyorsa (örn: Chrome sürümü eskidi), yeni profil oluşturulmalıdır.
