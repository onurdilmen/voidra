/**
 * VOIDRA — Özel Başlık Çubuğu
 * Frameless pencere için minimize/maximize/close kontrolleri
 */

import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

function Titlebar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        // Başlangıçta maximize durumunu kontrol et
        window.voidra?.window.isMaximized().then(setIsMaximized);

        // Maximize durumu değişikliklerini dinle
        const cleanup = window.voidra?.window.onMaximized((value) => {
            setIsMaximized(value);
        });

        return () => cleanup?.();
    }, []);

    return (
        <div className="titlebar">
            {/* Logo */}
            <div className="titlebar__logo">
                <div className="titlebar__logo-icon">V</div>
                <span className="titlebar__logo-text">VOIDRA</span>
            </div>

            {/* Pencere kontrolleri */}
            <div className="titlebar__controls">
                <button
                    className="titlebar__btn"
                    onClick={() => window.voidra?.window.minimize()}
                    title="Küçült"
                    id="btn-minimize"
                >
                    <Minus size={14} />
                </button>
                <button
                    className="titlebar__btn"
                    onClick={() => window.voidra?.window.maximize()}
                    title={isMaximized ? 'Geri Al' : 'Büyüt'}
                    id="btn-maximize"
                >
                    {isMaximized ? <Copy size={12} /> : <Square size={12} />}
                </button>
                <button
                    className="titlebar__btn titlebar__btn--close"
                    onClick={() => window.voidra?.window.close()}
                    title="Kapat"
                    id="btn-close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

export default Titlebar;
