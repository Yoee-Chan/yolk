import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'renderer'),
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: path.resolve(__dirname, 'renderer/dist') },
});
