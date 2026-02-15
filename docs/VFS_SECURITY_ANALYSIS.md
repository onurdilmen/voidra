# VFS Global Güvenlik Analizi — Tam Rapor
> Tarih: 2026-02-13 | Araştırmacı: VOIDRA Team

## 1. Genel Bakış

VFS Global, vize başvuru süreçlerini yöneten dünyanın en büyük outsourcing şirketidir.
Web sitesi (`visa.vfsglobal.com`) agresif bot-tespit mekanizmaları kullanmaktadır.
Özellikle `/login` endpoint'i ekstra koruma altındadır ve `403201` hata kodu
otomasyon tespiti yapıldığında döndürülür.

---

## 2. Güvenlik Katmanları

### Katman 1: Cloudflare WAF (Web Application Firewall)
- **Seviye:** 🔴 Kritik
- **Açıklama:** Tüm trafik Cloudflare üzerinden geçer
- **Tespit yöntemleri:**
  - IP reputation kontrolü
  - HTTP header analizi
  - Request rate limiting
  - Geographic anomaly detection
- **Cookie'ler:** `__cf_bm`, `cf_clearance`, `__cfseq`, `__cflb`
- **Notlar:** `__cf_bm` bot management cookie'si, `cf_clearance` ise Cloudflare challenge'ını
  başarıyla geçtiğinizi kanıtlayan cookie'dir. Bu cookie olmadan login endpointine erişim reddedilir.

### Katman 2: Cloudflare Turnstile (CAPTCHA Alternatifi)
- **Seviye:** 🔴 Kritik
- **Açıklama:** Görünmez CAPTCHA sistemi — kullanıcıdan bulmaca çözmesini istemez,
  arka planda davranışsal analiz yapar
- **Tespit yöntemleri:**
  - Mouse hareketleri analizi
  - Klavye tuşlama kalıpları
  - Scroll davranışı
  - Sayfa etkileşim süresi
  - JavaScript challenge çözümleme
  - Proof-of-Work bulmacaları
- **Notlar:** Turnstile başarılı olursa `cf-turnstile-response` token'ı üretir.
  Bu token login API'sine gönderilmelidir.

### Katman 3: TLS Fingerprinting (JA3/JA4)
- **Seviye:** 🔴 Kritik
- **Açıklama:** TLS handshake sırasında tarayıcının "parmak izi" alınır
- **Tespit yöntemleri:**
  - JA3: Cipher suite'ler, TLS uzantıları, sıralaması
  - JA4: JA3 + ALPN + TCP/IP seviyesi davranış (MSS, window size, options)
- **Neden önemli:** Playwright/Puppeteer kullanarak bile gerçek tarayıcı başlatılsa bile,
  eğer TLS stack farklıysa (örn. Node.js HTTP client), fingerprint uyuşmazlığı tespit edilir
- **Çözüm:** Gerçek tarayıcı motoru kullanmak (CDP bağlantısı ile)

### Katman 4: CDP Runtime.enable Leak
- **Seviye:** 🟡 Yüksek
- **Açıklama:** Playwright/Puppeteer `Runtime.enable` CDP komutunu kullanır.
  Bu komut `Runtime.consoleAPICalled` event'ini tetikler ve Cloudflare bunu tespit edebilir.
- **Tespit yöntemleri:**
  - `Runtime.enable` event emission kontrolü
  - `Runtime.consoleAPICalled` dinleme
  - CDP bağlantısı izleri
- **Çözüm:** rebrowser-patches (Runtime.enable fix) veya connectOverCDP yaklaşımı

### Katman 5: Browser Fingerprinting
- **Seviye:** 🟡 Yüksek
- **Açıklama:** Tarayıcının benzersiz özelliklerini analiz eder
- **Tespit yöntemleri:**
  - Canvas fingerprinting (2D render farklılıkları)
  - WebGL fingerprinting (GPU bilgileri)
  - AudioContext fingerprinting
  - Plugin/Extension listesi
  - Screen resolution / color depth
  - Font enumeration
  - Platform ve hardware bilgileri
- **Notlar:** Headless tarayıcılar farklı canvas/webgl render'ları üretir

### Katman 6: navigator.webdriver Detection
- **Seviye:** 🟠 Orta
- **Açıklama:** `navigator.webdriver === true` olması otomasyon tespitinin en basit yolu
- **Tespit yöntemleri:**
  - `navigator.webdriver` property kontrolü
  - `window.chrome` varlığı
  - `Notification.permission` durumu
  - `navigator.permissions.query` sonuçları
