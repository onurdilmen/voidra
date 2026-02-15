# Firefox Tabanlı Yeniden Yazım Planı

## Değişiklik Listesi

### 1. Profile.ts — browserChannel tipi güncelle
- `'msedge' | 'chrome'` → `'firefox' | 'msedge' | 'chrome'`

### 2. Constants.ts — DEFAULT_BROWSER_CHANNEL güncelle
- `'msedge'` → `'firefox'`

### 3. FingerprintGenerator.ts — Firefox UA + WebGL güncelle
- Chromium UA'ları → Firefox UA'ları
- WebGL vendor: `Google Inc.` → `Mozilla` (Firefox'ta farklı)
- `window.chrome` objesi → Firefox'ta YOK (kaldır)

### 4. StealthEngine.ts — Firefox'a özel stealth
- `window.chrome` mock'u → KALDIR (Firefox'ta chrome objesi yok)
- CDP ilgili temizlik → KALDIR (Firefox CDP kullanmaz)
- Plugins/MimeTypes → Firefox formatına çevir
- `navigator.webdriver` → Hala gerekli
- WebGL override → Firefox formatına uyarla

### 5. SessionManager.ts — TAM YENIDEN YAZIM
- `connectOverCDP` → KALDIR
- `chromium.connectOverCDP` → `firefox.launchPersistentContext`
- CDP session/override → KALDIR (Firefox Juggler kullanır)
- Manuel browser spawn → KALDIR
- Doğal navigasyon akışı ekle
- İnsan-benzeri davranış motoru ekle
- Cookie zinciri yönetimi ekle

### 6. main/index.ts — rebrowser-patches kaldır
- `REBROWSER_PATCHES_*` env vars → KALDIR
