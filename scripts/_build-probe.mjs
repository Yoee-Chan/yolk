// 临时探针：把 renderer 侧的 DOCX 解析打包成 cjs，用于 CLI 验证。
import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

await build({
  configFile: false,
  logLevel: 'error',
  build: {
    outDir: path.resolve(projectRoot, 'dist-docx-probe'),
    emptyOutDir: true,
    minify: false,
    target: 'node18',
    lib: {
      entry: path.resolve(projectRoot, 'scripts/_probe-docx.ts'),
      formats: ['cjs'],
      fileName: () => 'probe.cjs',
    },
    rollupOptions: {
      external: ['fs', 'path', 'url', 'process', 'buffer', 'crypto', 'stream', 'util', 'zlib', 'assert', 'events', 'os'],
    },
  },
});
console.log('probe built');
