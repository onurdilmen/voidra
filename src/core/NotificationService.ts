/**
 * VOIDRA — Bildirim Servisi (Notification Service)
 * 
 * Telegram, Desktop ve Ses bildirimleri gönderir.
 * Randevu bulunduğunda, hata oluştuğunda veya önemli olaylarda kullanılır.
 * 
 * Kullanım:
 *   import { notificationService } from '@core/NotificationService';
 *   await notificationService.sendAppointmentFound({ date: '2024-03-15', ...});
 */

import { Notification } from 'electron';
import { config } from '@core/Config';
import { Logger } from '@utils/Logger';

const logger = new Logger('Notification');

// ═══════════════════════════════════════════════════════════════
// Telegram API
// ═══════════════════════════════════════════════════════════════

/**
 * Telegram bot API üzerinden mesaj gönder
 */
async function sendTelegram(message: string): Promise<boolean> {
    const token = config.notification.telegramBotToken;
    const chatId = config.notification.telegramChatId;

    if (!token || !chatId) {
        logger.debug('Telegram yapılandırması eksik — bildirim atlandı');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            const error = await response.text();
            logger.error(`Telegram API hatası: ${response.status} — ${error}`);
            return false;
        }

        logger.info('✅ Telegram bildirimi gönderildi');
        return true;
    } catch (error) {
        logger.error('Telegram gönderim hatası', error);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// Desktop Bildirim (OS Notification)
// ═══════════════════════════════════════════════════════════════

/**
 * İşletim sistemi bildirimi göster
 */
function showDesktopNotification(title: string, body: string): void {
    try {
        if (Notification.isSupported()) {
            const notification = new Notification({
                title,
                body,
                icon: undefined, // İkon dosyası varsa eklenebilir
                urgency: 'critical',
                silent: false,
            });
            notification.show();
            logger.debug('Desktop bildirimi gösterildi');
        } else {
            logger.warn('Desktop bildirimleri desteklenmiyor');
        }
    } catch (error) {
        logger.error('Desktop bildirim hatası', error);
    }
}

// ═══════════════════════════════════════════════════════════════
// Ses Uyarısı
// ═══════════════════════════════════════════════════════════════

/**
 * Sistem bip sesi çal (Windows)
 * Harici ses dosyası gerektirmez — PowerShell ile sistem sesi kullanır
 */
function playAlertSound(): void {
    try {
        if (process.platform === 'win32') {
            // Windows: PowerShell ile sistem sesi çal (5 kez bip)
            const { exec } = require('child_process');
            exec(
                'powershell -Command "[console]::beep(1000,300);Start-Sleep -m 200;[console]::beep(1200,300);Start-Sleep -m 200;[console]::beep(1400,300);Start-Sleep -m 200;[console]::beep(1200,300);Start-Sleep -m 200;[console]::beep(1000,500)"',
                { windowsHide: true }
            );
        } else {
            // macOS/Linux: Terminal bell
            process.stdout.write('\x07');
        }
        logger.debug('Sesli uyarı çalındı');
    } catch (error) {
        logger.error('Ses çalma hatası', error);
    }
}

// ═══════════════════════════════════════════════════════════════
// Bildirim Servisi
// ═══════════════════════════════════════════════════════════════

export interface AppointmentInfo {
    date?: string;
    time?: string;
    center?: string;
    country?: string;
    profileName?: string;
    url?: string;
}

class NotificationService {
    /**
     * 🎯 Randevu bulundu bildirimi
     * Tüm kanallardan (Telegram + Desktop + Ses) bildirim gönderir
     */
    async sendAppointmentFound(info: AppointmentInfo): Promise<void> {
        const dateText = info.date || 'Bilinmiyor';
        const timeText = info.time || '';
        const centerText = info.center || '';
        const countryText = info.country || '';

        logger.info('🎯 RANDEVU BULUNDU — Bildrimler gönderiliyor...');

        // ★ Telegram
        if (config.notification.telegramEnabled) {
            const telegramMsg = [
                '🎯 <b>RANDEVU BULUNDU!</b>',
                '',
                `📅 Tarih: <b>${dateText}</b>`,
                timeText ? `🕐 Saat: <b>${timeText}</b>` : '',
                countryText ? `🌍 Ülke: ${countryText}` : '',
                centerText ? `📍 Merkez: ${centerText}` : '',
                info.profileName ? `👤 Profil: ${info.profileName}` : '',
                '',
                '⚡ <i>VOIDRA — Görünmeden Geç.</i>',
            ].filter(Boolean).join('\n');

            await sendTelegram(telegramMsg);
        }

        // ★ Desktop Bildirim
        if (config.notification.desktopEnabled) {
            showDesktopNotification(
                '🎯 RANDEVU BULUNDU!',
                `${dateText}${timeText ? ' — ' + timeText : ''}${centerText ? '\n' + centerText : ''}`
            );
        }

        // ★ Sesli Uyarı
        if (config.notification.soundEnabled) {
            playAlertSound();
        }
    }

    /**
     * ⚠️ Hata bildirimi (sadece Telegram)
     */
    async sendError(context: string, message: string): Promise<void> {
        if (!config.notification.telegramEnabled) return;

        const telegramMsg = [
            `⚠️ <b>VOIDRA Hata</b>`,
            '',
            `📍 Modül: ${context}`,
            `❌ Hata: ${message}`,
            '',
            `🕐 ${new Date().toLocaleTimeString('tr-TR')}`,
        ].join('\n');

        await sendTelegram(telegramMsg);
    }

    /**
     * ℹ️ Bilgi bildirimi (sadece Telegram)
     */
    async sendInfo(message: string): Promise<void> {
        if (!config.notification.telegramEnabled) return;
        await sendTelegram(`ℹ️ ${message}`);
    }

    /**
     * 🔔 Test bildirimi — Ayarların çalışıp çalışmadığını kontrol et
     */
    async sendTest(): Promise<{ telegram: boolean; desktop: boolean; sound: boolean }> {
        const results = { telegram: false, desktop: false, sound: false };

        // Telegram test
        if (config.notification.telegramEnabled) {
            results.telegram = await sendTelegram(
                '🔔 <b>VOIDRA Test Bildirimi</b>\n\nTelegram bağlantısı başarılı! ✅'
            );
        }

        // Desktop test
        if (config.notification.desktopEnabled) {
            showDesktopNotification('🔔 VOIDRA Test', 'Desktop bildirim bağlantısı başarılı!');
            results.desktop = true;
        }

        // Ses test
        if (config.notification.soundEnabled) {
            playAlertSound();
            results.sound = true;
        }

        return results;
    }
}

// Global singleton
export const notificationService = new NotificationService();
