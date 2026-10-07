#!/usr/bin/env node
// Captures screenshots of the exported site (run `npm run build` first) with a private headless Chromium.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './static-server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const server = await serve(path.join(root, 'out'));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const settle = (page, ms = 3500) => page.waitForTimeout(ms);

async function shot(name, { width, height, dark = false, mobile = false }, fn) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await fn(page);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log('saved', `screenshots/${name}.png`);
  await ctx.close();
}

await shot('home-desktop', { width: 1440, height: 1000 }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, 330));
  await settle(p);
});
await shot('home-desktop-top', { width: 1440, height: 1000 }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await settle(p);
});
await shot('modal-desktop', { width: 1440, height: 960 }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.locator('#gallery a').first().click();
  await p.waitForSelector('[role=dialog] pre');
  await settle(p, 2500);
});
await shot('modal-long-prompt-expanded', { width: 1440, height: 960 }, async (p) => {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'data/items.json'), 'utf8'));
  const it = items.filter((i) => i.video && i.model === 'GPT-6 Astra').sort((a, b) => b.prompt.length - a.prompt.length)[0] || items[0];
  await p.goto(`${base}/p/${it.slug}/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[role=dialog] pre');
  const btn = p.getByRole('button', { name: /Show all/ });
  if (await btn.count()) await btn.click();
  await settle(p, 1500);
});
await shot('home-dark', { width: 1440, height: 1000, dark: true }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, 330));
  await settle(p);
});
await shot('search-filter', { width: 1440, height: 1000 }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Kimi K3/ }).click();
  await p.evaluate(() => window.scrollTo(0, 330));
  await settle(p);
});
await shot('mobile-home', { width: 390, height: 844, mobile: true }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await settle(p);
});
await shot('mobile-grid', { width: 390, height: 844, mobile: true }, async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, 640));
  await settle(p);
});
await shot('mobile-item-page', { width: 390, height: 844, mobile: true }, async (p) => {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'data/items.json'), 'utf8'));
  const it = items.find((i) => i.video) || items[0];
  await p.goto(`${base}/p/${it.slug}/`, { waitUntil: 'networkidle' });
  await settle(p, 2500);
});

await browser.close();
server.close();
