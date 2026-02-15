# VFS Global Güvenlik Analizi — Ek Bulgular (Sayfa 2)
> Tarih: 2026-02-13 | Ek Araştırma

## 8. Cloudflare Turnstile Detaylı Akış

### Token Oluşturma Süreci
1. Sayfa yüklenince Turnstile JS scripti çalışır
2. Arka planda görünmez challenge'lar başlatılır:
   - Proof-of-Work hesaplamaları
   - Proof-of-Space testleri  
   - Browser API tutarlılık kontrolü
   - Davranışsal sinyal toplama (mouse, keyboard, scroll)
3. Challenge başarılı → `cf-turnstile-response` token üretilir
4. Token, formda gizli input olarak yerleştirilir
5. Login submit → Token backend'e gönderilir
6. Backend, `https://challenges.cloudflare.com/turnstile/v0/siteverify` API'sine doğrular

### Token Özellikleri
- **Geçerlilik süresi:** 5 dakika (300 saniye)
- **Tek kullanımlık:** Her token yalnızca 1 kez doğrulanabilir
- **Sahtecilik koruması:** Server-side doğrulama ZORUNLU
- **Bot tespiti:** Challenge geçilse bile backend'de bot sinyalleri kontrol edilir

### ⚠️ Kritik Bilgi
Token'ı client-side üretmek YETERLİ DEĞİL — server tarafında `siteverify` API 
ile doğrulanmalı. Yani Turnstile'ı "geçmek" bile yetmez, token'ın 
Cloudflare backend'inde "geçerli" olarak işaretlenmesi gerekir.

---

## 9. TLS Fingerprinting (JA3/JA4) Detaylı Analiz

### JA3 Fingerprint
- TLS handshake'ten hash oluşturur
- İçerik: cipher suites, TLS uzantıları, sıralama
- **Sorun:** Modern tarayıcılar TLS extension sırasını rastgeleleştiriyor → JA3 daha az stabil

### JA4 Fingerprint (YENİ - Cloudflare kullanıyor!)
- JA3'ün evrimi — daha stabil ve güçlü
- **Ek bilgiler:**
  - ALPN (Application Layer Protocol Negotiation)
  - TCP MSS (Maximum Segment Size)
  - TCP Window Size
  - TCP Options
- **Neden önemli:** Spoof etmesi çok zor, TCP/IP seviyesinde bilgi gerektiyor
- **Sonuç:** Node.js HTTP client vs gerçek Chrome → FARKLI JA4 hash

### Çözüm
ConnectOverCDP kullanınca TLS handshake gerçek tarayıcı motoru üzerinden yapılır
→ JA3/JA4 fingerprint gerçek tarayıcıyla AYNI olur ✅

---

## 10. CDP Runtime.enable + ConnectOverCDP

### Sorun
- `connectOverCDP` kullanılsa bile, Playwright hala `Runtime.enable` CDP komutunu gönderiyor
- Bu komut `Runtime.consoleAPICalled` event'ini tetikliyor
- Cloudflare, sayfadaki birkaç satır JS ile bunu tespit edebiliyor

### rebrowser-patches Çözümü
1. **addBinding modu:** Main world'da yeni binding oluştur, context ID yakala
   - ✅ Full main context erişimi
   - ✅ Web workers ve iframe desteği
2. **isolatedContext modu:** `Page.createIsolatedWorld` ile izole context oluştur
   - ✅ Sayfa scriptlerinden ayrı çalışır
   - ❌ Main context değişkenlerine direkt erişim yok
3. **alwaysIsolated modu:** Tüm kodlar izole contextte çalışır

### ⚠️ Kritik Bulgu
rebrowser-patches geliştiricilerine göre, bu fix'ler şu anda Cloudflare ve 
DataDome tarafından TESPİT EDİLEMİYOR. Ancak `connectOverCDP` ile birlikte 
kullanılması gerekiyor — sadece biri tek başına yeterli DEĞİL.

---

## 11. Fingerprint Tutarlılık Kontrolleri (CreepJS)

### Cloudflare'ın Aradığı Tutarsızlıklar
Cloudflare, CreepJS benzeri tekniklerle şu uyumsuzlukları arar:

| Kontrol | İyi 🟢 | Kötü 🔴 |
|---|---|---|
| IP Lokasyonu vs Timezone | IP Türkiye + Europe/Istanbul | IP Türkiye + UTC |
| IP Lokasyonu vs Language | IP Türkiye + tr-TR | IP Türkiye + zh-CN |
| User-Agent vs Platform | Edge/Windows + Win32 | Edge/Windows + Linux |
| Screen vs Viewport | 1920x1080 + 1920x938 | 1920x1080 + 800x600 |
| WebGL Renderer vs GPU | NVIDIA GeForce + NVIDIA | Software Renderer + NVIDIA |
| Device Memory vs Cores | 8GB + 4 cores | 0.5GB + 128 cores |
| Canvas hash tutarlılığı | Aynı hash (oturum boyunca) | Farklı hashler |
| Font enumerasyonu | Doğal font listesi | Eksik/fazla fontlar |

