import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Electron Ana Süreç konfigürasyonu
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                '@core': resolve('src/core'),
                '@managers': resolve('src/managers'),
                '@models': resolve('src/models'),
                '@utils': resolve('src/utils'),
                '@automation': resolve('src/automation'),
                '@scripts': resolve('src/scripts')
            }
        },
        build: {
            outDir: 'out/main',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/main/index.ts')
                }
            }
        }
    },

    // Preload script konfigürasyonu
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'out/preload',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/preload/index.ts')
                }
            }
        }
    },

    // React Renderer konfigürasyonu
    renderer: {
        plugins: [react()],
        resolve: {
            alias: {
                '@renderer': resolve('src/renderer/src')
            }
        },
        root: resolve('src/renderer'),
        build: {
            outDir: 'out/renderer',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/renderer/index.html')
                }
            }
        }
    }
});
