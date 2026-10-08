// Génère les icônes PNG à partir de www/icons/icon.svg (utilise Playwright/Chromium).
// Usage : node tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../www/icons/', import.meta.url));
const svg = readFileSync(dir + 'icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

const targets = [
  { file: 'icon-180.png', size: 180, pad: 0 },
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  // Version "maskable" : marge de sécurité pour les icônes rondes d'Android.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
];

for (const { file, size, pad } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#4fc3f7;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: dir + file });
  console.log('écrit', file);
}

await browser.close();
