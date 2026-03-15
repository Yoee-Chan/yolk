import {defineConfig} from 'electron-vite';
import path from 'path';

export default defineConfig({
    main: {
        build: {
            lib: {
                entry: path.resolve(__dirname, 'electron/main/index.ts'),
            },
            outDir: 'dist-electron/main',
        },
    },
    preload: {
        build: {
            lib: {
                entry: path.resolve(__dirname, 'electron/preload/index.ts'),
            },
            outDir: 'dist-electron/preload',
        },
    },
    renderer: {
        root: path.resolve(__dirname, 'renderer'),
        build: {
            outDir: 'dist/renderer',
            rollupOptions: {
                input: path.resolve(__dirname, 'renderer/index.html')
            }
        }
    }
});