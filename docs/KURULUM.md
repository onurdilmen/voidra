# 🚀 VOIDRA — Kurulum Rehberi

Bu rehber, VOIDRA projesini sıfırdan bir bilgisayara kurmanız için gereken tüm adımları içerir.

---

## 📋 Gereksinimler

Kuruluma başlamadan önce aşağıdakilerin yüklü olduğundan emin olun:

| Yazılım | Minimum Versiyon | İndirme Linki |
|---------|-----------------|---------------|
| **Node.js** | v18+ (v20 LTS önerilir) | [nodejs.org](https://nodejs.org/) |
| **Git** | v2.30+ | [git-scm.com](https://git-scm.com/download/win) |
| **Firefox** | v130+ | [mozilla.org](https://www.mozilla.org/firefox/) |
| **Windows** | Windows 10/11 | — |

### Opsiyonel
| Yazılım | Açıklama |
|---------|----------|
| **GitHub Desktop** | Git işlemleri için GUI | [desktop.github.com](https://desktop.github.com/) |
| **VS Code** | Kod editörü | [code.visualstudio.com](https://code.visualstudio.com/) |

---

## 📥 Adım 1: Gerekli Yazılımları Kur

### Node.js Kurulumu
1. [nodejs.org](https://nodejs.org/) adresine git
2. **LTS** (Long Term Support) versiyonunu indir
3. Kurulum sihirbazını çalıştır (varsayılan ayarlarla ilerle)
4. Kurulumu doğrula:
   ```powershell
   node --version    # v20.x.x gibi bir çıktı görmeli
   npm --version     # 10.x.x gibi bir çıktı görmeli
   ```

### Git Kurulumu
1. [git-scm.com](https://git-scm.com/download/win) adresine git
2. **64-bit Git for Windows Setup** indir ve kur
3. Kurulumu doğrula:
   ```powershell
   git --version     # git version 2.x.x gibi bir çıktı görmeli
   ```

### Firefox Kurulumu
1. [mozilla.org/firefox](https://www.mozilla.org/firefox/) adresine git
2. Firefox'u indir ve kur
3. En az bir kez açıp kapatın (profil oluşturulması için)

---

## 📥 Adım 2: Projeyi İndir (Clone)

PowerShell veya Terminal açın ve şu komutu çalıştırın:

```powershell
# Masaüstüne klon
cd $env:USERPROFILE\Desktop
git clone https://github.com/onurdilmen/voidra.git
cd voidra
```

> **Not:** Repo private olduğu için GitHub hesabınıza giriş yapmanız istenecektir.
> GitHub Desktop kuruluysa otomatik olarak credential'ları kullanır.

---

## 📥 Adım 3: Bağımlılıkları Kur

Proje klasöründe şu komutu çalıştırın:

```powershell
npm install
```

Bu işlem 1-3 dakika sürebilir. Tüm bağımlılıklar `node_modules` klasörüne indirilecektir.

> **Hata alırsanız:**
> ```powershell
> # Cache temizle ve tekrar dene
> npm cache clean --force
> npm install
> ```

---

## ▶️ Adım 4: Uygulamayı Çalıştır

### Geliştirme Modu (Development)
```powershell
npm run dev
```

Bu komut:
- Vite dev server'ı başlatır
- Electron uygulamasını açar
- Hot-reload aktif olur (kod değişikliklerinde otomatik yenilenir)

### Üretim Derlemesi (Production Build)
```powershell
npm run build
```

---

## 🔧 Adım 5: İlk Yapılandırma

Uygulama ilk açıldığında:

1. **Ayarlar** sayfasına gidin (sol menüden ⚙️ simgesi)
2. **VFS Global Ayarları:**
   - Hedef ülke seçin
   - Hizmet merkezi seçin
3. **Telegram Bildirimleri** (opsiyonel):
   - Bot Token girin
   - Chat ID girin
   - "Test Bildirimi Gönder" ile doğrulayın
4. **Kaydet** butonuna tıklayın

---

## 📁 Proje Yapısı

```
voidra/
├── src/
│   ├── main/           # Electron ana process
│   ├── preload/        # IPC köprüsü
│   ├── renderer/       # React UI (sayfalar, bileşenler, stiller)
│   ├── core/           # İş mantığı (Orchestrator, BrowserLauncher, vb.)
│   ├── managers/       # Profil, Oturum yönetimi
│   ├── automation/     # AutoFill motoru
│   ├── models/         # Veri modelleri (Profile, Applicant)
│   └── utils/          # Logger, Constants, yardımcılar
├── scripts/            # Firewall reset script'leri
├── resources/          # İkon dosyaları
├── docs/               # Dokümantasyon
└── package.json        # Proje yapılandırması
```

---

## 🔑 Sık Kullanılan Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme modunda çalıştır |
| `npm run build` | Üretim derlemesi |
| `npm run typecheck` | TypeScript tip kontrolü |
| `git pull` | Son değişiklikleri çek |
| `git status` | Değişiklikleri görüntüle |

---

## ❓ Sık Karşılaşılan Sorunlar

### "node" komutu bulunamadı
Node.js kurulumundan sonra terminali kapatıp yeniden açın.

### npm install hata veriyor
```powershell
# Node modüllerini temizle ve tekrar kur
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Firefox bulunamadı hatası
Firefox'un standart konuma kurulu olduğundan emin olun:
`C:\Program Files\Mozilla Firefox\firefox.exe`

### Electron penceresi açılmıyor
```powershell
# Ortam değişkenini kontrol et
$env:NODE_ENV = "development"
npm run dev
```

### Git push/pull credential hatası
```powershell
# GitHub credential'ları yenile
git credential reject
git pull   # Tekrar giriş istenecek
```

---

## 📞 İletişim

Sorun yaşarsanız GitHub Issues üzerinden bildirim oluşturabilirsiniz:
https://github.com/onurdilmen/voidra/issues
