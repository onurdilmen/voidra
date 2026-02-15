/**
 * VOIDRA — Preload Script
 * 
 * Electron'un renderer sürecine güvenli API'ler sunar.
 * contextBridge ile main process'e IPC mesajları gönderir.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Renderer'a sunulan API
const voidraAPI = {
    // ─── Pencere Kontrolleri ──────────────────────
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
        onMaximized: (callback: (isMaximized: boolean) => void) => {
            const handler = (_event: any, value: boolean) => callback(value);
            ipcRenderer.on('window:maximized', handler);
            return () => ipcRenderer.removeListener('window:maximized', handler);
        }
    },

    // ─── Profil Yönetimi ─────────────────────────
    profile: {
        list: () => ipcRenderer.invoke('profile:list'),
        create: (data: any) => ipcRenderer.invoke('profile:create', data),
        update: (id: string, data: any) => ipcRenderer.invoke('profile:update', id, data),
        delete: (id: string) => ipcRenderer.invoke('profile:delete', id),
        open: (id: string) => ipcRenderer.invoke('profile:open', id),
        close: (id: string) => ipcRenderer.invoke('profile:close', id),
        connect: (id: string) => ipcRenderer.invoke('profile:connect', id),        // ★ Login sonrası CDP bağlantısı
        sessionInfo: (id: string) => ipcRenderer.invoke('profile:session:info', id), // Oturum durumu
        launchClean: (id: string, modemConfig?: any) => ipcRenderer.invoke('profile:launchClean', id, modemConfig), // ★ Temiz oturum: reset + temizle + aç
        onStatus: (callback: (data: any) => void) => {
            const handler = (_event: any, data: any) => callback(data);
            ipcRenderer.on('profile:status', handler);
            return () => ipcRenderer.removeListener('profile:status', handler);
        }
    },

    // ─── Dashboard İstatistikleri ────────────────
    stats: {
        get: () => ipcRenderer.invoke('stats:get'),
    },

    // ─── Başvuru Havuzu ──────────────────────────
    pool: {
        list: () => ipcRenderer.invoke('pool:list'),
        get: (id: string) => ipcRenderer.invoke('pool:get', id),
        add: (data: any) => ipcRenderer.invoke('pool:add', data),
        update: (id: string, data: any) => ipcRenderer.invoke('pool:update', id, data),
        delete: (id: string) => ipcRenderer.invoke('pool:delete', id),
        import: () => ipcRenderer.invoke('pool:import'),
        export: (format: 'json' | 'csv') => ipcRenderer.invoke('pool:export', format),
    },

    // ─── Auto-Fill ───────────────────────────────
    autofill: {
        trigger: (profileId: string, applicantId: string) =>
            ipcRenderer.invoke('autofill:trigger', profileId, applicantId),
        onStatus: (callback: (data: any) => void) => {
            const handler = (_event: any, data: any) => callback(data);
            ipcRenderer.on('autofill:status', handler);
            return () => ipcRenderer.removeListener('autofill:status', handler);
        }
    },

    // ─── Ayarlar ─────────────────────────────────
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (path: string, value: any) => ipcRenderer.invoke('settings:set', path, value)
    },

    // ─── Bildirimler ─────────────────────────────
    notification: {
        test: () => ipcRenderer.invoke('notification:test'),
        send: (type: string, payload: any) => ipcRenderer.invoke('notification:send', type, payload),
    },

    // ─── Firewall Reset ─────────────────────────────────
    // VFS Global firewall'a takıldığında tam sıfırlama
    firewall: {
        // Tam sıfırlama: Cookie + Cache + DNS + Modem Restart
        fullReset: (modemConfig?: any) => ipcRenderer.invoke('firewall:fullReset', modemConfig),
        // Hızlı temizlik: Sadece Cookie + Cache + DNS (Modem restart YOK)
        quickCleanup: () => ipcRenderer.invoke('firewall:quickCleanup'),
        // Gateway IP tespiti
        detectGateway: () => ipcRenderer.invoke('firewall:detectGateway'),
        // Mevcut dış IP adresi
        getIp: () => ipcRenderer.invoke('firewall:getIp'),
        // Reset olaylarını dinle
        onResetEvent: (callback: (data: any) => void) => {
            const handler = (_event: any, data: any) => callback(data);
            ipcRenderer.on('firewall:reset:event', handler);
            return () => ipcRenderer.removeListener('firewall:reset:event', handler);
        }
    },

    // ─── Log ─────────────────────────────────────
    log: {
        getHistory: () => ipcRenderer.invoke('log:history'),
        onEntry: (callback: (entry: any) => void) => {
            const handler = (_event: any, entry: any) => callback(entry);
            ipcRenderer.on('log:entry', handler);
            return () => ipcRenderer.removeListener('log:entry', handler);
        }
    },

    // ─── Olay Köprüsü ───────────────────────────
    // Main process'ten gelen olayları dinle
    onEvent: (callback: (payload: { event: string; data: any }) => void) => {
        const handler = (_event: any, payload: { event: string; data: any }) => callback(payload);
        ipcRenderer.on('event:bridge', handler);
        return () => ipcRenderer.removeListener('event:bridge', handler);
    }
};

// API'yi renderer'a sun
contextBridge.exposeInMainWorld('voidra', voidraAPI);

// TypeScript tip tanımı
export type VoidraAPI = typeof voidraAPI;
