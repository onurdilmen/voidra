// ==UserScript==
// @name         VFS Türkiye Netherlands Smart & FAST Auto Book PRO
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  Türkiye -> Hollanda HIZLI aile/grup randevu botu. Tüm mantık, merkezler, kategoriler ve payload'lar TR/NLD için ayarlı. Tam aile UI desteği.
// @match        https://visa.vfsglobal.com/*
// @grant        none
// ==/UserScript==

// ═══════════════════════════════════════════════════════════════
// ★ VOIDRA LOG KÖPRÜsÜ — Tarayıcıdaki tüm olayları VOIDRA'ya aktar
// Stealth modda çalışır, VFS tarafından tespit edilemez (localhost)
// ═══════════════════════════════════════════════════════════════

const VOIDRA_LOG_URL = 'http://localhost:18923/log';
const VOIDRA_LOGS_URL = 'http://localhost:18923/logs';
const VOIDRA_CONFIG_URL = 'http://localhost:18923/api/config';
let _voidraConnected = false;
let _voidraLogBuffer = [];
let _voidraFlushTimer = null;

// VOIDRA bağlantısını kontrol et
(async function checkVoidraConnection() {
    try {
        const resp = await fetch(VOIDRA_CONFIG_URL, { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
            const cfg = await resp.json();
            _voidraConnected = cfg.connected === true;
            if (_voidraConnected) {
                console.log('[VOIDRA] ✅ Log köprüsü bağlandı — tüm olaylar VOIDRA\'ya aktarılacak');
                voidraLog('info', '🔗 VFS Bot Pro → VOIDRA bağlantısı kuruldu');
                voidraLog('info', `📍 Sayfa: ${window.location.pathname}`);

                // ★ HAVUZ VE AYAR SENKRONİZASYONU (Sayfa yüklendikten sonra)
                window.addEventListener('load', () => {
                    syncVoidraPool();
                    syncVoidraSettings();
                });
            }
        }
    } catch {
        _voidraConnected = false;
        console.log('[VOIDRA] Log köprüsü bulunamadı — bağımsız modda çalışılıyor');
    }
})();

// ★ VOIDRA Ayar Senkronizasyonu (Telegram vb.)
async function syncVoidraSettings() {
    try {
        const resp = await fetch(VOIDRA_CONFIG_URL);
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.settings && data.settings.notification) {
            const notif = data.settings.notification;

            // Telegram ayarlarını güncelle (eğer VOIDRA'da varsa)
            if (notif.telegramBotToken) {
                localStorage.setItem('vfs_telegram_token', notif.telegramBotToken);
            }
            if (notif.telegramChatId) {
                localStorage.setItem('vfs_telegram_chatid', notif.telegramChatId);
            }

            // Eğer VOIDRA'da kapalıysa script'te de kapatabiliriz, 
            // ama kullanıcının script üzerinden açmasına engel olmayalım.
            // Sadece varsa '1' yapalım.
            if (notif.telegramEnabled) {
                localStorage.setItem('vfs_telegram_enabled', '1');
            }

            voidraLog('info', '⚙️ Ayarlar senkronize edildi (Telegram)');
        }
    } catch (err) {
        voidraLog('warn', `Ayar senkronizasyon hatası: ${err.message}`);
    }
}

// ★ VOIDRA Havuz Senkronizasyonu
async function syncVoidraPool() {
    try {
        const resp = await fetch('http://localhost:18923/api/pool');
        if (!resp.ok) return;
        const applicants = await resp.json();

        if (!Array.isArray(applicants) || applicants.length === 0) return;

        voidraLog('info', `📥 VOIDRA Havuz Senkronizasyonu: ${applicants.length} kişi alındı`);

        // Script'in ülke ayarını al
        const country = localStorage.getItem('vfs_turkiye_selected_country') || 'turkey';
        const listKey = `vfs_turkiye_${country}_multiClientList`;

        // Mevcut listeyi yükle
        let clientList = [];
        try { clientList = JSON.parse(localStorage.getItem(listKey) || '[]'); } catch { }

        let addedCount = 0;
        let updatedCount = 0;

        for (const app of applicants) {
            // ID eşleşmesi var mı?
            const existingIdx = clientList.findIndex(c => c.id === app.id);
            const clientName = `${app.firstName} ${app.lastName}`.trim();

            if (existingIdx === -1) {
                // Yeni ekle
                clientList.push({ id: app.id, name: clientName });
                addedCount++;
            } else {
                // İsmi güncelle
                clientList[existingIdx].name = clientName;
                updatedCount++;
            }

            // Detayları kaydet (localStorage key: vfs_turkiye_{country}_clients_{id})
            const clientKey = `vfs_turkiye_${country}_clients_${app.id}`;
            const genderVal = app.gender === 'female' ? 2 : 1; // 1=Erkek, 2=Kadın

            const clientData = {
                firstName: app.firstName,
                lastName: app.lastName,
                passportNumber: app.passportNumber,
                passportExpirtyDate: app.passportExpiryDate, // Script typo: 'Expirty'
                dateOfBirth: app.dateOfBirth,
                gender: genderVal,
                nationality: app.nationality,
                contactNumber: app.phone,
                emailId: app.email,
                // Diğer alanlar opsiyonel veya script tarafından kullanılmıyor
                visaType: app.visaType,
                center: app.destinationCountry // Belki destinationCountry merkez bilgisidir?
            };

            localStorage.setItem(clientKey, JSON.stringify(clientData));
        }

        // Listeyi kaydet
        localStorage.setItem(listKey, JSON.stringify(clientList));

        // Eğer hiç seçili müşteri yoksa ilkini seç
        const selectedKey = `vfs_turkiye_${country}_selectedClient`;
        if (!localStorage.getItem(selectedKey) && clientList.length > 0) {
            localStorage.setItem(selectedKey, clientList[0].id);
        }

        if (addedCount > 0 || updatedCount > 0) {
            voidraLog('info', `✅ Havuz senkronize edildi: +${addedCount} yeni, ${updatedCount} güncel`);
            // Script UI'ını güncellemek için sayfayı yenilemek gerekebilir ama
            // window.load'da çalıştığımız için script henüz UI oluşturmamış olabilir.
            // Eğer script UI'ı oluşturduysa, refresh gerekebilir.
            // Şimdilik sadece localStorage güncelliyoruz.
        }

    } catch (err) {
        voidraLog('error', `Havuz senkronizasyon hatası: ${err.message}`);
    }
}

// ★ Ana log fonksiyonu — VOIDRA'ya log gönder
function voidraLog(level, message, data) {
    if (!_voidraConnected) return;

    const entry = { level, message, timestamp: new Date().toISOString() };
    if (data !== undefined) {
        try {
            entry.data = typeof data === 'string' ? data : JSON.stringify(data).substring(0, 500);
        } catch { /* */ }
    }

    // Buffer'a ekle ve toplu gönder (performans için)
    _voidraLogBuffer.push(entry);

    if (!_voidraFlushTimer) {
        _voidraFlushTimer = setTimeout(flushVoidraLogs, 300);
    }
}

// Buffer'daki logları toplu gönder
function flushVoidraLogs() {
    _voidraFlushTimer = null;
    if (_voidraLogBuffer.length === 0) return;

    const batch = _voidraLogBuffer.splice(0, 50);

    if (batch.length === 1) {
        // Tek log — /log endpoint
        fetch(VOIDRA_LOG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch[0]),
        }).catch(() => { _voidraConnected = false; });
    } else {
        // Çoklu log — /logs endpoint (batch)
        fetch(VOIDRA_LOGS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
        }).catch(() => { _voidraConnected = false; });
    }

    // Hâlâ buffer'da log varsa devam et
    if (_voidraLogBuffer.length > 0) {
        _voidraFlushTimer = setTimeout(flushVoidraLogs, 300);
    }
}

// ★ Console.log/warn/error'u yakala ve VOIDRA'ya aktar
const _origConsoleLog = console.log.bind(console);
const _origConsoleWarn = console.warn.bind(console);
const _origConsoleError = console.error.bind(console);

console.log = function (...args) {
    _origConsoleLog(...args);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (!msg.startsWith('[VOIDRA]')) {  // Kendi loglarımızı tekrar gönderme
        voidraLog('info', msg);
    }
};
console.warn = function (...args) {
    _origConsoleWarn(...args);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    voidraLog('warn', '⚠️ ' + msg);
};
console.error = function (...args) {
    _origConsoleError(...args);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    voidraLog('error', '❌ ' + msg);
};

// ★ XHR İnterceptor — VFS API trafiğini logla
const _origXHROpen = XMLHttpRequest.prototype.open;
const _origXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._voidra = { method, url: String(url), startTime: 0 };
    return _origXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function (body) {
    if (this._voidra && this._voidra.url.includes('vfsglobal.com')) {
        this._voidra.startTime = Date.now();
        const info = this._voidra;

        // Kısa URL göster
        const shortUrl = info.url.replace(/https?:\/\/[^\/]+/, '');

        voidraLog('info', `📤 ${info.method} ${shortUrl}`);

        this.addEventListener('load', function () {
            const duration = Date.now() - info.startTime;
            const status = this.status;

            if (status >= 200 && status < 300) {
                voidraLog('info', `📥 ${status} ${shortUrl} (${duration}ms)`);
                // Response body'nin bir kısmını logla (debugging için)
                try {
                    const respText = this.responseText;
                    if (respText && respText.length < 2000) {
                        const respJson = JSON.parse(respText);
                        // Önemli bilgileri çıkar
                        if (respJson.error) {
                            voidraLog('warn', `   ⚠️ API Hata: ${JSON.stringify(respJson.error).substring(0, 200)}`);
                        }
                        if (respJson.available !== undefined) {
                            voidraLog('info', `   📋 Randevu: ${respJson.available ? '✅ VAR!' : '❌ Yok'}`);
                        }
                    }
                } catch { /* JSON olmayan response */ }
            } else if (status === 403) {
                voidraLog('error', `🚫 403 BLOCKED — ${shortUrl} (${duration}ms)`);
                voidraLog('warn', '   → Cloudflare/VFS tarafından engellenmiş olabilir');
            } else if (status === 401) {
                voidraLog('warn', `🔒 401 Unauthorized — ${shortUrl} (${duration}ms)`);
            } else {
                voidraLog('warn', `📥 ${status} ${shortUrl} (${duration}ms)`);
            }
        });

        this.addEventListener('error', function () {
            voidraLog('error', `❌ Network Error — ${info.method} ${shortUrl}`);
        });

        this.addEventListener('timeout', function () {
            voidraLog('error', `⏱️ Timeout — ${info.method} ${shortUrl}`);
        });
    }
    return _origXHRSend.apply(this, arguments);
};

// ★ Fetch İnterceptor — Modern API çağrılarını logla
const _origFetch = window.fetch;
window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));

    // VOIDRA kendi log isteklerini loglama
    if (url.includes('localhost:18923')) {
        return _origFetch.apply(this, arguments);
    }

    // Sadece VFS trafiğini logla
    if (url.includes('vfsglobal.com')) {
        const method = (init && init.method) || 'GET';
        const shortUrl = url.replace(/https?:\/\/[^\/]+/, '');
        const startTime = Date.now();

        voidraLog('info', `📤 fetch ${method} ${shortUrl}`);

        try {
            const response = await _origFetch.apply(this, arguments);
            const duration = Date.now() - startTime;
            const status = response.status;

            if (status >= 200 && status < 300) {
                voidraLog('info', `📥 fetch ${status} ${shortUrl} (${duration}ms)`);
            } else if (status === 403) {
                voidraLog('error', `🚫 fetch 403 BLOCKED — ${shortUrl} (${duration}ms)`);
            } else if (status === 401) {
                voidraLog('warn', `🔒 fetch 401 — ${shortUrl} (${duration}ms)`);
            } else {
                voidraLog('warn', `📥 fetch ${status} ${shortUrl} (${duration}ms)`);
            }

            return response;
        } catch (err) {
            const duration = Date.now() - startTime;
            voidraLog('error', `❌ fetch Error — ${method} ${shortUrl} (${duration}ms): ${err.message}`);
            throw err;
        }
    }

    // VFS olmayan istekler — doğrudan ilet
    return _origFetch.apply(this, arguments);
};

// ★ Sayfa olaylarını logla
window.addEventListener('error', (e) => {
    voidraLog('error', `💥 JS Error: ${e.message} (${e.filename}:${e.lineno})`);
});

window.addEventListener('unhandledrejection', (e) => {
    voidraLog('error', `💥 Unhandled Promise: ${e.reason}`);
});

// Sayfa navigasyonu
window.addEventListener('beforeunload', () => {
    voidraLog('info', `🔄 Sayfa değişiyor: ${window.location.pathname}`);
    flushVoidraLogs(); // Son logları gönder
});

// ═══════════════════════════════════════════════════════════════
// ★ VOIDRA LOG KÖPRÜsÜ SONU
// ═══════════════════════════════════════════════════════════════


