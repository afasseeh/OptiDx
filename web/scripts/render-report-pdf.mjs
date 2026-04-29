import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const [htmlPath, pdfPath] = process.argv.slice(2);

if (!htmlPath || !pdfPath) {
  console.error('Usage: node render-report-pdf.mjs <input.html> <output.pdf>');
  process.exit(1);
}

const html = await readFile(htmlPath, 'utf8');
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: pdfPath,
    printBackground: true,
    preferCSSPageSize: true,
    format: 'A4',
    margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
    },
  });
} finally {
  await browser.close();
}
