// Builds a standalone DOCX converter used by the Tauri production bundle.
// Input: node dist-docx/docx-converter.cjs <file.docx>
// Output: JSON { fileName, markdown, title, outline } on stdout.
import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

await build({
  configFile: false,
  logLevel: 'info',
  build: {
    outDir: path.resolve(projectRoot, 'dist-docx'),
    emptyOutDir: true,
    minify: true,
    target: 'node18',
    lib: {
      entry: path.resolve(projectRoot, 'scripts/docx-converter-entry.ts'),
      formats: ['cjs'],
      fileName: () => 'docx-converter.cjs',
    },
    // Node 内置模块必须保持 external：打包进浏览器垫片会让 `path.default`
    // 之类调用在运行时变成 undefined（导入 Word 直接报 basename is not a function）。
    rollupOptions: {
      external: [
        'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'fs/promises',
        'http', 'https', 'net', 'os', 'path', 'process', 'stream', 'string_decoder',
        'tty', 'url', 'util', 'zlib',
      ],
    },
  },
});
console.log('DOCX converter built to dist-docx/docx-converter.cjs');