// --- Ülke Yapılandırması: Türkiye -> Hollanda ---
const COUNTRY_KEY = "vfs_turkiye_selected_country";
const LANG_KEY = "vfs_turkiye_bot_lang";
const translations = {
    en: {
        countryLabel: "Country:",
        heading: "VFS Türkiye",
        headingSub: "Auto-Book Solo/Family/Group",
        selectClient: "Select Client:",
        addClient: "+ Add Client",
        removeClient: "🗑️ Remove",
        renameClient: "✏️ Rename",
        visaCategory: "Visa Category:",
        center: "Center:",
        familyMembers: "Family Members (Add to Applicant List):",
        addFamily: "+ Add Family Member",
        monthsToCheck: "Months to Check (calendar scan):",
        childApplicant: "Child Applicant",
        parentPassNo: "Parent Passport Number:",
        parentPassExp: "Parent Passport Expiry:",
        editBtn: "✏️ Edit Applicant/Family",
        autoBookBtn: "🚀 Auto Book Slot",
        manualOn: "🔘 Manual Timeslot Picker: ON",
        manualOff: "⚡ Manual Timeslot Picker: OFF",
        turboOn: "🚀 Turbo: ON (last date only)",
        turboOff: "⏩ Turbo: OFF",
        checkOn: "✅ Check Slot: ON",
        checkOff: "🕑 Check Slot: OFF",
        manualPickerTitle: "Select Timeslot Manually",
        close: "× Close",
        langToggle: "🌐 Türkçe",
        schedulerTitle: "Tourism Scheduler",
        schedulerLabel: "Schedule at:",
        schedulerSet: "Set",
        schedulerWarn: "Set time first",
        scheduledMsg: "Scheduled",
        retryLabel: "Retry applicant 3x (0.5s)",
        turboLabel: "Turbo waitlist (3 fast attempts)",
        familyMember: "Family Member",
        remove: "Remove",
        clientNamePrompt: "Enter client name:",
        renameClientPrompt: "Rename client:",
        atLeastOneClient: "At least one client required.",
        waitlistOpen: "THE WAITLIST IS OPEN",
        tabApplicant: "Applicant",
        tabSettings: "Settings",
        tabFamily: "Family",
        tabControl: "Control",
        actionAutoBook: "Auto Book",
        actionCheckSlot: "Check Slot",
        actionManualPick: "Manual Pick",
        actionTurboMode: "Turbo Mode",
        sidebarCollapse: "Collapse",
        sidebarExpand: "Expand",
        waitlistCard: "Waitlist Scheduler",
        noSlotAvailable: "No available appointment.",
        tgEnabled: "Telegram Notifications",
        tgTestBtn: "Send Test Message",
        tgTestSuccess: "Test message sent!",
        tgTestFail: "Test failed!",
        tgFillFields: "Fill token and chat ID first",
        tgStep1Hint: "Enter your Telegram Bot Token from @BotFather",
        tgOpenBotFather: "Open @BotFather to create a bot",
        tgNextStep: "Verify & Continue",
        tgTokenRequired: "Please enter a bot token",
        tgTokenValid: "Token verified!",
        tgTokenInvalid: "Invalid token",
        tgStep2Hint: "Send /start to your bot to connect",
        tgOpenBot: "Open bot",
        tgWaiting: "Waiting for /start message...",
        tgBack: "Back",
        tgTimeout: "Timed out. Try again.",
        tgConnected: "Connected",
        tgConnectSuccess: "Telegram connected!",
        tgDisconnect: "Disconnect",
        tgDisconnected: "Telegram disconnected"
    },
    tr: {
        countryLabel: "Ülke:",
        heading: "VFS Türkiye",
        headingSub: "Oto Randevu (Bireysel/Aile/Grup)",
        selectClient: "Müşteri Seç:",
        addClient: "+ Yeni Müşteri",
        removeClient: "🗑️ Sil",
        renameClient: "✏️ Yeniden Adlandır",
        visaCategory: "Vize Kategorisi:",
        center: "Merkez:",
        familyMembers: "Aile Üyeleri (Başvuruya ekle):",
        addFamily: "+ Aile Üyesi Ekle",
        monthsToCheck: "Kontrol Edilecek Aylar (takvim tarama):",
        childApplicant: "Çocuk Başvuru",
        parentPassNo: "Ebeveyn Pasaport No:",
        parentPassExp: "Ebeveyn Pasaport Sonu:",
        editBtn: "✏️ Başvuru / Aile Düzenle",
        autoBookBtn: "🚀 Otomatik Randevu Al",
        manualOn: "🔘 Manuel Saat Seçimi: AÇIK",
        manualOff: "⚡ Manuel Saat Seçimi: KAPALI",
        turboOn: "🚀 Turbo: AÇIK (son tarih)",
        turboOff: "⏩ Turbo: KAPALI",
        checkOn: "✅ Slot Kontrol: AÇIK",
        checkOff: "🕑 Slot Kontrol: KAPALI",
        manualPickerTitle: "Manuel Saat Seç",
        close: "× Kapat",
        langToggle: "🌐 English",
        schedulerTitle: "Turizm Zamanlayıcı",
        schedulerLabel: "Şu saatte çalıştır:",
        schedulerSet: "Kaydet",
        schedulerWarn: "Önce saat seç",
        scheduledMsg: "Planlandı",
        retryLabel: "Başvuranı 3x dene (0.5sn)",
        turboLabel: "Turbo bekleme (3 hızlı deneme)",
        familyMember: "Aile Üyesi",
        remove: "Sil",
        clientNamePrompt: "Müşteri adı gir:",
        renameClientPrompt: "Müşteri adı değiştir:",
        atLeastOneClient: "En az bir müşteri olmalı.",
        waitlistOpen: "BEKLEME LİSTESİ AÇIK",
        austria: "AVUSTURYA",
        familyVisit: "AILE ZIYARETI / FAMILY VISIT",
        tabApplicant: "Başvuran",
        tabSettings: "Ayarlar",
        tabFamily: "Aile",
        tabControl: "Kontrol",
        actionAutoBook: "Oto Randevu",
        actionCheckSlot: "Slot Kontrol",
        actionManualPick: "Manuel Seçim",
        actionTurboMode: "Turbo Mod",
        sidebarCollapse: "Daralt",
        sidebarExpand: "Genişlet",
        waitlistCard: "Bekleme Listesi Zamanlayıcı",
        noSlotAvailable: "Müsait randevu yok.",
        tgEnabled: "Telegram Bildirimleri",
        tgTestBtn: "Test Mesajı Gönder",
        tgTestSuccess: "Test mesajı gönderildi!",
        tgTestFail: "Test başarısız!",
        tgFillFields: "Önce token ve chat ID girin",
        tgStep1Hint: "@BotFather'dan aldığınız Bot Token'ı girin",
        tgOpenBotFather: "@BotFather'ı aç ve bot oluştur",
        tgNextStep: "Doğrula ve Devam Et",
        tgTokenRequired: "Lütfen bot token girin",
        tgTokenValid: "Token doğrulandı!",
        tgTokenInvalid: "Geçersiz token",
        tgStep2Hint: "Bağlanmak için bota /start gönderin",
        tgOpenBot: "Botu aç",
        tgWaiting: "/start mesajı bekleniyor...",
        tgBack: "Geri",
        tgTimeout: "Süre doldu. Tekrar deneyin.",
        tgConnected: "Bağlandı",
        tgConnectSuccess: "Telegram bağlandı!",
        tgDisconnect: "Bağlantıyı Kes",
        tgDisconnected: "Telegram bağlantısı kesildi"
    }
};
function getLang() {
    const lang = localStorage.getItem(LANG_KEY) || "tr";
    return translations[lang] ? lang : "tr";
}
function setLang(l) { if (translations[l]) localStorage.setItem(LANG_KEY, l); }
function t(key) {
    const lang = getLang();
    return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
}
const countryConfig = {
    turkey: {
        label: "HOLLANDA",
        countryCode: "tur",
        missionCode: "nld",
        centers: [
            { name: "Netherlands Visa Application Centre - Ankara", code: "NANKA" },
            { name: "Netherlands Visa Application Centre - Bursa", code: "NBUR" },
            { name: "Netherlands Visa Application Centre - Edirne", code: "NEDIE" },
            { name: "Netherlands Visa Application Centre - Istanbul Altunizade", code: "NALT" },
            { name: "Netherlands Visa Application Centre - Istanbul Beyoglu", code: "NISTA" },
            { name: "Netherlands Visa Application Centre - Izmir", code: "ADB" }
        ],
        visaCategories: [
            { code: "NSBUSINESS", label: "TICARI / BUSINESS " },
            { code: "NSTOURISM", label: "TURIZM / TOURISM " },
            { code: "NSFAMILYVISIT", label: "AILE ARKADAS ZIYARETI VIZE BASVURU / FAMILY FRIEND VISIT", centers: ["NALT"] },
            { code: "TR", label: "KAMYON SOFORU / TRUCK DRIVERS" }
        ]
    },
    bulgaria: {
        label: "BULGARIA",
        countryCode: "tur",
        missionCode: "bgr",
        centers: [
            { name: "Bulgaria Visa Application Center, Istanbul-Beyoglu", code: "IST" },
            { name: "Bulgaria Visa Application Center, Ankara", code: "ESB" },
            { name: "Bulgaria Visa Application Center in Istanbul-Altunizade", code: "ALT" },
            { name: "Bulgaria Visa Application Center, Izmir", code: "ABD" },
            { name: "Bulgaria Visa Application Center, Edirne", code: "EDR" },
            { name: "Bulgaria Visa Application Center, Bursa", code: "BUR" },
            { name: "Bulgaria Visa Application Center- Trabzon", code: "TRA" }
        ],
        visaCategories: [
            { code: "30ev", label: "Biyometrik Başvuru", waitlist: true }
        ]
    },
    france: {
        label: "FRANCE",
        countryCode: "tur",
        missionCode: "fra",
        centers: [
            { name: "France Visa Application Center - Gaziantep", code: "GAZ" },
            { name: "France Visa Application Centre - Ankara", code: "ESB" },
            { name: "France Visa Application Centre - Istanbul Beyoglu", code: "IBY" },
            { name: "France visa application center -Izmir", code: "ADB" }
        ],
        visaCategories: [
            { code: "SHORSTD", label: "Kısa Dönem Standart", centers: ["IBY", "ADB"] },
            { code: "TTTRH", label: "Turizm: Çoklu Vize", centers: ["GAZ", "ESB"] }
        ]
    },
    austria: {
        label: "AVUSTURYA",
        countryCode: "tur",
        missionCode: "aut",
        centers: [
            { name: "Austria Visa Application Centre - Istanbul Altunizade", code: "AUS%20ALTU" }
        ],
        visaCategories: [
            { code: "3", label: "AILE ZIYARETI / FAMILY VISIT" }
        ]
    }
};

// Tüm merkezler artık bekleme listesi kategorilerini destekliyor
const isWaitlistCenter = () => true;
const WAITLIST_CATEGORIES = ["NSTOURISM", "NSFAMILYVISIT", "TR"];
const isWaitlistCategory = (code, centerCode) => {
    // Business sadece İstanbul Altunizade için bekleme listesi
    if (code === "NSBUSINESS" && centerCode === "NALT") return true;
    return WAITLIST_CATEGORIES.includes(code);
};

// Telegram bildirim sistemi (ayarlanabilir, cok olay destekli)
const TG_TOKEN_KEY = "vfs_telegram_token";
const TG_CHAT_KEY = "vfs_telegram_chatid";
const TG_ENABLED_KEY = "vfs_telegram_enabled";

function getTelegramToken() { return localStorage.getItem(TG_TOKEN_KEY) || ""; }
function setTelegramToken(v) { localStorage.setItem(TG_TOKEN_KEY, v); }
function getTelegramChatId() { return localStorage.getItem(TG_CHAT_KEY) || ""; }
function setTelegramChatId(v) { localStorage.setItem(TG_CHAT_KEY, v); }
function isTelegramEnabled() { return localStorage.getItem(TG_ENABLED_KEY) !== "0"; }
function setTelegramEnabled(v) { localStorage.setItem(TG_ENABLED_KEY, v ? "1" : "0"); }

// Olay tipleri
const TG_EVENTS = {
    booking_confirmed: { emoji: "\u2705", label: "Randevu Onayland\u0131" },
    slot_found: { emoji: "\uD83D\uDD0D", label: "Slot Bulundu" },
    bot_started: { emoji: "\uD83D\uDE80", label: "Bot Ba\u015flat\u0131ld\u0131" },
    waitlist_confirmed: { emoji: "\uD83C\uDF89", label: "Bekleme Listesi Onayland\u0131" },
    payment_redirect: { emoji: "\uD83D\uDCB3", label: "\u00D6demeye Y\u00F6nlendiriliyor" },
    error: { emoji: "\u26A0\uFE0F", label: "Hata Olu\u015ftu" },
    scheduled: { emoji: "\u23F0", label: "Zamanland\u0131" }
};

async function sendTelegram(event, data) {
    if (!isTelegramEnabled()) return;
    const token = getTelegramToken();
    const chatId = getTelegramChatId();
    if (!token || !chatId) return;

    const ev = TG_EVENTS[event] || { emoji: "\u2139\uFE0F", label: event };
    const now = new Date();
    const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const dateStr = now.toLocaleDateString("tr-TR");

    let lines = [];
    lines.push(ev.emoji + " <b>" + ev.label + "</b>");
    lines.push("");

    if (data.countryLabel) lines.push("\uD83C\uDF0D <b>\u00DClke:</b> " + data.countryLabel);
    if (data.centerName) lines.push("\uD83C\uDFE2 <b>Merkez:</b> " + data.centerName);
    if (data.visaLabel) lines.push("\uD83D\uDCCB <b>Kategori:</b> " + data.visaLabel);
    if (data.date) lines.push("\uD83D\uDCC5 <b>Tarih:</b> " + data.date);
    if (data.slot) lines.push("\u23F0 <b>Saat:</b> " + data.slot);
    if (data.fee) lines.push("\uD83D\uDCB0 <b>\u00DCcret:</b> " + data.fee + " " + (data.currency || "TRY"));
    if (data.waitlistRef) lines.push("\uD83D\uDD16 <b>Referans:</b> " + data.waitlistRef);
    if (data.message) lines.push("\uD83D\uDCDD " + data.message);
    if (data.error) lines.push("\u274C <b>Hata:</b> " + data.error);

    if (data.applicants && data.applicants.length > 0) {
        lines.push("");
        lines.push("\uD83D\uDC65 <b>Ba\u015fvuranlar (" + data.applicants.length + "):</b>");
        data.applicants.forEach((a, i) => {
            const name = ((a.firstName || "") + " " + (a.lastName || "")).trim();
            if (name) lines.push("  " + (i + 1) + ". " + name);
        });
    }

    lines.push("");
    lines.push("\uD83D\uDD52 " + dateStr + " " + timeStr);

    const text = lines.join("\n");

    try {
        await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "HTML",
                disable_web_page_preview: true
            })
        });
    } catch (_) {
        // Bildirim hatalarini sessizce yoksay
    }
}


function getSelectedCountry() {
    const stored = localStorage.getItem(COUNTRY_KEY);
    if (stored && countryConfig[stored]) return stored;
    const fallback = Object.keys(countryConfig)[0] || "turkey";
    localStorage.setItem(COUNTRY_KEY, fallback);
    return fallback;
}
function setSelectedCountry(val) {
    localStorage.setItem(COUNTRY_KEY, val);
}

// VFS API için token sakla
let lastAuthorize = "", lastClientSource = "";
(function () {
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
        if (key.toLowerCase() === "authorize") lastAuthorize = value;
        if (key.toLowerCase() === "clientsource") lastClientSource = value;
        origSetHeader.apply(this, arguments);
    };
})();


// Her iki ülke için çoklu müşteri desteği
function getClientListKey() {
    return `vfs_turkiye_${getSelectedCountry()}_multiClientList`;
}
function getSelectedClientKey() {
    return `vfs_turkiye_${getSelectedCountry()}_selectedClient`;
}
function loadClientList() {
    try {
        let list = JSON.parse(localStorage.getItem(getClientListKey()) || "[]");
        if (!Array.isArray(list)) return [];
        if (list.length === 0) {
            let newId = "client-" + Date.now();
            list = [{ id: newId, name: "Varsayılan" }];
            localStorage.setItem(getClientListKey(), JSON.stringify(list));
            localStorage.setItem(getSelectedClientKey(), newId);
        }
        return list;
    } catch { return []; }
}
function saveClientList(list) { localStorage.setItem(getClientListKey(), JSON.stringify(list)); }
function getSelectedClientId() {
    return localStorage.getItem(getSelectedClientKey()) || (loadClientList().length ? loadClientList()[0].id : null);
}
function saveSelectedClient(cid) { localStorage.setItem(getSelectedClientKey(), cid); }
function getClientStorageKey(cid) { return `vfs_turkiye_${getSelectedCountry()}_clients_${cid}`; }
function getCalKeyForClient(cid) { return `vfs_turkiye_${getSelectedCountry()}_client_dates_${cid}`; }
function getFamilyKeyForClient(cid) { return `vfs_turkiye_${getSelectedCountry()}_family_${cid}`; }
function getCheckSlotKey(cid) { return `vfs_turkiye_${getSelectedCountry()}_checkSlot_${cid}`; }
function saveCheckSlot(cid, val) { localStorage.setItem(getCheckSlotKey(cid), val ? "1" : "0"); }
function loadCheckSlot(cid) { return localStorage.getItem(getCheckSlotKey(cid)) === "1"; }
const editableFields = [
    { id: "firstName", label: "Ad", type: "text", def: "" },
    { id: "lastName", label: "Soyad", type: "text", def: "" },
    { id: "gender", label: "Cinsiyet", type: "select", options: [{ v: 2, t: "Kadın" }, { v: 1, t: "Erkek" }, { v: 0, t: "Belirtilmemiş" }], def: 2 },
    { id: "dateOfBirth", label: "Doğum Tarihi", type: "date", def: "" },
    { id: "passportNumber", label: "Pasaport Numarası", type: "text", def: "" },
    { id: "passportExpirtyDate", label: "Pasaport Bitiş Tarihi", type: "date", def: "" },
    { id: "contactNumber", label: "Telefon Numarası", type: "text", def: "" },
    { id: "emailId", label: "E-posta", type: "email", def: "" }
];

