/**
 * VOIDRA — EventBus
 * Modüller arası asenkron iletişim sistemi (Pub/Sub pattern)
 * 
 * Kullanım:
 *   eventBus.on('profile:created', (data) => { ... });
 *   eventBus.emit('profile:created', { id: '123' });
 */

type EventCallback = (...args: any[]) => void;

interface EventMap {
    [eventName: string]: EventCallback[];
}

export class EventBus {
    private events: EventMap = {};
    private static instance: EventBus | null = null;

    // Singleton pattern — tüm modüller aynı EventBus'ı kullanır
    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * Bir olaya abone ol
     * @param event - Olay adı (örn: 'profile:created', 'session:opened')
     * @param callback - Olay tetiklendiğinde çağrılacak fonksiyon
     * @returns Aboneliği iptal etmek için kullanılacak fonksiyon
     */
    on(event: string, callback: EventCallback): () => void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);

        // Unsubscribe fonksiyonu döndür
        return () => {
            this.off(event, callback);
        };
    }

    /**
     * Bir olaya tek seferlik abone ol
     * Olay bir kez tetiklendiğinde abonelik otomatik iptal edilir
     */
    once(event: string, callback: EventCallback): () => void {
        const wrapper = (...args: any[]) => {
            callback(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }

    /**
     * Bir olayı tetikle — abone olan tüm callback'ler çağrılır
     */
    emit(event: string, ...args: any[]): void {
        const callbacks = this.events[event];
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[EventBus] '${event}' olayında hata:`, error);
                }
            });
        }
    }

    /**
     * Bir olay aboneliğini iptal et
     */
    off(event: string, callback: EventCallback): void {
        const callbacks = this.events[event];
        if (callbacks) {
            this.events[event] = callbacks.filter(cb => cb !== callback);
        }
    }

    /**
     * Bir olayın tüm aboneliklerini iptal et
     */
    removeAll(event?: string): void {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }

    /**
     * Kayıtlı olay sayısını döndür (debug için)
     */
    listenerCount(event: string): number {
        return this.events[event]?.length || 0;
    }

    /**
     * Tüm kayıtlı olayları listele (debug için)
     */
    eventNames(): string[] {
        return Object.keys(this.events);
    }
}

// Varsayılan global EventBus instance'ı
export const eventBus = EventBus.getInstance();