### VOIDRA'da Düzeltilmesi Gerekenler
1. ✅ IP-Timezone tutarlılığı (tr-TR + Europe/Istanbul) — ZATen ayarlı
2. ✅ IP-Language tutarlılığı — ZATen ayarlı
3. ⚠️ Screen-Viewport tutarlılığı — Kontrol edilmeli
4. ⚠️ WebGL bilgileri — Gerçek GPU bilgileri kullanılmalı
5. ⚠️ Canvas fingerprint — Her seferinde aynı olmalı

---

## 12. VFS Login Sayfası Özel Engelleri

### Sanal Klavye (On-Screen Keyboard)
- Bazı VFS ülke sayfaları şifre girişinde sanal klavye kullanıyor
- Sanal klavye, `send_keys()` gibi standart yöntemleri engelliyor
- **Çözümler:**
  1. `keyboard.type()` ile doğrudan input'a yazma
  2. Koordinat bazlı tıklama (PyAutoGUI benzeri)
  3. JavaScript ile input value'yu direkt set etme
  4. VFS Türkiye sayfasında sanal klavye VAR MI kontrol edilmeli

### Login Akışı
```
1. Ana sayfa yükle → __cf_bm cookie al
2. Cloudflare Turnstile görünmez challenge → cf_clearance cookie
3. "Login" veya "Book an appointment" tıkla → Login sayfasına yönlendir
4. Email gir → Normal input
5. Şifre gir → Sanal klavye veya normal input
6. Turnstile token üretilir → cf-turnstile-response
7. Submit → Token + credentials → Backend doğrulama
```

---

## 13. Camoufox Alternatifi

### Firefox Avantajı
- Chromium tabanlı botlar çok yaygın → Cloudflare bu konuda deneyimli
- Firefox tabanlı botlar NADİR → Daha az tespit şansı
- Firefox'un TLS fingerprint'i Chromium'dan farklı
- Birçok kullanıcı raporu: "Firefox'ta CAPTCHA otomatik çözüldü"

### Camoufox Özellikleri
- Firefox tabanlı custom build
- Playwright API uyumlu
- navigator.webdriver gizleme
- Canvas/WebGL/Audio fingerprint spoofing
- Persistent session desteği (cf_clearance cookie'si saklanır)
- Python kütüphanesi (pip install camoufox)

### VOIDRA İçin Değerlendirme
VOIDRA şu an Chromium/Edge tabanlı. İleride Firefox desteği eklenebilir:
- Camoufox yalnızca Python destekliyor → Node.js/TypeScript projesine doğrudan entegre edilemez
- Ancak Firefox'un Playwright desteği var → `channel: 'firefox'` ile denenebilir

---

## 14. Proxy ve IP Stratejisi

### Önerilen Proxy Tipleri
| Tip | VFS Uyumu | Maliyet | Risk |
|---|---|---|---|
| Residential Proxy | ✅ Çok iyi | $$$$ | Düşük |
| ISP Proxy | ✅ İyi | $$$ | Orta |
| Mobile Proxy (4G/5G) | ✅ Çok iyi | $$$ | Düşük |
| Datacenter Proxy | ❌ Kötü | $ | Yüksek |
| Free VPN | ❌ Çok kötü | Ücretsiz | Çok yüksek |

### iProyal Önerisi
- vfsauto projesinin sponsoru
- "VFS Global'i bloklamayan tek proxy" iddiası
- Residential proxy hizmeti
- https://iproyal.com

### En Ucuz Çözüm: Mobil Hotspot
- Telefonu hotspot olarak kullan
- 4G/5G IP'ler genellikle "residential" kabul edilir
- Cloudflare tarafından nadiren bloklanır
- ÜCRETSİZ!

---

## 15. Sonraki Adımlar (Öncelik Sırasına Göre)

### 1. IP Testi (ÖNCELİK 1 - HEMEN)
Normal tarayıcıda VFS login'i test et:
- Normal Edge açıp https://visa.vfsglobal.com/tur/en/nld/login adresine git
- Çalışıyorsa → Otomasyon tespiti sorunu
- Çalışmıyorsa → IP flaglenmiş → Modem restart veya hotspot

### 2. Doğal Navigasyon Akışı (ÖNCELİK 2)
/login URL'sine direkt gitme:
1. Ana sayfayı aç
2. 5-10 saniye bekle (Turnstile challenge tamamlansın)
3. "Book an appointment" butonuna tıkla
4. Login sayfasına doğal yönlendir

### 3. İnsan-Benzeri Davranış (ÖNCELİK 3)
- Random mouse hareketleri ekle
- Sayfada scroll yap
- 3-7 saniye arası random bekleme
- Gerçekçi typing hızı (her karakter için 50-150ms)

### 4. rebrowser-patches Doğrulama (ÖNCELİK 4)
- `REBROWSER_PATCHES_DEBUG=1` ile çalıştır
- Console'da rebrowser debug mesajlarını kontrol et
- Runtime.enable leak'inin gerçekten düzeltildiğinden emin ol