- **Çözüm:** `--disable-blink-features=AutomationControlled` flag'i + CDP override

### Katman 7: Rate Limiting
- **Seviye:** 🟠 Orta
- **Açıklama:** Aynı IP'den çok sık istek = blok
- **Kurallar:**
  - Login denemesi: Muhtemelen 3-5 deneme/saat
  - Sayfa yüklemesi: Muhtemelen 20-30 istek/dakika
  - API çağrısı: Muhtemelen 10 istek/dakika
- **Blok süresi:** Genellikle 2 saat (kullanıcı raporlarına göre)
- **Çözüm:** Uzun gecikmeler, proxy rotasyonu

### Katman 8: Cookie Chain Validation
- **Seviye:** 🟡 Yüksek
- **Açıklama:** Cloudflare'ın cookie zinciri doğru sırayla alınmalıdır
- **Akış:**
  1. İlk ziyaret → `__cf_bm` cookie alınır
  2. Turnstile challenge → `cf_clearance` cookie alınır
  3. Login isteği → Her iki cookie gönderilmeli
- **Notlar:** Direkt /login URL'sine gitmek bu zinciri atlayabilir → 403

### Katman 9: Proof-of-Work Challenges
- **Seviye:** 🟠 Orta
- **Açıklama:** JavaScript tabanlı hesaplama bulmacaları
- **Tespit yöntemleri:**
  - Tarayıcının JS çalıştırma hızı (headless daha hızlı = şüpheli)
  - Web API probe'ları (gerçek tarayıcı API'leri test edilir)
  - Device space analizi

### Katman 10: IP Reputation
- **Seviye:** 🔴 Kritik
- **Açıklama:** Cloudflare global IP reputation veritabanı
- **Kontroller:**
  - Datacenter IP mi? (VPN/proxy tespiti)
  - Residential IP mi?
  - Geolocation tutarlılığı (IP Türkiye ama timezone farklı = şüpheli)
  - Tarihsel aktivite (önceki bloklar)
  - ISP bilgisi
- **Notlar:** Datacenter/VPN IP'leri çoğunlukla otomatik bloklanır

---

## 3. 403201 Hata Kodu Analizi

### Tanım
`403201` VFS Global'in kendi özel hata kodudur (standart HTTP 403'ün alt kodu).
Backend API'den döner ve şu anlama gelir:
**"Erişiminiz kısıtlandı — otomasyon/bot şüphesi veya rate limit aşıldı"**

### Tetiklenme Koşulları
1. **TLS fingerprint uyumsuzluğu** — Tarayıcı gerçek görünmüyor
2. **`cf_clearance` cookie eksik** — Cloudflare challenge tamamlanmamış
3. **`__cf_bm` cookie bozuk/süresi dolmuş** — Bot management tespiti
4. **CDP `Runtime.enable` sızıntısı** — Otomasyon kütüphanesi tespit edilmiş
5. **IP flaglenmiş** — Önceki otomatik erişimlerden dolayı
6. **Rate limit aşılmış** — Çok sık login denemesi
7. **Doğrudan /login URL'sine navigasyon** — Cookie zinciri atlanmış

### Kullanıcı Raporları (Reddit/GitHub)
- "2 saat bekledikten sonra düzeldi" — Rate limiting/IP cool-down
- "Farklı tarayıcıda çalıştı" — Cookie/fingerprint farkı
- "Modem restart ile düzeldi" — Yeni IP adresi
- "Mobil hotspot ile çalıştı" — Residential IP vs fixed IP
- "Yeni hesap oluşturdum, çalıştı" — Hesap-bazlı rate limiting

---

## 4. Bypass Stratejileri

### Strateji A: ConnectOverCDP (Mevcut Yaklaşım) ✅
- Gerçek Edge/Chrome'u manuel başlat
- CDP ile bağlan
- Playwright HİÇBİR flag ekleyemez
- TLS fingerprint = gerçek tarayıcı
- **Risk:** CDP bağlantısı hala `Runtime.enable` leak yapabilir

### Strateji B: Cookie Zinciri Doğru Yönetimi ⚠️
- Ana sayfayı yükle → `__cf_bm` al
- Turnstile challenge'ını doğal geç → `cf_clearance` al
- Cookie'lerle birlikte login sayfasına git
- **DİKKAT:** Direkt /login URL'sine GİTME

