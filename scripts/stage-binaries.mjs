// Copies production sidecars into src-tauri/binaries for Tauri bundling.
// Usage: node scripts/stage-binaries.mjs
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(projectRoot, 'src-tauri', 'binaries');
mkdirSync(outDir, { recursive: true });

const files = [
  ['agent-controller', 'dist', 'agent_stream.exe', 'agent_stream-x86_64-pc-windows-msvc.exe'],
  ['agent-controller', 'dist', 'agent_tools.exe', 'agent_tools-x86_64-pc-windows-msvc.exe'],
];

let missing = [];
for (const [a, b, src, dest] of files) {
  const from = path.join(projectRoot, a, b, src);
  if (!existsSync(from)) {
    missing.push(from);
    continue;
  }
  copyFileSync(from, path.join(outDir, dest));
  console.log(`staged ${src} -> src-tauri/binaries/${dest}`);
}

// DOCX converter: ship the vite-built cjs alongside binaries.
const docxCjs = path.join(projectRoot, 'dist-docx', 'docx-converter.cjs');
if (!existsSync(docxCjs)) {
  missing.push(docxCjs);
} else {
  copyFileSync(docxCjs, path.join(outDir, 'docx-converter.cjs'));
  console.log('staged docx-converter.cjs -> src-tauri/binaries/docx-converter.cjs');
}

if (missing.length > 0) {
  console.error('Missing build outputs:\n - ' + missing.join('\n - '));
  process.exit(1);
}
console.log('All sidecars staged.');
