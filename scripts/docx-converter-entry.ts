// Standalone CLI entry: keeps existing Electron DOCX logic reusable for Tauri.
// Usage: node docx-converter.cjs <input.docx> [workspaceDir]
// stdout: JSON { fileName, markdown, title, outline }；stderr 仅打错误日志。
// 注意：结果 JSON 必须只走 stdout，否则 Rust 侧 JSON 解析会失败。
import { convertDocxToMarkdown } from '../electron/docx/packageService';

async function main() {
  const input = process.argv[2];
  const workspaceDir = process.argv[3] || process.cwd();
  if (!input) {
    console.error(JSON.stringify({ error: 'missing docx path' }));
    process.exit(1);
  }
  const imported = await convertDocxToMarkdown(input, workspaceDir);
  process.stdout.write(JSON.stringify({
    fileName: imported.sourceName,
    markdown: imported.displayMarkdown,
    title: imported.title,
    outline: imported.outline,
  }));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: String(err?.message ?? err) }));
  process.exit(1);
});
