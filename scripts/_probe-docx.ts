import { convertDocxFile } from '../renderer/src/utils/docx/docxToMarkdown';
import { readFileSync } from 'fs';

(async () => {
  const file = process.argv[2];
  const bytes = readFileSync(file);
  const converted = await convertDocxFile(new Blob([bytes]), file.split(/[\\/]/).pop()!);
  console.log(JSON.stringify({
    title: converted.title,
    outline: converted.outline,
    markdown: converted.displayMarkdown.slice(0, 200),
  }));
})().catch((e) => {
  console.error('FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