// Depolama yardımcıları (ülke ve müşteri başına)
function saveFamily(arr, cid) { localStorage.setItem(getFamilyKeyForClient(cid), JSON.stringify(arr)); }
function loadFamily(cid) { try { return JSON.parse(localStorage.getItem(getFamilyKeyForClient(cid)) || "[]"); } catch { return []; } }
function saveField(cid, name, value) {
    let data = JSON.parse(localStorage.getItem(getClientStorageKey(cid)) || "{}");
    data[name] = value;
    localStorage.setItem(getClientStorageKey(cid), JSON.stringify(data));
}
function loadField(cid, name, def = "") {
    let data = JSON.parse(localStorage.getItem(getClientStorageKey(cid)) || "{}");
    return data[name] !== undefined ? data[name] : def;
}
function saveCalendarDates(dates, cid) { localStorage.setItem(getCalKeyForClient(cid), JSON.stringify(dates)); }
function loadCalendarDates(cid) { try { return JSON.parse(localStorage.getItem(getCalKeyForClient(cid)) || "[]"); } catch { return []; } }
function formatDateForPayload(d) {
    if (!d) return null;
    if (d.includes("-")) { let [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }
    if (/^\d{4}\//.test(d)) { let [y, m, dd] = d.split("/"); return `${dd}/${m}/${y}`; }
    return d;
}

// Müşteri başına bekleme listesi zamanlayıcıları (zamanlama tetikleyici)
const waitlistTimers = {};
function clearWaitlistTimer(cid) {
    if (waitlistTimers[cid]) { clearTimeout(waitlistTimers[cid]); delete waitlistTimers[cid]; }
}
function armWaitlistTimer(cid, centerCode, visaCategoryCode) {
    clearWaitlistTimer(cid);
    const schedOn = loadField(cid, 'waitlistSchedOn', "0") === "1";
    const schedTime = loadField(cid, 'waitlistSchedTime', "");
    if (!schedOn || !schedTime) return;
    // Tüm bekleme listesi kategorileri için zamanlamaya izin ver
    // SS:DD veya SS:DD:SN formatını güvenli şekilde ayrıştır
    const parts = schedTime.split(":");
    const hh = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    const ss = parts.length > 2 ? Number(parts[2] || 0) : 0;
    const target = new Date();
    target.setHours(hh, mm, ss, 0);
    let delay = target.getTime() - Date.now();
    if (delay < 0) delay = 0;
    waitlistTimers[cid] = setTimeout(() => {
        saveField(cid, 'waitlistSchedOn', "0");
        doBookingTurkeyAutoFirstSlot();
    }, delay);
}

// Toast bildirim sistemi
const TOAST_MAX = 3;
const TOAST_DURATION = 8000;
function getToastContainer() {
    let c = document.getElementById("vfs-toast-container");
    if (!c) {
        c = document.createElement("div");
        c.id = "vfs-toast-container";
        document.body.appendChild(c);
    }
    return c;
}
const toastIcons = {
    success: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    wait: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    warn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    congrats: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b07bff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
};
const toastBorderColors = { success: "#4ade80", error: "#f87171", info: "#60a5fa", wait: "#fbbf24", warn: "#fbbf24", congrats: "#b07bff" };

function showToast({ status = "info", message = "", details = "" }) {
    const container = getToastContainer();
    while (container.children.length >= TOAST_MAX) {
        const oldest = container.firstChild;
        if (oldest) oldest.remove();
    }
    const toast = document.createElement("div");
    toast.className = "vfs-toast vfs-toast-" + status;
    toast.style.borderLeftColor = toastBorderColors[status] || toastBorderColors.info;
    // Toast içeriğini güvenli DOM API ile oluştur
    const headerDiv = document.createElement("div");
    headerDiv.className = "vfs-toast-header";
    const iconSpan = document.createElement("span");
    iconSpan.className = "vfs-toast-icon";
    iconSpan.innerHTML = toastIcons[status] || toastIcons.info; // SVG ikonlar - güvenilir kaynak
    const msgSpan = document.createElement("span");
    msgSpan.className = "vfs-toast-msg";
    msgSpan.textContent = message;
    const closeBtn = document.createElement("button");
    closeBtn.className = "vfs-toast-close";
    closeBtn.textContent = "×";
    closeBtn.onclick = () => toast.remove();
    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(msgSpan);
    headerDiv.appendChild(closeBtn);
    toast.appendChild(headerDiv);
    if (details) {
        const detailsDiv = document.createElement("div");
        detailsDiv.className = "vfs-toast-details";
        detailsDiv.textContent = details;
        toast.appendChild(detailsDiv);
    }
    const progressDiv = document.createElement("div");
    progressDiv.className = "vfs-toast-progress";
    const progressBar = document.createElement("div");
    progressBar.className = "vfs-toast-progress-bar";
    progressDiv.appendChild(progressBar);
    toast.appendChild(progressDiv);
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "vfs-slideOutRight 0.35s ease forwards";
        setTimeout(() => toast.remove(), 400);
    }, TOAST_DURATION);
}
// Geriye uyumluluk alias (harici kodlar icin)
function showStatusPanel(args) { showToast(args); }

