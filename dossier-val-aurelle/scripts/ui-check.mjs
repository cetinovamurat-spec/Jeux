/**
 * UI smoke check (development): opens routes of a running Vite server in
 * Chromium, waits for the case to be generated, reports console errors and
 * saves screenshots.
 *   node scripts/ui-check.mjs <baseUrl> <outDir> <route> [<route>…]
 *   e.g. node scripts/ui-check.mjs http://localhost:5199 /tmp/shots / /ged /balance
 * A route may end with '@designer' to enable the designer mode.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [base, out, ...routes] = process.argv.slice(2);
if (!base || !out || !routes.length) {
  console.error('usage: node scripts/ui-check.mjs <baseUrl> <outDir> <route>…');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
let first = true;
for (const r of routes) {
  const [route, flag] = r.split('@');
  const url = `${base}/${flag === 'designer' ? '?designer=1' : ''}#${route}`;
  await page.goto(url);
  await page.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 90000 });
  await page.waitForTimeout(first ? 1500 : 800);
  first = false;
  const file = `${out}/${(route.replace(/[^a-z0-9]+/gi, '_') || 'root').replace(/^_|_$/g, '') || 'root'}${flag ? '-' + flag : ''}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`screenshot ${file}`);
}
console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n${errors.join('\n')}` : 'no console errors');
await browser.close();
