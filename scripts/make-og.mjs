#!/usr/bin/env node
// Renders public/og.png (1200x630 default social card) with headless Chromium.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const items = JSON.parse(fs.readFileSync(path.join(root, 'data/items.json'), 'utf8'));
// Featured pieces first (by rank), so the share card matches the homepage's first screen.
const rank = (i) => i.featured ?? Infinity;
const posters = items.filter((i) => i.poster && i.video).sort((a, b) => rank(a) - rank(b)).slice(0, 8).map((i) => 'data:image/' + (i.poster.endsWith('.jpg') ? 'jpeg' : 'webp') + ';base64,' + fs.readFileSync(path.join(root, 'public', i.poster)).toString('base64'));
const html = `<!doctype html><html><head><style>
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#fff;color:#0a0a0a;display:flex;overflow:hidden}
.l{width:560px;padding:72px 56px;display:flex;flex-direction:column;justify-content:space-between}
.w{font-size:30px;font-weight:650;letter-spacing:-.02em}.w span{color:#a3a3a3}
h1{font-size:50px;line-height:1.05;letter-spacing:-.035em;font-weight:650}h1 span{color:#a3a3a3}
.m{font-size:20px;color:#737373}.g{flex:1;display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:28px 28px 28px 0;transform:rotate(-4deg) translateY(-40px) scale(1.08)}
.g div{border-radius:18px;background-size:cover;background-position:center;aspect-ratio:16/10;box-shadow:0 10px 30px rgba(0,0,0,.08)}
</style></head><body><div class="l"><div class="w">Motion<span>Prompt</span>Gallery</div>
<h1>Motion graphics made with frontier AI models, <span>next to the prompts that made them.</span></h1>
<div class="m">Claude Opus 5.5 · Kimi K3 · Claude Fable 5 · GPT-6 Astra</div></div>
<div class="g">${posters.map((p) => `<div style="background-image:url('${p}')"></div>`).join('')}</div></body></html>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: path.join(root, 'public/og.png') });
await browser.close();
console.log('wrote public/og.png');