function injectProTheme() {
    if (document.getElementById("vfs-pro-theme")) return;
    const style = document.createElement("style");
    style.id = "vfs-pro-theme";
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
:root {
    --vfs-ink:#0f0b1a;
    --vfs-glass:rgba(18,14,40,0.72);
    --vfs-glass-border:rgba(176,123,255,0.25);
    --vfs-panel:#151129;
    --vfs-card:#1d1634;
    --vfs-accent:#b07bff;
    --vfs-accent-2:#7cf4ff;
    --vfs-gradient:linear-gradient(135deg,#b07bff,#7cf4ff);
    --vfs-text:#e7e5ff;
    --vfs-muted:#8b87ad;
    --vfs-border:rgba(176,123,255,0.35);
    --vfs-glow:0 8px 32px rgba(88,54,178,0.35);
    --vfs-neon-glow:0 0 20px rgba(176,123,255,0.4),0 0 60px rgba(124,244,255,0.15);
    --vfs-font:'Space Grotesk','Inter',system-ui,sans-serif;
    --vfs-success:#4ade80;
    --vfs-error:#f87171;
    --vfs-warning:#fbbf24;
    --vfs-info:#60a5fa;
    --vfs-sidebar-w:380px;
    --vfs-radius:12px;
    --vfs-radius-sm:8px;
}

/* === Keyframe Animasyonlar === */
@keyframes vfs-slideInRight { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes vfs-slideOutRight { from{transform:translateX(0);opacity:1} to{transform:translateX(100%);opacity:0} }
@keyframes vfs-fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes vfs-fadeOut { from{opacity:1} to{opacity:0} }
@keyframes vfs-tabSlideLeft { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
@keyframes vfs-tabSlideRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
@keyframes vfs-glowPulse { 0%,100%{box-shadow:0 0 8px rgba(176,123,255,0.3)} 50%{box-shadow:0 0 20px rgba(176,123,255,0.6),0 0 40px rgba(124,244,255,0.2)} }
@keyframes vfs-toastProgress { from{width:100%} to{width:0%} }
@keyframes vfs-scalePress { 0%{transform:scale(1)} 50%{transform:scale(0.95)} 100%{transform:scale(1)} }
@keyframes vfs-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes vfs-spin { to{transform:rotate(360deg)} }

/* === Sidebar === */
#vfs-sidebar-container { position:fixed; top:0; right:0; height:100vh; z-index:999990; display:flex; align-items:stretch; pointer-events:none; font-family:var(--vfs-font); }
#vfs-sidebar-container * { box-sizing:border-box; }
#vfs-sidebar-toggle { pointer-events:all; align-self:center; width:28px; min-height:80px; background:var(--vfs-glass); backdrop-filter:blur(16px) saturate(180%); -webkit-backdrop-filter:blur(16px) saturate(180%); border:1px solid var(--vfs-glass-border); border-right:none; border-radius:var(--vfs-radius) 0 0 var(--vfs-radius); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--vfs-accent); font-size:16px; transition:all 0.3s ease; }
#vfs-sidebar-toggle:hover { background:rgba(176,123,255,0.15); width:32px; }
#vfs-sidebar { pointer-events:all; width:var(--vfs-sidebar-w); height:100vh; background:var(--vfs-glass); backdrop-filter:blur(20px) saturate(180%); -webkit-backdrop-filter:blur(20px) saturate(180%); border-left:1px solid var(--vfs-glass-border); display:flex; flex-direction:column; transition:transform 0.4s cubic-bezier(0.4,0,0.2,1),opacity 0.3s ease; overflow:hidden; }
#vfs-sidebar-container.collapsed #vfs-sidebar { transform:translateX(100%); opacity:0; pointer-events:none; }
#vfs-sidebar-container.collapsed #vfs-sidebar-toggle svg { transform:rotate(180deg); }

.vfs-sidebar-header { padding:16px 20px 12px; border-bottom:1px solid var(--vfs-border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
.vfs-sidebar-header h3 { margin:0; font-size:17px; font-weight:700; background:var(--vfs-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.vfs-sidebar-header-actions { display:flex; align-items:center; gap:8px; }
.vfs-sidebar-header-actions button { background:transparent; border:1px solid var(--vfs-border); color:var(--vfs-muted); border-radius:var(--vfs-radius-sm); padding:4px 10px; font-size:12px; cursor:pointer; font-family:var(--vfs-font); transition:all 0.2s; }
.vfs-sidebar-header-actions button:hover { color:var(--vfs-text); border-color:var(--vfs-accent); }

.vfs-country-bar { padding:10px 20px; border-bottom:1px solid var(--vfs-border); display:flex; gap:8px; align-items:center; flex-shrink:0; }
.vfs-country-bar select { flex:1; background:#1b1731; color:var(--vfs-text); border:1px solid var(--vfs-border); border-radius:var(--vfs-radius-sm); padding:6px 10px; font-size:13px; font-family:var(--vfs-font); outline:none; }
.vfs-country-bar select:focus { border-color:var(--vfs-accent); box-shadow:0 0 0 2px rgba(176,123,255,0.2); }
.vfs-client-row { display:flex; gap:6px; align-items:center; }
.vfs-client-row select { flex:1; }
.vfs-client-row button { background:transparent; border:1px solid var(--vfs-border); color:var(--vfs-muted); border-radius:var(--vfs-radius-sm); padding:4px 8px; font-size:12px; cursor:pointer; white-space:nowrap; font-family:var(--vfs-font); transition:all 0.2s; }
.vfs-client-row button:hover { border-color:var(--vfs-accent); color:var(--vfs-text); }

/* === Tab Bar === */
.vfs-tab-bar { display:flex; padding:0 20px; border-bottom:1px solid var(--vfs-border); flex-shrink:0; }
.vfs-tab-btn { flex:1; padding:10px 0; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--vfs-muted); font-size:12px; font-weight:600; cursor:pointer; font-family:var(--vfs-font); transition:all 0.25s ease; text-transform:uppercase; letter-spacing:0.5px; }
.vfs-tab-btn:hover { color:var(--vfs-text); }
.vfs-tab-btn.active { color:var(--vfs-accent); border-bottom-color:var(--vfs-accent); }

/* === Tab Content === */
.vfs-tab-content { flex:1; overflow-y:auto; padding:16px 20px; scrollbar-width:thin; scrollbar-color:rgba(176,123,255,0.3) transparent; }
.vfs-tab-content::-webkit-scrollbar { width:5px; }
.vfs-tab-content::-webkit-scrollbar-thumb { background:rgba(176,123,255,0.3); border-radius:4px; }
.vfs-tab-panel { display:none; animation:vfs-fadeIn 0.3s ease; }
.vfs-tab-panel.active { display:block; }
.vfs-tab-panel.slide-left { animation:vfs-tabSlideLeft 0.3s ease; }
.vfs-tab-panel.slide-right { animation:vfs-tabSlideRight 0.3s ease; }

/* === Floating Label Input === */
.vfs-fl-group { position:relative; margin-bottom:14px; }
.vfs-fl-group input,.vfs-fl-group select { width:100%; padding:14px 12px 6px; background:#1b1731; color:var(--vfs-text); border:1px solid var(--vfs-border); border-radius:var(--vfs-radius-sm); font-size:14px; font-family:var(--vfs-font); outline:none; transition:border-color 0.2s,box-shadow 0.2s; appearance:none; -webkit-appearance:none; }
.vfs-fl-group input:focus,.vfs-fl-group select:focus { border-color:var(--vfs-accent); box-shadow:0 0 0 2px rgba(176,123,255,0.15); }
.vfs-fl-group label { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--vfs-muted); font-size:14px; pointer-events:none; transition:all 0.2s ease; }
.vfs-fl-group input:focus~label,.vfs-fl-group input:not(:placeholder-shown)~label,.vfs-fl-group select~label,.vfs-fl-group input[type="date"]~label { top:8px; transform:translateY(0); font-size:10px; color:var(--vfs-accent); letter-spacing:0.3px; }

/* === Toggle Switch === */
.vfs-toggle-wrap { display:flex; align-items:center; justify-content:space-between; padding:8px 0; }
.vfs-toggle-label { color:var(--vfs-text); font-size:13px; font-weight:500; }
.vfs-toggle { position:relative; width:44px; height:24px; flex-shrink:0; }
.vfs-toggle input { opacity:0; width:0; height:0; position:absolute; }
.vfs-toggle-slider { position:absolute; cursor:pointer; inset:0; background:#2a2347; border-radius:12px; transition:all 0.3s ease; border:1px solid var(--vfs-border); }
.vfs-toggle-slider:before { content:""; position:absolute; height:18px; width:18px; left:2px; bottom:2px; background:#8b87ad; border-radius:50%; transition:all 0.3s ease; }
.vfs-toggle input:checked+.vfs-toggle-slider { background:rgba(176,123,255,0.3); border-color:var(--vfs-accent); }
.vfs-toggle input:checked+.vfs-toggle-slider:before { transform:translateX(20px); background:var(--vfs-accent); box-shadow:0 0 8px rgba(176,123,255,0.5); }

/* === Action Grid === */
.vfs-action-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
.vfs-action-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:14px 8px; border-radius:var(--vfs-radius); border:1px solid var(--vfs-border); background:rgba(27,23,49,0.6); color:var(--vfs-text); font-size:12px; font-weight:600; cursor:pointer; font-family:var(--vfs-font); transition:all 0.25s ease; text-align:center; }
.vfs-action-btn:hover { border-color:var(--vfs-accent); background:rgba(176,123,255,0.08); transform:translateY(-1px); }
.vfs-action-btn:active { animation:vfs-scalePress 0.2s ease; }
.vfs-action-btn.primary { grid-column:1/-1; background:var(--vfs-gradient); color:#0c0a18; border:none; font-size:14px; padding:16px; box-shadow:0 8px 24px rgba(176,123,255,0.3); }
.vfs-action-btn.primary:hover { box-shadow:0 12px 32px rgba(176,123,255,0.45); transform:translateY(-2px); }
.vfs-action-btn.active { border-color:var(--vfs-success); background:rgba(74,222,128,0.1); }
.vfs-action-btn svg { width:20px; height:20px; }

/* === Glass Card === */
.vfs-glass-card { background:rgba(27,23,49,0.5); border:1px solid var(--vfs-border); border-radius:var(--vfs-radius); padding:14px; margin-bottom:12px; }
.vfs-glass-card-title { font-size:13px; font-weight:700; color:var(--vfs-accent); margin-bottom:10px; letter-spacing:0.3px; }

/* === Family Member Card === */
.vfs-family-card { background:rgba(27,23,49,0.4); border:1px solid var(--vfs-border); border-radius:var(--vfs-radius); padding:12px; margin-bottom:10px; animation:vfs-fadeIn 0.3s ease; }
.vfs-family-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.vfs-family-card-header span { font-weight:600; font-size:13px; color:var(--vfs-accent-2); }
.vfs-family-card-header button { background:transparent; border:none; color:var(--vfs-error); cursor:pointer; font-size:16px; padding:2px 6px; border-radius:4px; transition:background 0.2s; }
.vfs-family-card-header button:hover { background:rgba(248,113,113,0.15); }

/* === Toast Bildirimleri === */
#vfs-toast-container { position:fixed; bottom:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:10px; max-width:420px; min-width:340px; font-family:var(--vfs-font); pointer-events:none; }
.vfs-toast { pointer-events:all; background:var(--vfs-glass); backdrop-filter:blur(16px) saturate(180%); -webkit-backdrop-filter:blur(16px) saturate(180%); border:1px solid var(--vfs-glass-border); border-left:3px solid var(--vfs-accent); border-radius:var(--vfs-radius-sm); padding:12px 14px 8px; animation:vfs-slideInRight 0.35s ease; position:relative; overflow:hidden; }
.vfs-toast-header { display:flex; align-items:center; gap:10px; }
.vfs-toast-icon { flex-shrink:0; display:flex; }
.vfs-toast-msg { flex:1; color:var(--vfs-text); font-size:14px; font-weight:500; line-height:1.4; }
.vfs-toast-close { background:transparent; border:none; color:var(--vfs-muted); font-size:18px; cursor:pointer; padding:0 4px; line-height:1; transition:color 0.2s; }
.vfs-toast-close:hover { color:var(--vfs-text); }
.vfs-toast-details { color:var(--vfs-muted); font-size:12px; margin:6px 0 4px 32px; line-height:1.4; word-break:break-word; }
.vfs-toast-progress { position:absolute; bottom:0; left:0; right:0; height:2px; background:rgba(255,255,255,0.05); }
.vfs-toast-progress-bar { height:100%; background:var(--vfs-accent); animation:vfs-toastProgress ${TOAST_DURATION}ms linear forwards; border-radius:0 2px 2px 0; }

/* === Timeslot Picker Overlay === */
#vfs-timeslot-overlay { position:fixed; inset:0; z-index:999998; background:rgba(15,11,26,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; animation:vfs-fadeIn 0.25s ease; }
#vfs-timeslot-picker-panel { background:var(--vfs-glass); backdrop-filter:blur(20px) saturate(180%); -webkit-backdrop-filter:blur(20px) saturate(180%); border:1px solid var(--vfs-glass-border); border-radius:var(--vfs-radius); padding:24px; max-width:480px; width:90vw; max-height:70vh; overflow-y:auto; font-family:var(--vfs-font); color:var(--vfs-text); animation:vfs-fadeIn 0.3s ease; }
#vfs-timeslot-picker-panel h3 { margin:0 0 16px; font-size:16px; background:var(--vfs-gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.vfs-slot-btn { width:100%; padding:10px 14px; margin-bottom:8px; background:rgba(27,23,49,0.6); border:1px solid var(--vfs-border); border-radius:var(--vfs-radius-sm); color:var(--vfs-text); font-size:14px; font-weight:500; cursor:pointer; font-family:var(--vfs-font); transition:all 0.2s; text-align:left; }
.vfs-slot-btn:hover { border-color:var(--vfs-accent); background:rgba(176,123,255,0.1); transform:translateX(4px); }
.vfs-slot-close { width:100%; padding:10px; margin-top:8px; background:transparent; border:1px solid var(--vfs-error); border-radius:var(--vfs-radius-sm); color:var(--vfs-error); font-size:13px; font-weight:600; cursor:pointer; font-family:var(--vfs-font); transition:all 0.2s; }
.vfs-slot-close:hover { background:rgba(248,113,113,0.1); }

/* === Sidebar Footer === */
.vfs-sidebar-footer { padding:10px 20px; border-top:1px solid var(--vfs-border); font-size:11px; color:var(--vfs-muted); text-align:center; flex-shrink:0; }

/* === Utility === */
.vfs-section-title { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--vfs-muted); margin:16px 0 8px; font-weight:600; }
.vfs-add-btn { width:100%; padding:10px; background:transparent; border:1px dashed var(--vfs-border); border-radius:var(--vfs-radius-sm); color:var(--vfs-accent); font-size:13px; font-weight:600; cursor:pointer; font-family:var(--vfs-font); transition:all 0.2s; }
.vfs-add-btn:hover { border-color:var(--vfs-accent); background:rgba(176,123,255,0.05); }

/* Mevcut VFS sayfası elemanlarının üzerine yazmamak için scope */
#vfs-sidebar-container input[type="text"],#vfs-sidebar-container input[type="email"],#vfs-sidebar-container input[type="date"],#vfs-sidebar-container input[type="time"],#vfs-sidebar-container select { background:#1b1731; color:var(--vfs-text); border:1px solid var(--vfs-border); font-family:var(--vfs-font); }
`;
    document.head.appendChild(style);
}

injectProTheme();

// === UI Yardimci Bilesenler ===
function createFloatingInput(field, value, onInput) {
    const group = document.createElement("div");
    group.className = "vfs-fl-group";
    let input;
    if (field.type === "select") {
        input = document.createElement("select");
        input.id = "vfs-fi-" + field.id;
        for (const o of field.options) {
            const opt = document.createElement("option");
            opt.value = o.v;
            opt.textContent = o.t;
            input.appendChild(opt);
        }
        input.value = value;
        input.onchange = () => onInput(input.value);
    } else {
        input = document.createElement("input");
        input.type = field.type;
        input.id = "vfs-fi-" + field.id;
        input.placeholder = " ";
        input.value = value;
        input.oninput = () => onInput(input.value);
    }
    const label = document.createElement("label");
    label.htmlFor = "vfs-fi-" + field.id;
    label.textContent = field.label;
    group.appendChild(input);
    group.appendChild(label);
    return group;
}

function createToggleSwitch(id, labelText, checked, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "vfs-toggle-wrap";
    const lbl = document.createElement("span");
    lbl.className = "vfs-toggle-label";
    lbl.textContent = labelText;
    const toggle = document.createElement("label");
    toggle.className = "vfs-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "vfs-tg-" + id;
    cb.checked = checked;
    cb.onchange = () => onChange(cb.checked);
    const slider = document.createElement("span");
    slider.className = "vfs-toggle-slider";
    toggle.appendChild(cb);
    toggle.appendChild(slider);
    wrap.appendChild(lbl);
    wrap.appendChild(toggle);
    return wrap;
}

function createActionButton(svgIcon, label, onClick, isPrimary) {
    const btn = document.createElement("button");
    btn.className = "vfs-action-btn" + (isPrimary ? " primary" : "");
    // SVG ikon - statik, guvenilir icerik
    const iconSpan = document.createElement("span");
    const svgTemplate = document.createElement("template");
    svgTemplate.innerHTML = svgIcon.trim();
    iconSpan.appendChild(svgTemplate.content.firstChild);
    const lblSpan = document.createElement("span");
    lblSpan.textContent = label;
    btn.appendChild(iconSpan);
    btn.appendChild(lblSpan);
    btn.onclick = onClick;
    return btn;
}

function createGlassCard(title, contentEl) {
    const card = document.createElement("div");
    card.className = "vfs-glass-card";
    if (title) {
        const t = document.createElement("div");
        t.className = "vfs-glass-card-title";
        t.textContent = title;
        card.appendChild(t);
    }
    if (contentEl) card.appendChild(contentEl);
    return card;
}

// === Sidebar Sistemi ===
let currentTab = 0;
function getStoredTab() {
    try { return parseInt(localStorage.getItem("vfs_sidebar_tab") || "0") || 0; } catch { return 0; }
}
function storeTab(idx) { localStorage.setItem("vfs_sidebar_tab", idx); }
function isSidebarCollapsed() { return localStorage.getItem("vfs_sidebar_collapsed") === "1"; }
function setSidebarCollapsed(v) { localStorage.setItem("vfs_sidebar_collapsed", v ? "1" : "0"); }

function createSidebar() {
    const old = document.getElementById("vfs-sidebar-container");
    if (old) old.remove();
    const oldPanel = document.getElementById("vfs-client-panel");
    if (oldPanel) oldPanel.remove();
    const oldLang = document.getElementById("vfs-lang-toggle");
    if (oldLang) oldLang.remove();

    const panelCid = getSelectedClientId();
    currentTab = getStoredTab();

    const container = document.createElement("div");
    container.id = "vfs-sidebar-container";
    if (isSidebarCollapsed()) container.classList.add("collapsed");

    // Toggle butonu
    const toggle = document.createElement("div");
    toggle.id = "vfs-sidebar-toggle";
    const toggleSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    toggleSvg.setAttribute("width", "14");
    toggleSvg.setAttribute("height", "14");
    toggleSvg.setAttribute("viewBox", "0 0 24 24");
    toggleSvg.setAttribute("fill", "none");
    toggleSvg.setAttribute("stroke", "currentColor");
    toggleSvg.setAttribute("stroke-width", "2.5");
    toggleSvg.setAttribute("stroke-linecap", "round");
    toggleSvg.setAttribute("stroke-linejoin", "round");
    toggleSvg.style.transition = "transform 0.3s";
    const togglePolyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    togglePolyline.setAttribute("points", "15 18 9 12 15 6");
    toggleSvg.appendChild(togglePolyline);
    toggle.appendChild(toggleSvg);
    toggle.title = isSidebarCollapsed() ? t('sidebarExpand') : t('sidebarCollapse');
    toggle.onclick = () => {
        const willCollapse = !container.classList.contains("collapsed");
        container.classList.toggle("collapsed");
        setSidebarCollapsed(willCollapse);
        toggle.title = willCollapse ? t('sidebarExpand') : t('sidebarCollapse');
    };
    container.appendChild(toggle);

    const sidebar = document.createElement("div");
    sidebar.id = "vfs-sidebar";

    // Header
    const header = document.createElement("div");
    header.className = "vfs-sidebar-header";
    const titleEl = document.createElement("h3");
    titleEl.textContent = "VFS Bot Pro";
    const headerActions = document.createElement("div");
    headerActions.className = "vfs-sidebar-header-actions";
    const langBtn = document.createElement("button");
    langBtn.textContent = t('langToggle');
    langBtn.onclick = () => {
        const next = getLang() === "en" ? "tr" : "en";
        setLang(next);
        createSidebar();
    };
    headerActions.appendChild(langBtn);
    header.appendChild(titleEl);
    header.appendChild(headerActions);
    sidebar.appendChild(header);

    // Ulke + Musteri bar
    const countryBar = document.createElement("div");
    countryBar.className = "vfs-country-bar";
    countryBar.style.flexDirection = "column";
    countryBar.style.gap = "8px";

    const countryRow = document.createElement("div");
    countryRow.style.display = "flex";
    countryRow.style.gap = "8px";
    countryRow.style.width = "100%";
    countryRow.style.alignItems = "center";
    const countryLabelEl = document.createElement("span");
    countryLabelEl.textContent = t('countryLabel');
    countryLabelEl.style.color = "var(--vfs-muted)";
    countryLabelEl.style.fontSize = "12px";
    countryLabelEl.style.fontWeight = "600";
    countryLabelEl.style.whiteSpace = "nowrap";
    const countrySel = document.createElement("select");
    Object.entries(countryConfig).forEach(([key, cfg]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = cfg.label;
        countrySel.appendChild(opt);
    });
    countrySel.value = getSelectedCountry();
    countrySel.onchange = function () {
        setSelectedCountry(this.value);
        createSidebar();
    };
    countryRow.appendChild(countryLabelEl);
    countryRow.appendChild(countrySel);
    countryBar.appendChild(countryRow);

    const clientList = loadClientList();
    let cid = getSelectedClientId();
    if (!cid && clientList.length) { cid = clientList[0].id; saveSelectedClient(cid); }
    const clientRow = document.createElement("div");
    clientRow.className = "vfs-client-row";
    const clientSel = document.createElement("select");
    clientList.forEach(cl => {
        const opt = document.createElement("option");
        opt.value = cl.id;
        opt.textContent = cl.name || ("Client " + cl.id.substring(0, 8));
        if (cl.id === cid) opt.selected = true;
        clientSel.appendChild(opt);
    });
    clientSel.onchange = function () {
        saveSelectedClient(this.value);
        createSidebar();
    };
    const addClientBtn = document.createElement("button");
    addClientBtn.textContent = "+";
    addClientBtn.title = t('addClient');
    addClientBtn.onclick = () => {
        const list = loadClientList();
        const newId = "client-" + Date.now();
        const newName = prompt(t('clientNamePrompt'), "Client " + (list.length + 1));
        if (!newName) return;
        list.push({ id: newId, name: newName });
        saveClientList(list);
        saveSelectedClient(newId);
        createSidebar();
    };
    const rmClientBtn = document.createElement("button");
    rmClientBtn.textContent = String.fromCharCode(8722);
    rmClientBtn.title = t('removeClient');
    rmClientBtn.onclick = () => {
        const list = loadClientList();
        if (list.length <= 1) { alert(t('atLeastOneClient')); return; }
        const idx = list.findIndex(x => x.id === cid);
        if (idx >= 0) list.splice(idx, 1);
        saveClientList(list);
        saveSelectedClient(list[0].id);
        createSidebar();
    };
    const renameBtn = document.createElement("button");
    renameBtn.textContent = String.fromCharCode(9998);
    renameBtn.title = t('renameClient');
    renameBtn.onclick = () => {
        const list = loadClientList();
        const idx = list.findIndex(x => x.id === cid);
        if (idx < 0) return;
        const newName = prompt(t('renameClientPrompt'), list[idx].name);
        if (!newName) return;
        list[idx].name = newName;
        saveClientList(list);
        createSidebar();
    };
    clientRow.appendChild(clientSel);
    clientRow.appendChild(addClientBtn);
    clientRow.appendChild(rmClientBtn);
    clientRow.appendChild(renameBtn);
    countryBar.appendChild(clientRow);
    sidebar.appendChild(countryBar);

    // Tab bar
    const tabBar = document.createElement("div");
    tabBar.className = "vfs-tab-bar";
    const tabNames = ['tabApplicant', 'tabSettings', 'tabFamily', 'tabControl'];
    tabNames.forEach((key, idx) => {
        const btn = document.createElement("button");
        btn.className = "vfs-tab-btn" + (idx === currentTab ? " active" : "");
        btn.textContent = t(key);
        btn.onclick = () => switchTab(idx, tabContent);
        tabBar.appendChild(btn);
    });
    sidebar.appendChild(tabBar);

    const tabContent = document.createElement("div");
    tabContent.className = "vfs-tab-content";

    const panels = [
        renderApplicantTab(cid),
        renderSettingsTab(cid),
        renderFamilyTab(cid),
        renderControlTab(cid)
    ];
    panels.forEach((p, idx) => {
        p.className = "vfs-tab-panel" + (idx === currentTab ? " active" : "");
        p.dataset.tabIdx = idx;
        tabContent.appendChild(p);
    });
    sidebar.appendChild(tabContent);

    const footer = document.createElement("div");
    footer.className = "vfs-sidebar-footer";
    footer.textContent = "VFS Bot Pro v10.0 " + String.fromCharCode(8226) + " " + countryConfig[getSelectedCountry()].label;
    sidebar.appendChild(footer);

    container.appendChild(sidebar);
    document.body.appendChild(container);
}

function switchTab(newIdx, tabContent) {
    const oldIdx = currentTab;
    if (newIdx === oldIdx) return;
    currentTab = newIdx;
    storeTab(newIdx);
    const btns = tabContent.parentElement.querySelectorAll(".vfs-tab-btn");
    btns.forEach((b, i) => b.classList.toggle("active", i === newIdx));
    const panels = tabContent.querySelectorAll(".vfs-tab-panel");
    panels.forEach((p, i) => {
        if (i === newIdx) {
            p.classList.add("active");
            p.classList.remove("slide-left", "slide-right");
            p.classList.add(newIdx > oldIdx ? "slide-right" : "slide-left");
        } else {
            p.classList.remove("active", "slide-left", "slide-right");
        }
    });
}

// Tab 1 - Basvuran
function renderApplicantTab(cid) {
    const panel = document.createElement("div");
    for (const f of editableFields) {
        const val = loadField(cid, f.id, f.def);
        const group = createFloatingInput(f, val, (v) => saveField(cid, f.id, v));
        panel.appendChild(group);
    }
    return panel;
}

// Tab 2 - Ayarlar
function renderSettingsTab(cid) {
    const panel = document.createElement("div");
    const config = countryConfig[getSelectedCountry()];

    const centerField = {
        id: "centerCode", label: t('center'), type: "select",
        options: config.centers.map(c => ({ v: c.code, t: c.name }))
    };
    const centerVal = loadField(cid, 'centerCode', config.centers[0].code);
    const centerGroup = createFloatingInput(centerField, centerVal, (v) => {
        saveField(cid, 'centerCode', v);
        updateVisaCategories(cid, v, panel);
    });
    panel.appendChild(centerGroup);

    const visaContainer = document.createElement("div");
    visaContainer.id = "vfs-visa-cat-container";
    panel.appendChild(visaContainer);
    updateVisaCategories(cid, centerVal, panel);

    const monthTitle = document.createElement("div");
    monthTitle.className = "vfs-section-title";
    monthTitle.textContent = t('monthsToCheck');
    panel.appendChild(monthTitle);

    const monthKey = "vfs_turkiye_" + getSelectedCountry() + "_months_" + cid;
    function loadMonths() { try { return JSON.parse(localStorage.getItem(monthKey) || "[]"); } catch { return []; } }
    function saveMonths(arr) { localStorage.setItem(monthKey, JSON.stringify(arr)); }

    const today = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        months.push({
            label: d.toLocaleString('default', { month: 'long' }) + " " + d.getFullYear(),
            value: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
        });
    }
    for (let m = 2; m < 12; m++) {
        const d = new Date(2026, m, 1);
        const val = "2026-" + String(m + 1).padStart(2, "0");
        if (!months.find(x => x.value === val)) {
            months.push({ label: d.toLocaleString('default', { month: 'long' }) + " 2026", value: val });
        }
    }

    const savedMonths = loadMonths();
    const monthGrid = document.createElement("div");
    monthGrid.style.display = "flex";
    monthGrid.style.flexWrap = "wrap";
    monthGrid.style.gap = "6px";
    monthGrid.style.marginBottom = "12px";

    months.forEach(m => {
        const chip = document.createElement("button");
        chip.textContent = m.label;
        chip.style.cssText = "padding:6px 10px;border-radius:6px;font-size:12px;font-family:var(--vfs-font);cursor:pointer;transition:all 0.2s;border:1px solid var(--vfs-border);background:transparent;color:var(--vfs-muted);";
        const isSelected = savedMonths.includes(m.value) || (!savedMonths.length && m.value === months[0].value);
        if (isSelected) {
            chip.style.background = "rgba(176,123,255,0.15)";
            chip.style.borderColor = "var(--vfs-accent)";
            chip.style.color = "var(--vfs-accent)";
            chip.dataset.selected = "1";
        }
        chip.onclick = () => {
            const sel = chip.dataset.selected === "1";
            chip.dataset.selected = sel ? "0" : "1";
            chip.style.background = sel ? "transparent" : "rgba(176,123,255,0.15)";
            chip.style.borderColor = sel ? "var(--vfs-border)" : "var(--vfs-accent)";
            chip.style.color = sel ? "var(--vfs-muted)" : "var(--vfs-accent)";
            const chips = monthGrid.querySelectorAll("button");
            const selected = [];
            chips.forEach((c, i) => { if (c.dataset.selected === "1") selected.push(months[i].value); });
            saveMonths(selected);
        };
        monthGrid.appendChild(chip);
    });
    panel.appendChild(monthGrid);

    // === Telegram Interaktif Baglanti Rehberi ===
    const tgTitle = document.createElement("div");
    tgTitle.className = "vfs-section-title";
    tgTitle.textContent = "TELEGRAM";
    tgTitle.style.marginTop = "20px";
    panel.appendChild(tgTitle);

    const tgCard = document.createElement("div");
    tgCard.className = "vfs-glass-card";

    renderTelegramWizard(tgCard);

    panel.appendChild(tgCard);

    return panel;
}

// === Telegram Interaktif Baglanti Wizard ===
let tgPollingTimer = null;
const TG_STEP_KEY = "vfs_telegram_step";
function getTgStep() {
    if (getTelegramToken() && getTelegramChatId()) return 3; // bagli
    if (getTelegramToken()) return 1; // token var, chat id yok
    return 0; // hic ayar yok
}

function renderTelegramWizard(container) {
    container.textContent = "";
    const step = getTgStep();
    const connected = step === 3;

    // Acik/kapali toggle (her zaman goster)
    const tgToggle = createToggleSwitch("tg-enabled", t('tgEnabled'), isTelegramEnabled(), (v) => {
        setTelegramEnabled(v);
    });
    container.appendChild(tgToggle);

    // Bagli ise durum goster
    if (connected) {
        renderTgConnectedState(container);
        return;
    }

    // Adim gostergesi
    const steps = document.createElement("div");
    steps.style.cssText = "display:flex;gap:4px;margin:12px 0 16px;";
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.style.cssText = "flex:1;height:3px;border-radius:2px;transition:all 0.3s;";
        dot.style.background = i <= step ? "var(--vfs-accent)" : "var(--vfs-border)";
        steps.appendChild(dot);
    }
    container.appendChild(steps);

    if (step === 0) {
        renderTgStep1(container);
    } else if (step === 1) {
        renderTgStep2(container);
    }
}

// Adim 1: Bot Token gir
function renderTgStep1(container) {
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:12px;color:var(--vfs-muted);margin-bottom:12px;line-height:1.5;";
    hint.textContent = t('tgStep1Hint');
    container.appendChild(hint);

    // @BotFather linki
    const linkBtn = document.createElement("a");
    linkBtn.href = "https://t.me/BotFather";
    linkBtn.target = "_blank";
    linkBtn.rel = "noopener";
    linkBtn.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--vfs-radius-sm);border:1px solid var(--vfs-border);background:rgba(27,23,49,0.4);color:var(--vfs-accent-2);font-size:13px;font-weight:600;text-decoration:none;margin-bottom:12px;transition:all 0.2s;font-family:var(--vfs-font);";
    const botIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    botIcon.setAttribute("width", "18");
    botIcon.setAttribute("height", "18");
    botIcon.setAttribute("viewBox", "0 0 24 24");
    botIcon.setAttribute("fill", "none");
    botIcon.setAttribute("stroke", "currentColor");
    botIcon.setAttribute("stroke-width", "2");
    botIcon.setAttribute("stroke-linecap", "round");
    botIcon.setAttribute("stroke-linejoin", "round");
    const botPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    botPath.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
    botIcon.appendChild(botPath);
    linkBtn.appendChild(botIcon);
    const linkText = document.createElement("span");
    linkText.textContent = t('tgOpenBotFather');
    linkBtn.appendChild(linkText);
    container.appendChild(linkBtn);

    // Token input
    const tokenGroup = createFloatingInput(
        { id: "tg-token", label: "Bot Token", type: "text" },
        getTelegramToken(),
        (v) => setTelegramToken(v.trim())
    );
    container.appendChild(tokenGroup);

    // Devam butonu
    const nextBtn = document.createElement("button");
    nextBtn.className = "vfs-action-btn primary";
    nextBtn.style.cssText += "margin-top:8px;flex-direction:row;gap:8px;";
    const nextText = document.createElement("span");
    nextText.textContent = t('tgNextStep');
    nextBtn.appendChild(nextText);
    nextBtn.onclick = () => {
        const token = getTelegramToken();
        if (!token || token.length < 10) {
            showToast({ status: "warn", message: t('tgTokenRequired') });
            return;
        }
        // Token gecerliligini kontrol et
        fetch("https://api.telegram.org/bot" + token + "/getMe")
            .then(r => r.json())
            .then(json => {
                if (json.ok) {
                    showToast({ status: "success", message: t('tgTokenValid'), details: "@" + (json.result.username || "") });
                    localStorage.setItem("vfs_telegram_botname", json.result.username || "");
                    renderTelegramWizard(container.closest(".vfs-glass-card"));
                } else {
                    showToast({ status: "error", message: t('tgTokenInvalid'), details: json.description || "" });
                }
            })
            .catch(() => {
                showToast({ status: "error", message: t('tgTokenInvalid') });
            });
    };
    container.appendChild(nextBtn);
}

// Adim 2: /start bekle (polling)
function renderTgStep2(container) {
    const botName = localStorage.getItem("vfs_telegram_botname") || "";

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:12px;color:var(--vfs-muted);margin-bottom:12px;line-height:1.5;";
    hint.textContent = t('tgStep2Hint');
    container.appendChild(hint);

    // Bota git linki
    if (botName) {
        const botLink = document.createElement("a");
        botLink.href = "https://t.me/" + botName;
        botLink.target = "_blank";
        botLink.rel = "noopener";
        botLink.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--vfs-radius-sm);border:1px solid var(--vfs-accent);background:rgba(176,123,255,0.08);color:var(--vfs-accent);font-size:13px;font-weight:600;text-decoration:none;margin-bottom:12px;transition:all 0.2s;font-family:var(--vfs-font);";
        const sendIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sendIcon.setAttribute("width", "18");
        sendIcon.setAttribute("height", "18");
        sendIcon.setAttribute("viewBox", "0 0 24 24");
        sendIcon.setAttribute("fill", "none");
        sendIcon.setAttribute("stroke", "currentColor");
        sendIcon.setAttribute("stroke-width", "2");
        sendIcon.setAttribute("stroke-linecap", "round");
        sendIcon.setAttribute("stroke-linejoin", "round");
        const sendPath = document.createElementNS("http://www.w3.org/2000/svg", "line");
        sendPath.setAttribute("x1", "22");
        sendPath.setAttribute("y1", "2");
        sendPath.setAttribute("x2", "11");
        sendPath.setAttribute("y2", "13");
        sendIcon.appendChild(sendPath);
        const sendPoly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        sendPoly.setAttribute("points", "22 2 15 22 11 13 2 9 22 2");
        sendIcon.appendChild(sendPoly);
        botLink.appendChild(sendIcon);
        const botLinkText = document.createElement("span");
        botLinkText.textContent = t('tgOpenBot') + " @" + botName;
        botLink.appendChild(botLinkText);
        container.appendChild(botLink);
    }

    // Durum gostergesi
    const statusRow = document.createElement("div");
    statusRow.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px;border-radius:var(--vfs-radius-sm);border:1px solid var(--vfs-border);background:rgba(27,23,49,0.4);margin-bottom:12px;";
    const spinner = document.createElement("div");
    spinner.style.cssText = "width:20px;height:20px;border:2px solid var(--vfs-border);border-top-color:var(--vfs-accent);border-radius:50%;animation:vfs-spin 0.8s linear infinite;flex-shrink:0;";
    const statusText = document.createElement("span");
    statusText.style.cssText = "font-size:13px;color:var(--vfs-text);";
    statusText.textContent = t('tgWaiting');
    statusRow.appendChild(spinner);
    statusRow.appendChild(statusText);
    container.appendChild(statusRow);

    // Polling baslat
    startTgPolling(container.closest(".vfs-glass-card"), statusText, spinner);

    // Geri butonu
    const backBtn = document.createElement("button");
    backBtn.style.cssText = "background:transparent;border:1px solid var(--vfs-border);color:var(--vfs-muted);border-radius:var(--vfs-radius-sm);padding:8px 14px;font-size:12px;cursor:pointer;font-family:var(--vfs-font);transition:all 0.2s;width:100%;";
    backBtn.textContent = t('tgBack');
    backBtn.onclick = () => {
        stopTgPolling();
        setTelegramToken("");
        localStorage.removeItem("vfs_telegram_botname");
        renderTelegramWizard(container.closest(".vfs-glass-card"));
    };
    container.appendChild(backBtn);
}

// Bagli durum
function renderTgConnectedState(container) {
    const botName = localStorage.getItem("vfs_telegram_botname") || "";
    const chatId = getTelegramChatId();

    const statusRow = document.createElement("div");
    statusRow.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px;border-radius:var(--vfs-radius-sm);border:1px solid var(--vfs-success);background:rgba(74,222,128,0.06);margin:12px 0;";
    const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    checkSvg.setAttribute("width", "20");
    checkSvg.setAttribute("height", "20");
    checkSvg.setAttribute("viewBox", "0 0 24 24");
    checkSvg.setAttribute("fill", "none");
    checkSvg.setAttribute("stroke", "#4ade80");
    checkSvg.setAttribute("stroke-width", "2.5");
    checkSvg.setAttribute("stroke-linecap", "round");
    checkSvg.setAttribute("stroke-linejoin", "round");
    const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    checkPath.setAttribute("d", "M22 11.08V12a10 10 0 1 1-5.93-9.14");
    checkSvg.appendChild(checkPath);
    const checkPoly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    checkPoly.setAttribute("points", "22 4 12 14.01 9 11.01");
    checkSvg.appendChild(checkPoly);
    statusRow.appendChild(checkSvg);

    const infoCol = document.createElement("div");
    infoCol.style.cssText = "flex:1;";
    const connLabel = document.createElement("div");
    connLabel.style.cssText = "font-size:13px;font-weight:600;color:var(--vfs-success);";
    connLabel.textContent = t('tgConnected');
    infoCol.appendChild(connLabel);
    if (botName) {
        const botLabel = document.createElement("div");
        botLabel.style.cssText = "font-size:11px;color:var(--vfs-muted);margin-top:2px;";
        botLabel.textContent = "@" + botName + " \u2022 " + chatId;
        infoCol.appendChild(botLabel);
    }
    statusRow.appendChild(infoCol);
    container.appendChild(statusRow);

    // Butonlar
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;";

    // Test butonu
    const testBtn = document.createElement("button");
    testBtn.className = "vfs-add-btn";
    testBtn.style.flex = "1";
    testBtn.textContent = t('tgTestBtn');
    testBtn.onclick = async () => {
        testBtn.textContent = "...";
        testBtn.disabled = true;
        try {
            const res = await fetch("https://api.telegram.org/bot" + getTelegramToken() + "/sendMessage", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    chat_id: getTelegramChatId(),
                    text: "\u2705 <b>VFS Bot Pro</b> - Telegram ba\u011flant\u0131s\u0131 aktif!",
                    parse_mode: "HTML"
                })
            });
            const json = await res.json();
            if (json.ok) {
                showToast({ status: "success", message: t('tgTestSuccess') });
            } else {
                showToast({ status: "error", message: t('tgTestFail'), details: json.description || "" });
            }
        } catch (e) {
            showToast({ status: "error", message: t('tgTestFail'), details: String(e) });
        }
        testBtn.textContent = t('tgTestBtn');
        testBtn.disabled = false;
    };
    btnRow.appendChild(testBtn);

    // Baglanti kes butonu
    const disconnectBtn = document.createElement("button");
    disconnectBtn.style.cssText = "flex:1;background:transparent;border:1px solid var(--vfs-error);color:var(--vfs-error);border-radius:var(--vfs-radius-sm);padding:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--vfs-font);transition:all 0.2s;";
    disconnectBtn.textContent = t('tgDisconnect');
    disconnectBtn.onclick = () => {
        stopTgPolling();
        setTelegramToken("");
        setTelegramChatId("");
        localStorage.removeItem("vfs_telegram_botname");
        showToast({ status: "info", message: t('tgDisconnected') });
        renderTelegramWizard(container.closest(".vfs-glass-card"));
    };
    btnRow.appendChild(disconnectBtn);

    container.appendChild(btnRow);
}

// Polling: getUpdates ile /start mesajini yakala
function startTgPolling(wizardCard, statusTextEl, spinnerEl) {
    stopTgPolling();
    const token = getTelegramToken();
    if (!token) return;

    let offset = 0;
    let attempts = 0;
    const maxAttempts = 60; // 60 x 3sn = 3 dakika

    const poll = async () => {
        if (attempts >= maxAttempts) {
            stopTgPolling();
            if (statusTextEl) {
                statusTextEl.textContent = t('tgTimeout');
                statusTextEl.style.color = "var(--vfs-error)";
            }
            if (spinnerEl) spinnerEl.style.display = "none";
            return;
        }
        attempts++;
        try {
            const url = "https://api.telegram.org/bot" + token + "/getUpdates?timeout=2&offset=" + offset;
            const res = await fetch(url);
            const json = await res.json();
            if (json.ok && json.result && json.result.length > 0) {
                for (const update of json.result) {
                    offset = update.update_id + 1;
                    const msg = update.message;
                    if (msg && msg.chat && msg.chat.id) {
                        // /start veya herhangi bir mesaj geldi
                        const chatId = String(msg.chat.id);
                        const firstName = msg.chat.first_name || "";
                        setTelegramChatId(chatId);
                        stopTgPolling();

                        // Hos geldin mesaji gonder
                        try {
                            await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                    chat_id: chatId,
                                    text: "\u2705 <b>VFS Bot Pro</b> ba\u011fland\u0131!\n\nMerhaba " + firstName + ", art\u0131k t\u00fcm bildirimler buraya gelecek.",
                                    parse_mode: "HTML"
                                })
                            });
                        } catch (_) { }

                        showToast({ status: "congrats", message: t('tgConnectSuccess'), details: firstName + " (ID: " + chatId + ")" });
                        setTelegramEnabled(true);

                        if (wizardCard) renderTelegramWizard(wizardCard);
                        return;
                    }
                }
            }
        } catch (_) { }

        tgPollingTimer = setTimeout(poll, 3000);
    };

    poll();
}

function stopTgPolling() {
    if (tgPollingTimer) {
        clearTimeout(tgPollingTimer);
        tgPollingTimer = null;
    }
}

function updateVisaCategories(cid, centerCode, parentPanel) {
    const config = countryConfig[getSelectedCountry()];
    const allCats = config.visaCategories;
    const filtered = allCats.filter(vc => !vc.centers || vc.centers.includes(centerCode));
    const saved = loadField(cid, 'visaCategoryCode', filtered[0]?.code || "");
    if (!filtered.find(v => v.code === saved) && filtered.length) {
        saveField(cid, 'visaCategoryCode', filtered[0].code);
    }
    const container = parentPanel.querySelector("#vfs-visa-cat-container");
    if (!container) return;
    container.textContent = "";
    const visaField = {
        id: "visaCategoryCode", label: t('visaCategory'), type: "select",
        options: filtered.map(vc => ({ v: vc.code, t: vc.label }))
    };
    const visaVal = loadField(cid, 'visaCategoryCode', filtered[0]?.code || "");
    const visaGroup = createFloatingInput(visaField, visaVal, (v) => saveField(cid, 'visaCategoryCode', v));
    container.appendChild(visaGroup);
}

// Tab 3 - Aile
function renderFamilyTab(cid) {
    const panel = document.createElement("div");

    function renderMembers() {
        const existing = panel.querySelectorAll(".vfs-family-card");
        existing.forEach(e => e.remove());
        const existingBtn = panel.querySelector(".vfs-add-btn");
        if (existingBtn) existingBtn.remove();

        const famArr = loadFamily(cid);
        famArr.forEach((fam, idx) => {
            const card = document.createElement("div");
            card.className = "vfs-family-card";

            const cardHeader = document.createElement("div");
            cardHeader.className = "vfs-family-card-header";
            const cardTitle = document.createElement("span");
            cardTitle.textContent = t('familyMember') + " #" + (idx + 1);
            const rmBtn = document.createElement("button");
            rmBtn.textContent = String.fromCharCode(215);
            rmBtn.onclick = () => {
                const arr = loadFamily(cid);
                arr.splice(idx, 1);
                saveFamily(arr, cid);
                renderMembers();
            };
            cardHeader.appendChild(cardTitle);
            cardHeader.appendChild(rmBtn);
            card.appendChild(cardHeader);

            editableFields.forEach(field => {
                const val = fam[field.id] !== undefined ? fam[field.id] : field.def;
                const group = createFloatingInput(field, val, (v) => {
                    const arr = loadFamily(cid);
                    arr[idx][field.id] = v;
                    saveFamily(arr, cid);
                });
                const inp = group.querySelector("input,select");
                if (inp) inp.id = "vfs-fam-" + idx + "-" + field.id;
                const lbl = group.querySelector("label");
                if (lbl) lbl.htmlFor = "vfs-fam-" + idx + "-" + field.id;
                card.appendChild(group);
            });

            const isChild = fam.isEndorsedChild || false;
            const childToggle = createToggleSwitch("child-" + idx, t('childApplicant'), isChild, (checked) => {
                const arr = loadFamily(cid);
                arr[idx].isEndorsedChild = checked;
                if (checked) {
                    arr[idx].parentPassportNumber = loadField(cid, 'passportNumber', '');
                    arr[idx].parentPassportExpiry = loadField(cid, 'passportExpirtyDate', '');
                } else {
                    arr[idx].parentPassportNumber = "";
                    arr[idx].parentPassportExpiry = "";
                }
                saveFamily(arr, cid);
                renderMembers();
            });
            card.appendChild(childToggle);

            if (isChild) {
                const ppnGroup = createFloatingInput(
                    { id: "parentPassNo-" + idx, label: t('parentPassNo'), type: "text" },
                    fam.parentPassportNumber || loadField(cid, 'passportNumber', ''),
                    (v) => { const arr = loadFamily(cid); arr[idx].parentPassportNumber = v; saveFamily(arr, cid); }
                );
                const ppeGroup = createFloatingInput(
                    { id: "parentPassExp-" + idx, label: t('parentPassExp'), type: "date" },
                    fam.parentPassportExpiry || loadField(cid, 'passportExpirtyDate', ''),
                    (v) => { const arr = loadFamily(cid); arr[idx].parentPassportExpiry = v; saveFamily(arr, cid); }
                );
                card.appendChild(ppnGroup);
                card.appendChild(ppeGroup);
            }

            panel.appendChild(card);
        });

        const addBtn = document.createElement("button");
        addBtn.className = "vfs-add-btn";
        addBtn.textContent = t('addFamily');
        addBtn.onclick = () => {
            const arr = loadFamily(cid);
            const newMem = {};
            editableFields.forEach(f => { newMem[f.id] = f.def; });
            newMem.isEndorsedChild = false;
            newMem.parentPassportNumber = loadField(cid, 'passportNumber', '');
            newMem.parentPassportExpiry = loadField(cid, 'passportExpirtyDate', '');
            arr.push(newMem);
            saveFamily(arr, cid);
            renderMembers();
        };
        panel.appendChild(addBtn);
    }

    renderMembers();
    return panel;
}

// Tab 4 - Kontrol
function renderControlTab(cid) {
    const panel = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "vfs-action-grid";

    const rocketSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    const searchSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    const calSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const boltSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';

    const autoBookBtn = createActionButton(rocketSvg, t('actionAutoBook'),
        async () => { await doBookingTurkeyAutoFirstSlot(); }, true);
    grid.appendChild(autoBookBtn);

    const checkOn = loadCheckSlot(cid);
    const checkSlotBtn = createActionButton(searchSvg, t('actionCheckSlot'),
        async () => {
            const current = loadCheckSlot(cid);
            const next = !current;
            checkSlotBtn.classList.toggle("active", next);
            updateCheckSlotToggleUI(next);
            await handleCheckSlotAvailable(next);
        }, false);
    if (checkOn) checkSlotBtn.classList.add("active");
    grid.appendChild(checkSlotBtn);

    const manualOn = localStorage.getItem("vfs_manual_timeslot_pick") === "1";
    const manualBtn = createActionButton(calSvg, t('actionManualPick'),
        () => {
            const current = localStorage.getItem("vfs_manual_timeslot_pick") === "1";
            localStorage.setItem("vfs_manual_timeslot_pick", current ? "0" : "1");
            manualBtn.classList.toggle("active", !current);
        }, false);
    if (manualOn) manualBtn.classList.add("active");
    grid.appendChild(manualBtn);

    const turboOn = localStorage.getItem("vfs_turbo_mode") === "1";
    const turboBtn = createActionButton(boltSvg, t('actionTurboMode'),
        () => {
            const current = localStorage.getItem("vfs_turbo_mode") === "1";
            localStorage.setItem("vfs_turbo_mode", current ? "0" : "1");
            turboBtn.classList.toggle("active", !current);
        }, false);
    if (turboOn) turboBtn.classList.add("active");
    grid.appendChild(turboBtn);

    panel.appendChild(grid);

    // Bekleme Listesi Karti
    const wlContent = document.createElement("div");
    const schedRow = document.createElement("div");
    schedRow.style.display = "flex";
    schedRow.style.alignItems = "center";
    schedRow.style.gap = "8px";
    schedRow.style.marginBottom = "10px";

    const schedTime = document.createElement("input");
    schedTime.type = "time";
    schedTime.step = "1";
    schedTime.style.cssText = "flex:1;padding:8px 10px;border-radius:var(--vfs-radius-sm);border:1px solid var(--vfs-border);background:#1b1731;color:var(--vfs-text);font-family:var(--vfs-font);font-size:13px;outline:none;";
    schedTime.value = loadField(cid, 'waitlistSchedTime', "");
    schedTime.onchange = () => saveField(cid, 'waitlistSchedTime', schedTime.value);

    const armBtn = document.createElement("button");
    armBtn.textContent = t('schedulerSet');
    armBtn.style.cssText = "padding:8px 14px;border-radius:var(--vfs-radius-sm);border:none;background:var(--vfs-gradient);color:#0c0a18;font-weight:700;cursor:pointer;font-family:var(--vfs-font);font-size:13px;";
    armBtn.onclick = () => {
        if (!schedTime.value) { showToast({ status: "warn", message: t('schedulerWarn'), details: "HH:MM:SS" }); return; }
        saveField(cid, 'waitlistSchedOn', "1");
        saveField(cid, 'waitlistSchedTime', schedTime.value);
        const cfg = countryConfig[getSelectedCountry()];
        armWaitlistTimer(cid, loadField(cid, 'centerCode', cfg.centers[0].code), loadField(cid, 'visaCategoryCode', cfg.visaCategories[0].code));
        showToast({ status: "info", message: t('scheduledMsg'), details: schedTime.value });
    };

    schedRow.appendChild(schedTime);
    schedRow.appendChild(armBtn);
    wlContent.appendChild(schedRow);

    const retryToggle = createToggleSwitch("retry", t('retryLabel'),
        loadField(cid, 'waitlistRetry', "0") === "1",
        (v) => saveField(cid, 'waitlistRetry', v ? "1" : "0"));
    wlContent.appendChild(retryToggle);

    const turboWlToggle = createToggleSwitch("turbo-wl", t('turboLabel'),
        loadField(cid, 'waitlistTurbo', "0") === "1",
        (v) => saveField(cid, 'waitlistTurbo', v ? "1" : "0"));
    wlContent.appendChild(turboWlToggle);

    const wlCard = createGlassCard(t('waitlistCard'), wlContent);
    panel.appendChild(wlCard);

    return panel;
}

// Geriye uyumluluk
function showClientPanel() { createSidebar(); }

// Başvuran mantığı: Türkiye -> Hollanda kodları
function getApplicantPayloadFields(cid) {
    let info = {};
    for (let f of editableFields) {
        info[f.id] = loadField(cid, f.id, f.def);
        if (f.type === "select" && typeof f.def === "number") info[f.id] = Number(info[f.id]);
    }
    info.dateOfBirth = info.dateOfBirth ? formatDateForPayload(info.dateOfBirth) : null;
    info.passportExpirtyDate = info.passportExpirtyDate ? formatDateForPayload(info.passportExpirtyDate) : null;
    info.isEndorsedChild = false;
    return info;
}
function getFullApplicantList(cid) {
    const info = getApplicantPayloadFields(cid);
    let famArr = loadFamily(cid);
    let metaFields = {
        centerCode: loadField(cid, 'centerCode', ''),
        countryCode: loadField(cid, 'countryCode', 'tur'),
        missionCode: loadField(cid, 'missionCode', ''),
        loginUser: loadField(cid, 'emailId', ''),
        regionCode: null,
        juridictionCode: null,
        isEdit: false,
        languageCode: "en-US",
        visaCategoryCode: loadField(cid, 'visaCategoryCode', ''),
        isWaitlist: false // akışta ayarlanacak
    };
    function buildApplicantObject(base, isWaitlist) {
        let obj = {
            urn: "", arn: "", centerClassCode: "", selectedSubvisaCategory: "", Subclasscode: "",
            AdditionalRefNo: null, OfflineCClink: "", PVCanAllowRetry: true, PVRequestRefNumber: "", PVStatus: "", PVStatusDescription: "", PVisVerified: false, Retryleft: "", SpecialAssistance: "", Subclasscode: "", VisaToken: null, addressline1: null, addressline2: null, applicantGroupId: 0, applicantType: 0, arn: "", canDeleteVAF: false, canDownloadVAF: false, canEditVAF: false, canInitiateVAF: false, centerClassCode: "", city: null, confirmPassportNumber: null, contactNumber: base.contactNumber || "", dateOfApplication: "", dateOfBirth: base.dateOfBirth || null, dateOfDeparture: null, dialCode: base.dialCode || "90", eefRegistrationNumber: "", emailId: base.emailId || "", employerContactNumber: "", employerDialCode: "", employerEmailId: "", employerFirstName: "", employerLastName: "", entryType: "", eoiVisaType: "", familyReunificationCerificateNumber: "", firstName: base.firstName || "", gender: base.gender || null, helloVerifyNumber: "", idenfystatuscheck: false, ipAddress: base.ipAddress || "108.165.227.20", isAutoRefresh: true, isEndorsedChild: !!base.isEndorsedChild, juridictionCode: "", lastName: base.lastName || "", loginUser: metaFields.loginUser, middleName: "", nationalId: null, nationalityCode: base.nationalityCode || "TUR", parentPassportExpiry: base.isEndorsedChild ? (base.parentPassportExpiry || info.passportExpirtyDate || "") : "", parentPassportNumber: base.isEndorsedChild ? (base.parentPassportNumber || info.passportNumber || "") : "", passportExpirtyDate: base.passportExpirtyDate || null, passportNumber: base.passportNumber || "", passportType: "", pincode: null, referenceNumber: null, salutation: "", selectedSubvisaCategory: "", state: null, urn: "", vafStatus: null, vfsReferenceNumber: "", vlnNumber: null,
            centerCode: metaFields.centerCode,
            countryCode: metaFields.countryCode,
            missionCode: metaFields.missionCode,
            loginUser: metaFields.loginUser,
            regionCode: metaFields.regionCode,
            visaCategoryCode: metaFields.visaCategoryCode,
            isEdit: metaFields.isEdit,
            isWaitlist: isWaitlist,
            languageCode: metaFields.languageCode
        };
        return obj;
    }
    let isWaitlist = isWaitlistCategory(metaFields.visaCategoryCode, metaFields.centerCode);
    let mainApplicant = buildApplicantObject(info, isWaitlist);
    let formattedFam = famArr.map(mem => buildApplicantObject(mem, isWaitlist));
    return [mainApplicant, ...formattedFam];
}

// Ödeme yönlendirme (PayFort)
function manualPaymentLink(url) {
    let panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.left = "50%";
    panel.style.top = "35%";
    panel.style.transform = "translate(-50%,-50%)";
    panel.style.zIndex = "999999";
    panel.style.background = "#fce9ed";
    panel.style.border = "3px solid #c9062c";
    panel.style.borderRadius = "18px";
    panel.style.boxShadow = "0 6px 40px #2226";
    panel.style.padding = "28px 32px";
    panel.style.fontSize = "19px";
    panel.innerHTML = `<span style="font-size:2em;">🚨</span> <b>Ödeme sayfası otomatik algılanamadı!<br/><br/>Lütfen <a href="${url}" style="color:#c41c32;font-weight:bold;font-size:1.2em" target="_blank">ÖDEMEYE DEVAM ETMEK İÇİN TIKLAYIN</a></b>`;
    document.body.appendChild(panel);
    setTimeout(() => { panel.remove(); }, 18000);
}

// --- Randevu Müsaitlik Kontrolü mantığı (paylaşılan, panel dışı) ---
async function handleCheckSlotAvailable(checked) {
    const cid = getSelectedClientId();
    saveCheckSlot(cid, checked);
    if (!checked) return;
    const config = countryConfig[getSelectedCountry()];
    const centerCode = loadField(cid, 'centerCode', config.centers[0].code);
    const visaCategoryCode = loadField(cid, 'visaCategoryCode', config.visaCategories[0].code);
    const loginUser = loadField(cid, 'emailId', '');
    if (!lastAuthorize || !lastClientSource) {
        showToast({ status: 'error', message: 'Token eksik! VFS sayfasını yenileyin.' });
        return;
    }
    if (!centerCode || !visaCategoryCode || !loginUser) {
        showToast({ status: 'error', message: 'Tüm başvuran/merkez/kategori alanlarını doldurun.' });
        return;
    }
    let payload = {
        countryCode: config.countryCode,
        missionCode: config.missionCode,
        vacCode: centerCode,
        visaCategoryCode: visaCategoryCode,
        roleName: 'Individual',
        loginUser: loginUser,
        payCode: ''
    };
    showToast({ status: 'wait', message: 'Randevu müsaitliği kontrol ediliyor...' });
    try {
        let res = await fetch('https://lift-api.vfsglobal.com/appointment/CheckIsSlotAvailable', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json;charset=UTF-8',
                'authorize': lastAuthorize,
                'clientsource': lastClientSource,
                'origin': 'https://visa.vfsglobal.com'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        let data = await res.json();
        if (data.earliestDate && data.earliestSlotLists && data.earliestSlotLists.length > 0) {
            let dateStr = data.earliestSlotLists[0].date.split(' ')[0];
            let [mm, dd, yyyy] = dateStr.split('/');
            let isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
            saveCalendarDates([isoDate], cid);
            showToast({ status: 'success', message: 'Randevu bulundu!', details: `Tarih: ${isoDate}` });
            sendTelegram("slot_found", { date: isoDate, countryLabel: config.label, centerName: centerCode, visaLabel: visaCategoryCode });
        } else if (data.error && data.error.description && data.error.description.toLowerCase() === "waitlist") {
            showToast({ status: 'info', message: t('waitlistOpen'), details: '' });
        } else {
            showToast({ status: 'error', message: 'Müsait randevu yok.' });
            saveCheckSlot(cid, false);
            updateCheckSlotToggleUI(false);
        }
    } catch (e) {
        showToast({ status: 'error', message: 'Randevu kontrolü başarısız', details: e + '' });
        saveCheckSlot(cid, false);
        updateCheckSlotToggleUI(false);
    }
}


async function tryPaymentRedirectFinal(schedRes, schedText, candidateManual) {
    let schedJson = {}; let manualUrl = candidateManual || '';
    try { schedJson = JSON.parse(schedText); } catch (e) { }
    if (schedJson && schedJson.IsPaymentRequired && schedJson.URL && schedJson.payLoad) {
        window.location.href = schedJson.URL + "?payLoad=" + encodeURIComponent(schedJson.payLoad); return true;
    }
    let payFortMatch = schedText.match(/https:\/\/checkout\.payfort\.com\/FortAPI\/paymentPage[^"'<>\s]*/);
    if (payFortMatch) {
        manualUrl = payFortMatch[0];
        window.location.href = manualUrl;
        return true;
    }
    let payRequestMatch = schedText.match(/\/PG-Component\/Payment\/PayRequest\?payLoad=([^"'<>\s]*)/);
    if (payRequestMatch) {
        manualUrl = "https://online.vfsglobal.com" + payRequestMatch[0];
        window.location.href = manualUrl; return true;
    }
    let cmiMatch = schedText.match(/\/PG-Component\/Payment\/CMI\?initiateResult=([^"'<>\s]*)/);
    if (cmiMatch) {
        manualUrl = "https://online.vfsglobal.com" + cmiMatch[0];
        window.location.href = manualUrl; return true;
    }
    let nestPayMatch = schedText.match(/\/PG-Component\/Payment\/NESTPAY\?initiateResult=([^"'<>\s]*)/);
    if (nestPayMatch) {
        manualUrl = "https://online.vfsglobal.com" + nestPayMatch[0];
        window.location.href = manualUrl; return true;
    }
    let loc = schedRes.headers && schedRes.headers.get && schedRes.headers.get("Location");
    if (loc && (/PayRequest\?payLoad=/.test(loc) || /CMI\?initiateResult=/.test(loc) || /NESTPAY\?initiateResult=/.test(loc))) {
        manualUrl = loc.startsWith("http") ? loc : ("https://online.vfsglobal.com" + loc);
        window.location.href = manualUrl; return true;
    }
    if (manualUrl) { manualPaymentLink(manualUrl); }
    return false;
}

// == Aile/grup randevu mantığı: slots.length > 0 ise HERHANGİ bir randevuyu kabul et (Mısır için kapasite filtrelemesi yok!) ==
async function doBookingTurkeyAutoFirstSlot() {
    // Her zaman seçili müşteri bağlamını kullan
    const cid = getSelectedClientId();
    let info = getApplicantPayloadFields(cid);
    let applicantList = getFullApplicantList(cid);
    const config = countryConfig[getSelectedCountry()];
    let centerCode = loadField(cid, 'centerCode', config.centers[0].code);
    let visaCategoryCode = loadField(cid, 'visaCategoryCode', config.visaCategories[0].code);
    let loginUser = info.emailId;
    let applicantCount = applicantList.length;
    const isWaitlistFlow = isWaitlistCategory(visaCategoryCode, centerCode) && isWaitlistCenter(centerCode);
    if (!lastAuthorize || !lastClientSource) {
        showToast({ status: "error", message: "Token eksik! VFS sayfasını yenileyin." }); return;
    }
    if (!loginUser || !centerCode || !visaCategoryCode) {
        showToast({ status: "error", message: "Tüm başvuran/merkez/kategori alanlarını doldurun." }); return;
    }
    // Bekleme listesi akışı (takvim/randevu taraması yok)
    if (isWaitlistFlow) {
        const waitlistRetry = loadField(cid, 'waitlistRetry', "0") === "1";
        const waitlistTurbo = loadField(cid, 'waitlistTurbo', "0") === "1";
        const waitlistSchedOn = loadField(cid, 'waitlistSchedOn', "0") === "1";
        const waitlistSchedTime = loadField(cid, 'waitlistSchedTime', "");

        // Tam bekleme listesi akışı: başvuranlar, ardından URN varsa hemen onayla
        const runWaitlistFlow = async () => {
            showToast({ status: "wait", message: "Bekleme listesi akışı...", details: `Merkez ${centerCode}` });
            sendTelegram("bot_started", { countryLabel: config.label, centerName: centerCode, visaLabel: visaCategoryCode, message: "Bekleme listesi akışı başlatıldı", applicants: applicantList });
            const waitlistPayload = {
                countryCode: config.countryCode,
                missionCode: config.missionCode,
                centerCode,
                loginUser,
                visaCategoryCode,
                isEdit: false,
                applicantList,
                languageCode: "en-US",
                isWaitlist: true,
                juridictionCode: null,
                regionCode: null
            };
            // Başvuran isteği gönderme yardımcısı
            const sendApplicantOnce = async () => {
                let applicantTxt = "", applicantJson = {};
                try {
                    const applicantRes = await fetch("https://lift-api.vfsglobal.com/appointment/applicants", {
                        method: "POST",
                        headers: {
                            "accept": "application/json, text/plain, */*",
                            "content-type": "application/json;charset=UTF-8",
                            "authorize": lastAuthorize,
                            "clientsource": lastClientSource,
                            "origin": "https://visa.vfsglobal.com"
                        },
                        credentials: "include",
                        body: JSON.stringify(waitlistPayload)
                    });
                    applicantTxt = await applicantRes.text();
                    try { applicantJson = JSON.parse(applicantTxt); } catch (_) { applicantJson = {}; }
                    const urn = applicantJson.urn || (applicantJson.data && applicantJson.data.urn);
                    return { urn, applicantTxt, applicantJson };
                } catch (err) {
                    return { urn: null, applicantTxt, applicantJson };
                }
            };
            let urn = null, applicantTxt = "", applicantJson = {};
            let confirmed = false;
            // Bekleme listesi onaylama yardımcısı
            const confirmWaitlist = async (urnVal, applicantTxtVal, applicantJsonVal) => {
                if (confirmed) return; // Çift onaylamayı engelle
                confirmed = true;
                const confirmPayload = {
                    missionCode: config.missionCode,
                    countryCode: config.countryCode,
                    centerCode,
                    loginUser,
                    urn: urnVal,
                    aurn: null,
                    notificationType: "none",
                    CanVFSReachoutToApplicant: true,
                    TnCConsentAndAcceptance: true,
                    languageCode: "en-US"
                };
                try {
                    const confirmRes = await fetch("https://lift-api.vfsglobal.com/appointment/ConfirmWaitlist", {
                        method: "POST",
                        headers: {
                            "accept": "application/json, text/plain, */*",
                            "content-type": "application/json;charset=UTF-8",
                            "authorize": lastAuthorize,
                            "clientsource": lastClientSource,
                            "origin": "https://visa.vfsglobal.com"
                        },
                        credentials: "include",
                        body: JSON.stringify(confirmPayload)
                    });
                    const confirmTxt = await confirmRes.text();
                    let confirmJson = {};
                    try { confirmJson = JSON.parse(confirmTxt); } catch (_) { confirmJson = {}; }
                    const waitNo = confirmJson.waitListNumber || confirmJson.waitlistNumber || confirmJson.WaitlistNumber || confirmJson.referenceNumber || "";
                    showToast({ status: "congrats", message: "Bekleme listesi talebi onaylandı!", details: waitNo ? `Referans: ${waitNo}` : "Onay alındı" });
                    sendTelegram("waitlist_confirmed", { countryLabel: config.label, centerName: (config.centers.find(c => c.code === centerCode) || {}).name, visaLabel: (config.visaCategories.find(v => v.code === visaCategoryCode) || {}).label, waitlistRef: waitNo, applicants: applicantList });
                } catch (err) {
                    showToast({ status: "error", message: "Bekleme listesi onay hatası", details: err ? err.message : "" });
                    sendTelegram("error", { message: "Bekleme listesi onay hatası", error: err ? err.message : "" });
                }
            };
            if (waitlistTurbo) {
                // 3 başvuran isteğini anında paralel olarak gönder, herhangi biri URN döndürürse hemen onayla
                await new Promise(resolve => {
                    let done = false; let completed = 0; let lastRes = null;
                    const handle = async (res) => {
                        completed++;
                        lastRes = res || lastRes;
                        if (done) return;
                        if (res && res.urn) {
                            done = true;
                            urn = res.urn; applicantTxt = res.applicantTxt; applicantJson = res.applicantJson;
                            await confirmWaitlist(urn, applicantTxt, applicantJson);
                            return resolve();
                        }
                        if (completed >= 3) {
                            done = true;
                            if (lastRes && lastRes.urn) {
                                urn = lastRes.urn; applicantTxt = lastRes.applicantTxt; applicantJson = lastRes.applicantJson;
                                await confirmWaitlist(urn, applicantTxt, applicantJson);
                            } else {
                                showToast({ status: "error", message: "Bekleme listesi URN eksik", details: lastRes ? lastRes.applicantTxt : "Girişleri kontrol edin." });
                            }
                            return resolve();
                        }
                    };
                    // 3 isteği anında gönder
                    sendApplicantOnce().then(handle);
                    sendApplicantOnce().then(handle);
                    sendApplicantOnce().then(handle);
                });
            } else {
                // 3 kez tekrar dene, herhangi biri URN döndürürse hemen onayla, denemeler arası gecikme yok
                const attempts = waitlistRetry ? 3 : 1;
                for (let i = 0; i < attempts; i++) {
                    const res = await sendApplicantOnce();
                    if (res && res.urn) {
                        urn = res.urn; applicantTxt = res.applicantTxt; applicantJson = res.applicantJson;
                        await confirmWaitlist(urn, applicantTxt, applicantJson);
                        break;
                    }
                    // Maksimum hız için tekrar denemeler arası gecikme yok
                }
                if (!urn) {
                    showToast({ status: "error", message: "Bekleme listesi URN eksik", details: applicantTxt || "Girişleri kontrol edin." });
                }
            }
            return;
        };
        // Zamanlanmış ise akışın başlangıcını geciktir, ancak onay başvuranlardan sonra her zaman anında yapılır
        if (waitlistSchedOn && waitlistSchedTime) {
            const now = new Date();
            const [hh, mm, ssRaw] = waitlistSchedTime.split(":");
            const schedDate = new Date();
            schedDate.setHours(Number(hh) || 0, Number(mm) || 0, Number(ssRaw) || 0, 0);
            const delay = schedDate.getTime() - now.getTime();
            if (delay > 500) {
                showToast({ status: "info", message: "Planlandı", details: `${waitlistSchedTime} saatinde çalışacak` });
                sendTelegram("scheduled", { message: waitlistSchedTime + " saatinde çalışacak", countryLabel: config.label });
                setTimeout(runWaitlistFlow, delay);
                return;
            }
        }
        await runWaitlistFlow();
        return;
    }
    // 1. Önce başvuran isteğini gönder
    showToast({ status: "wait", message: `1: Başvuran(lar) gönderiliyor...`, details: `Türkiye ${config.label} aile/grup` });
    sendTelegram("bot_started", { countryLabel: config.label, centerName: (config.centers.find(c => c.code === centerCode) || {}).name, visaLabel: (config.visaCategories.find(v => v.code === visaCategoryCode) || {}).label, applicants: applicantList });
    const applicantsPayload = {
        countryCode: config.countryCode,
        missionCode: config.missionCode,
        centerCode,
        loginUser,
        visaCategoryCode,
        isEdit: false,
        applicantList: applicantList.map(x => {
            // Varsayılanları birleştir, sonra temizle
            let merged = Object.assign({
                urn: "", arn: "", employerFirstName: "", middleName: "",
                employerLastName: "", salutation: "", nationalId: null, VisaToken: null, employerContactNumber: "",
                dialCode: "90", employerDialCode: "", employerEmailId: "", state: null, city: null, addressline1: null,
                addressline2: null, pincode: null, referenceNumber: null, vlnNumber: null, applicantGroupId: 0,
                parentPassportNumber: x.isEndorsedChild ? x.parentPassportNumber || "" : "",
                parentPassportExpiry: x.isEndorsedChild ? x.parentPassportExpiry || "" : "",
                dateOfDeparture: null, entryType: "", eoiVisaType: "", passportType: "", vfsReferenceNumber: "",
                familyReunificationCerificateNumber: "", PVRequestRefNumber: "", PVStatus: "", PVStatusDescription: "",
                PVCanAllowRetry: true, PVisVerified: false, eefRegistrationNumber: "", isAutoRefresh: true,
                helloVerifyNumber: "", OfflineCClink: "", idenfystatuscheck: false, vafStatus: null, SpecialAssistance: "",
                AdditionalRefNo: null, canInitiateVAF: false, canEditVAF: false, canDeleteVAF: false,
                canDownloadVAF: false, Retryleft: "", ipAddress: "41.96.162.118", nationalityCode: "TUR", isEndorsedChild: !!x.isEndorsedChild,
                centerClassCode: "", selectedSubvisaCategory: "", Subclasscode: "", applicantType: 0,
                city: null, confirmPassportNumber: null, dateOfApplication: "", eefRegistrationNumber: "", entryType: "", familyReunificationCerificateNumber: "", gender: x.gender || null, helloVerifyNumber: "", isEndorsedChild: !!x.isEndorsedChild, juridictionCode: "", lastName: x.lastName || "", loginUser: loginUser, middleName: "", nationalId: null, nationalityCode: x.nationalityCode || "TUR", parentPassportExpiry: "", parentPassportNumber: "", passportExpirtyDate: x.passportExpirtyDate || "", passportNumber: x.passportNumber || "", passportType: "", pincode: null, referenceNumber: null, salutation: "", selectedSubvisaCategory: "", state: null, urn: "", vafStatus: null, vfsReferenceNumber: "", vlnNumber: null,
                centerCode: centerCode,
                countryCode: config.countryCode,
                missionCode: config.missionCode,
                loginUser: loginUser,
                regionCode: null,
                visaCategoryCode: visaCategoryCode,
                isEdit: false,
                isWaitlist: isWaitlistCategory(visaCategoryCode, centerCode),
                languageCode: "en-US"
            }, x);
            // Birleştirilmiş nesneyi temizle (yalnızca null/undefined alanları kaldır, tüm meta alanları koru)
            let cleaned = {};
            Object.keys(merged).forEach(k => {
                if (merged[k] !== undefined) cleaned[k] = merged[k];
            });
            return cleaned;
        }),
        languageCode: "en-US",
        isWaitlist: isWaitlistCategory(visaCategoryCode, centerCode),
        juridictionCode: null,
        regionCode: null
    };
    let urn, applicantJson;
    try {
        let applicantRes = await fetch("https://lift-api.vfsglobal.com/appointment/applicants", {
            method: "POST",
            headers: {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json;charset=UTF-8",
                "authorize": lastAuthorize,
                "clientsource": lastClientSource,
                "origin": "https://visa.vfsglobal.com"
            },
            credentials: "include",
            body: JSON.stringify(applicantsPayload)
        });
        applicantJson = await applicantRes.json();
        urn = applicantJson.urn;
        showToast({
            status: applicantJson.error ? "error" : "success",
            message: `Başvuran İsteği: ${applicantRes.status} ${applicantRes.statusText}`,
            details: applicantJson.error ? (applicantJson.error.description || JSON.stringify(applicantJson.error)) : ("URN: " + urn)
        });
        if (!urn) throw new Error("URN eksik: " + JSON.stringify(applicantJson));
    } catch (err) {
        showToast({ status: "error", message: "Başvuran hatası", details: (err ? err.message : "Girişleri ve token'ları kontrol edin!") + " " + (applicantJson && JSON.stringify(applicantJson) || "") }); return;
    }

    // 2. Seçili aylar için takvim isteklerini paralel olarak gönder (ultra hızlı)
    const monthKey = `vfs_turkiye_${getSelectedCountry()}_months_${cid}`;
    let monthsToCheck = [];
    try { monthsToCheck = JSON.parse(localStorage.getItem(monthKey) || "[]"); } catch { monthsToCheck = []; }
    if (!monthsToCheck.length) {
        let d = new Date();
        monthsToCheck = [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`];
    }
    showToast({ status: 'wait', message: '2: Takvimden müsait tarihler alınıyor...', details: `Kontrol edilen: ${monthsToCheck.join(', ')}` });
    // Her ay için tüm olası fromDate formatlarını dene
    let calendarPayloads = [];
    monthsToCheck.forEach(mval => {
        let [year, month] = mval.split('-');
        let mm = String(month).padStart(2, '0');
        let yyyy = String(year);
        // 1. 01/MM/YYYY
        calendarPayloads.push({
            countryCode: config.countryCode,
            missionCode: config.missionCode,
            centerCode,
            loginUser,
            visaCategoryCode,
            fromDate: `01/${mm}/${yyyy}`,
            urn: urn,
            payCode: ""
        });
        // 2. YYYY-MM-01
        calendarPayloads.push({
            countryCode: config.countryCode,
            missionCode: config.missionCode,
            centerCode,
            loginUser,
            visaCategoryCode,
            fromDate: `${yyyy}-${mm}-01`,
            urn: urn,
            payCode: ""
        });
        // 3. YYYY/MM/01
        calendarPayloads.push({
            countryCode: config.countryCode,
            missionCode: config.missionCode,
            centerCode,
            loginUser,
            visaCategoryCode,
            fromDate: `${yyyy}/${mm}/01`,
            urn: urn,
            payCode: ""
        });
    });
    // Tüm formatlar için paralel takvim istekleri
    let calendarPromises = calendarPayloads.map(payload =>
        fetch('https://lift-api.vfsglobal.com/appointment/calendar', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json;charset=UTF-8',
                'authorize': lastAuthorize,
                'clientsource': lastClientSource,
                'origin': 'https://visa.vfsglobal.com'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        }).then(r => r.json()).catch(() => null)
    );
    let calendarResults = await Promise.all(calendarPromises);
    // Takvim istek sonuçlarını yazdır
    calendarResults.forEach((calData, idx) => {
        let status = calData && calData.error ? "error" : "success";
        let msg = `Takvim İsteği [${idx + 1}]: ` + (calData && calData.error && calData.error.description ? calData.error.description : "OK");
        showToast({ status, message: msg, details: JSON.stringify(calData && calData.error ? calData.error : { status: "OK" }) });
    });
    // Takvim dizisinden tüm benzersiz müsait tarihleri topla (tekrarları kaldır)
    const dateSet = new Set();
    for (let calData of calendarResults) {
        if (calData && Array.isArray(calData.calendars)) {
            for (const c of calData.calendars) {
                if (c && c.date) {
                    let [mm, dd, yyyy] = c.date.split('/');
                    let isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                    dateSet.add(isoDate);
                }
            }
        }
    }
    let availableDates = Array.from(dateSet);
    if (!availableDates.length) {
        showToast({ status: 'error', message: 'Müsait tarih bulunamadı!' });
        return;
    }
    // Tarihleri mantık için sırala
    availableDates.sort();
    saveCalendarDates(availableDates, cid);
    let selectedDates = availableDates;
    showToast({ status: 'success', message: 'Müsait tarihler belirlendi!', details: `Tarihler: ${availableDates.join(', ')}` });

    // 3. Her zaman önce son müsait tarihi dene, sonra ortadakini, gerekirse diğerlerini
    let manualPick = localStorage.getItem("vfs_manual_timeslot_pick") === "1";
    const turboMode = localStorage.getItem("vfs_turbo_mode") === "1";
    if (!selectedDates.length) {
        showToast({ status: "error", message: "Saat dilimi kontrol edilecek müsait tarih yok." });
        return;
    }

    async function tryBookOnDate(dateIdxList) {
        for (let idx of dateIdxList) {
            let dateToTry = selectedDates[idx];
            let slotDate = formatDateForPayload(dateToTry);
            let timeslotPayload = {
                countryCode: config.countryCode, missionCode: config.missionCode, centerCode, loginUser, visaCategoryCode, slotDate, urn
            };
            let timeslotRes = null;
            try {
                let resp = await fetch("https://lift-api.vfsglobal.com/appointment/timeslot", {
                    method: "POST",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "content-type": "application/json;charset=UTF-8",
                        "authorize": lastAuthorize,
                        "clientsource": lastClientSource,
                        "origin": "https://visa.vfsglobal.com"
                    },
                    credentials: "include",
                    body: JSON.stringify(timeslotPayload)
                });
                timeslotRes = await resp.json();
            } catch (e) {
                showToast({ status: "error", message: "Saat dilimleri alınamadı.", details: e + '' });
                continue;
            }
            let slots = (timeslotRes && timeslotRes.slots) ? timeslotRes.slots : [];
            if (!slots.length) {
                showToast({ status: "error", message: "Bu tarih için randevu bulunamadı.", details: `Tarih: ${dateToTry}` });
                continue;
            }
            let foundSlot = slots[0];
            let feeAmount = foundSlot.feeAmount || 1313, currency = foundSlot.currency || "TRY";
            let schedulePayload = {
                missionCode: config.missionCode, countryCode: config.countryCode, centerCode,
                loginUser, urn, aurn: null, notificationType: "none",
                paymentdetails: {
                    paymentmode: "Online", RequestRefNo: "", clientId: "", merchantId: "",
                    amount: feeAmount, currency
                },
                allocationId: foundSlot.allocationId,
                CanVFSReachoutToApplicant: true,
                TnCConsentAndAcceptance: true
            };
            showToast({ status: "wait", message: `3: Randevu Alınıyor (${dateToTry})...`, details: "Randevu alınıyor ve ödemeye yönlendiriliyor..." });
            try {
                let schedRes = await fetch("https://lift-api.vfsglobal.com/appointment/schedule", {
                    method: "POST",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "content-type": "application/json;charset=UTF-8",
                        "authorize": lastAuthorize,
                        "clientsource": lastClientSource,
                        "origin": "https://visa.vfsglobal.com"
                    },
                    credentials: "include",
                    body: JSON.stringify(schedulePayload)
                });
                let schedText = await schedRes.clone().text();
                let schedJson = null;
                try { schedJson = JSON.parse(schedText); } catch (_) { }
                let retryMsg = "please";
                if (schedText && schedText.toLowerCase().includes(retryMsg)) {
                    // Olumsuz yanıt, sonraki tarihi dene
                    showToast({ status: "error", message: "Randevu başkası tarafından alındı!", details: "Başka tarih deneniyor..." });
                    continue;
                } else {
                    sendTelegram("booking_confirmed", { countryLabel: config.label, centerName: (config.centers.find(c => c.code === centerCode) || {}).name, visaLabel: (config.visaCategories.find(v => v.code === visaCategoryCode) || {}).label, date: dateToTry, slot: foundSlot.slot || foundSlot.slotDate, fee: feeAmount, currency, applicants: applicantList });
                    const noPaymentNeeded = (schedJson && schedJson.IsPaymentRequired === false);
                    if (noPaymentNeeded) {
                        showToast({ status: "congrats", message: "Randevu alındı (online ödeme yok)", details: "VFS'de randevu özetinizi kontrol edin." });
                        return true;
                    }
                    showToast({ status: "congrats", message: "ÖDEMEYE YÖNLENDİRİLİYOR!", details: "PayFort ödeme sayfası bekleniyor..." });
                    sendTelegram("payment_redirect", { countryLabel: config.label, date: dateToTry, message: "Ödeme sayfasına yönlendiriliyor" });
                    await tryPaymentRedirectFinal(schedRes, schedText, "");
                    return true;
                }
            } catch (err) {
                showToast({ status: "error", message: "Planlama hatası", details: (err ? err.message : "") });
                continue;
            }
        }
        return false;
    }

    if (!manualPick) {
        // Turbo ham hız için tekrar denemeleri atlar (yalnızca son müsait tarih)
        if (turboMode) {
            await tryBookOnDate([selectedDates.length - 1]);
        } else {
            let idxLast = selectedDates.length - 1;
            let idxMid = Math.floor(selectedDates.length / 2);
            let idxFirst = 0;
            let idxOrder = [idxLast];
            if (idxMid !== idxLast && idxMid !== idxFirst) idxOrder.push(idxMid);
            if (idxFirst !== idxLast) idxOrder.push(idxFirst);
            for (let i = 0; i < selectedDates.length; ++i) {
                if (!idxOrder.includes(i)) idxOrder.push(i);
            }
            await tryBookOnDate(idxOrder);
        }
    } else {
        // Manuel randevu seçiciyi YALNIZCA son müsait tarih için göster
        let lastDate = selectedDates[selectedDates.length - 1];
        let slotDate = formatDateForPayload(lastDate);
        let timeslotPayload = {
            countryCode: config.countryCode, missionCode: config.missionCode, centerCode, loginUser, visaCategoryCode, slotDate, urn
        };
        let timeslotRes = null;
        try {
            let resp = await fetch("https://lift-api.vfsglobal.com/appointment/timeslot", {
                method: "POST",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json;charset=UTF-8",
                    "authorize": lastAuthorize,
                    "clientsource": lastClientSource,
                    "origin": "https://visa.vfsglobal.com"
                },
                credentials: "include",
                body: JSON.stringify(timeslotPayload)
            });
            timeslotRes = await resp.json();
            showToast({
                status: timeslotRes && timeslotRes.error ? "error" : "success",
                message: `Saat Dilimi İsteği: ${resp.status} ${resp.statusText}`,
                details: timeslotRes && timeslotRes.error ? (timeslotRes.error.description || JSON.stringify(timeslotRes.error)) : "OK"
            });
        } catch (e) {
            showToast({ status: "error", message: "Saat dilimleri alınamadı.", details: e + '' });
            return;
        }
        let slots = (timeslotRes && timeslotRes.slots) ? timeslotRes.slots : [];
        if (!slots.length) {
            showToast({ status: "error", message: "Son müsait tarih için randevu bulunamadı.", details: `Tarih: ${lastDate}` });
            return;
        }
        showTimeslotPicker(slots, async function (selectedSlot) {
            let feeAmount = selectedSlot.feeAmount || 1313, currency = selectedSlot.currency || "TRY";
            let schedulePayload = {
                missionCode: config.missionCode, countryCode: config.countryCode, centerCode,
                loginUser, urn, aurn: null, notificationType: "none",
                paymentdetails: {
                    paymentmode: "Online", RequestRefNo: "", clientId: "", merchantId: "",
                    amount: feeAmount, currency
                },
                allocationId: selectedSlot.allocationId,
                CanVFSReachoutToApplicant: true,
                TnCConsentAndAcceptance: true
            };
            showToast({ status: "wait", message: `Randevu Alınıyor (${lastDate})...`, details: "Randevu alınıyor ve ödemeye yönlendiriliyor..." });
            try {
                let schedRes = await fetch("https://lift-api.vfsglobal.com/appointment/schedule", {
                    method: "POST",
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "content-type": "application/json;charset=UTF-8",
                        "authorize": lastAuthorize,
                        "clientsource": lastClientSource,
                        "origin": "https://visa.vfsglobal.com"
                    },
                    credentials: "include",
                    body: JSON.stringify(schedulePayload)
                });
                let schedText = await schedRes.clone().text();
                let schedJson = null;
                try { schedJson = JSON.parse(schedText); } catch (_) { }
                showToast({
                    status: schedJson && schedJson.error ? "error" : "success",
                    message: `Planlama İsteği: ${schedRes.status} ${schedRes.statusText}`,
                    details: schedJson && schedJson.error ? (schedJson.error.description || JSON.stringify(schedJson.error)) : "OK"
                });
                let retryMsg = "please";
                if (schedText && schedText.toLowerCase().includes(retryMsg)) {
                    showToast({ status: "error", message: "Randevu başkası tarafından alındı!", details: "Manuel olarak tekrar deneyin." });
                } else {
                    sendTelegram("booking_confirmed", { countryLabel: config.label, centerName: (config.centers.find(c => c.code === centerCode) || {}).name, visaLabel: (config.visaCategories.find(v => v.code === visaCategoryCode) || {}).label, date: lastDate, slot: selectedSlot.slot || selectedSlot.slotDate, fee: feeAmount, currency, applicants: applicantList });
                    const noPaymentNeeded = (schedJson && schedJson.IsPaymentRequired === false);
                    if (noPaymentNeeded) {
                        showToast({ status: "congrats", message: "Randevu alındı (online ödeme yok)", details: "VFS'de randevu özetinizi kontrol edin." });
                    } else {
                        showToast({ status: "congrats", message: "ÖDEMEYE YÖNLENDİRİLİYOR!", details: "PayFort ödeme sayfası bekleniyor..." });
                        sendTelegram("payment_redirect", { countryLabel: config.label, date: lastDate, message: "Ödeme sayfasına yönlendiriliyor (manuel)" });
                        await tryPaymentRedirectFinal(schedRes, schedText, "");
                    }
                }
            } catch (err) {
                showToast({ status: "error", message: "Planlama hatası", details: (err ? err.message : "") });
                sendTelegram("error", { message: "Planlama hatası", error: err ? err.message : "" });
            }
        });
    }
}
// --- Manuel saat dilimi secici UI (Glassmorphism) ---
function showTimeslotPicker(slots, onPick) {
    let overlay = document.getElementById("vfs-timeslot-overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "vfs-timeslot-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const picker = document.createElement("div");
    picker.id = "vfs-timeslot-picker-panel";

    const title = document.createElement("h3");
    title.textContent = t('manualPickerTitle');
    picker.appendChild(title);

    const slotList = document.createElement("div");
    slotList.style.display = "flex";
    slotList.style.flexDirection = "column";
    slotList.style.gap = "8px";

    slots.forEach((slot) => {
        const btn = document.createElement("button");
        btn.className = "vfs-slot-btn";
        btn.textContent = (slot.slot || slot.slotDate || "?") + " | " + (slot.feeAmount || "?") + " " + (slot.currency || "TRY");
        btn.onclick = () => { overlay.remove(); onPick(slot); };
        slotList.appendChild(btn);
    });
    picker.appendChild(slotList);

    const closeBtn = document.createElement("button");
    closeBtn.className = "vfs-slot-close";
    closeBtn.textContent = t('close');
    closeBtn.onclick = () => overlay.remove();
    picker.appendChild(closeBtn);

    overlay.appendChild(picker);
    document.body.appendChild(overlay);
}

// Randevu kontrol toggle UI guncelleme
function updateCheckSlotToggleUI(on) {
    // Sidebar icindeki check slot butonunu guncelle
    const sidebar = document.getElementById("vfs-sidebar");
    if (!sidebar) return;
    const btns = sidebar.querySelectorAll(".vfs-action-btn");
    // 2. buton = check slot (0-indexed: primary=0, check=1)
    if (btns.length > 1) {
        btns[1].classList.toggle("active", on);
    }
}

// Eski floating butonlari temizle
(function cleanupOldButtons() {
    const ids = ["vfs-edit-client-btn", "vfs-send-requests-btn", "vfs-manual-timeslot-toggle", "vfs-turbo-mode-toggle", "vfs-check-slot-toggle"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
})();

// Sidebar'i baslat
createSidebar();
