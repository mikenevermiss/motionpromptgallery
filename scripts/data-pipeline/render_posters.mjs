import { chromium } from '/workspace/motionpromptgallery/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const man = JSON.parse(fs.readFileSync('/workspace/research/build/media_manifest.json', 'utf8')).filter((m) => m.transform === 'render');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const m of man) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(m.url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(5000);
    const out = '/tmp/render-' + m.slug + '.png';
    await page.screenshot({ path: out });
    console.log('ok', m.slug, out);
  } catch (e) {
    console.log('fail', m.slug, String(e).slice(0, 120));
  }
  await page.close();
}
await browser.close();
