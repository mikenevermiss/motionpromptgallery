#!/usr/bin/env node
// Generates per-item JSON (prompt + code, loaded lazily by the modal) and a
// full-text search index under public/data/. Runs automatically before dev/build.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const items = JSON.parse(fs.readFileSync(path.join(root, 'data/items.json'), 'utf8'));
const out = path.join(root, 'public/data');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'items'), { recursive: true });

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const search = {};
for (const it of items) {
  fs.writeFileSync(path.join(out, 'items', `${it.slug}.json`), JSON.stringify({ prompt: it.prompt, code: it.code || null, sourceNote: it.sourceNote || null }));
  search[it.slug] = norm(`${it.prompt} ${it.code || ''}`.replace(/\s+/g, ' '));
}
fs.writeFileSync(path.join(out, 'search.json'), JSON.stringify(search));
console.log(`prepare-data: ${items.length} items -> public/data/`);