### Strateji C: İnsan-Benzeri Davranış 🎯
- Random delay'ler (2-5 saniye arası)
- Mouse hareketleri simülasyonu
- Scroll davranışı
- Sayfa elementlerine hover
- Gerçekçi typing hızı

### Strateji D: IP Yönetimi 🌐
- Residential proxy kullan
- Modem restart (yeni IP)
- Mobil hotspot (4G/5G IP)
- Proxy rotasyonu

### Strateji E: Session Yönetimi 🔄
- Browser data'yı periyodik temizle
- Cookie'leri doğru sırayla kaydet
- Session timeout'ları yönet
- Single session completion (bir oturumda tamamla)

---

## 5. Başarılı Projelerin Analizi

### barrriwa/vfsauto (BAS tabanlı)
- **Araç:** Browser Automation Studio
- **Özellikler:**
  - Fingerprint switcher entegrasyonu (bablosoft.com)
  - PerfectCanvas uyumluluğu
  - Sanal klavye otomasyonu
  - İnsan-benzeri mouse hareketi ve yazma simülasyonu
  - Gelişmiş CAPTCHA challenge yönetimi
  - Proxy rotasyonu
  - Telegram bildirimleri
- **Sponsor:** iProyal (VFS Global'i bloklamayan tek proxy)

### ranjan-mohanty/vfs-appointment-bot (Python)
- **Araç:** Selenium/Playwright
- **Bilinen sorunlar:**
  - Sık login denemelerinde VFS bloklar → 2 saat bekleme gerekli
  - CAPTCHA çözücü YOK → Firefox'ta otomatik çözülüyor
  - Frequency azaltma önerisi

### Camoufox (Python anti-detect browser)
- **Araç:** Playwright tabanlı
- **Özellikler:**
  - Firefox tabanlı (Chromium değil — farklı TLS fingerprint)
  - Turnstile CAPTCHA'ları handle edebiliyor
  - Human-like automation

---

## 6. Kritik Bulgular ve Öneriler

### 🔑 Ana Bulgu 1: TLS Fingerprint En Büyük Engel
Chromium tabanlı otomasyon araçlarının TLS fingerprint'i gerçek Chrome'dan farklılık 
gösterebilir. ConnectOverCDP bu sorunu çözer çünkü gerçek tarayıcı motoru kullanılır.

### 🔑 Ana Bulgu 2: Cookie Zinciri Kritik
Direkt /login URL'sine gitmek cookie zincirini atlar ve 403 tetikler.
Ana sayfa → doğal navigasyon → login sayfası akışı zorunludur.

### 🔑 Ana Bulgu 3: IP Reputation Belirleyici
Önceki otomasyon denemeleri IP'yi flaglemiş olabilir.
Modem restart veya mobil hotspot test edilmeli.

### 🔑 Ana Bulgu 4: Firefox Advantajı
Birçok rapor Firefox'un Turnstile'ı otomatik geçtiğini söylüyor.
Firefox tabanlı bir yaklaşım (Camoufox gibi) değerlendirilebilir.

### 🔑 Ana Bulgu 5: iProyal Proxy
vfsauto projesinin sponsoru olan iProyal, "VFS Global'i bloklamayan tek proxy" 
olarak tanıtılıyor. Residential proxy kullanımı kritik.

---

## 7. Uygulama Planı

### Öncelik 1: IP Testi
Normal tarayıcıda (VOIDRA dışı) VFS login'i test et.
- Eğer çalışıyorsa → Sorun otomasyon tespitinde
- Eğer çalışmıyorsa → Sorun IP reputation'da → Modem restart

### Öncelik 2: Doğal Navigasyon Akışı
Ana sayfa → "Book an appointment" tıkla → login sayfasına doğal geçiş
Direkt URL navigasyonundan kaçın.

### Öncelik 3: İnsan-Benzeri Davranış
Mouse hareketi, scroll, random delay ekle.

### Öncelik 4: Cookie Yönetimi
`__cf_bm` ve `cf_clearance` cookie'lerini düzgün yönet.

### Öncelik 5: Proxy/IP
Residential proxy veya mobil hotspot kullan.

---

## Kaynaklar
- Reddit: r/VFSGlobal, r/SchengenVisa
- GitHub: barrriwa/vfsauto, ranjan-mohanty/vfs-appointment-bot, minhalawais/Visa-Appointment-Automation
- Cloudflare Docs: Turnstile, Bot Management, JA3/JA4
- rebrowser.net: Runtime.enable fix documentation
- Various forum posts and technical analyses
