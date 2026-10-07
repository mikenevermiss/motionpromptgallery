#!/usr/bin/env node
/**
 * Append gallery entries to data/items.json from a JSON or CSV file.
 *
 *   npm run add-item -- new-items.json            # array of objects, or a single object
 *   npm run add-item -- new-items.csv             # header row with the field names below
 *   npm run add-item -- new-items.csv --dry-run   # validate and preview only
 *   npm run validate                              # validate data/items.json as-is
 *
 * Fields: title, model, type (prompt|skill), creatorName, handle, postUrl, postedAt (YYYY-MM-DD or empty),
 *         stack, prompt, code, tags ("a|b|c" in CSV), video (/videos/x.mp4), poster (/posters/x.webp),
 *         aspectRatio ("16/9"), sourceNote, slug and id (both optional, generated when missing).
 *
 * Rule: only add real pieces with a real source URL and the creator's actual prompt (or skill link).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(root, 'data/items.json');
const PUBLIC = path.join(root, 'public');
const MODELS = ['Claude Opus 5.5', 'Kimi K3', 'Claude Fable 5', 'GPT-6 Astra'];
const MODEL_ALIASES = { 'opus 5.5': 'Claude Opus 5.5', 'claude opus 5.5': 'Claude Opus 5.5', 'kimi k3': 'Kimi K3', 'fable 5': 'Claude Fable 5', 'claude fable 5': 'Claude Fable 5', 'gpt astra': 'GPT-6 Astra', 'gpt-6 astra': 'GPT-6 Astra', 'astra': 'GPT-6 Astra' };
const REQUIRED = ['title', 'model', 'type', 'creatorName', 'handle', 'postUrl', 'prompt'];

export function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
}

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

function probeRatio(p) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], { encoding: 'utf8' }).trim();
    const [w, h] = out.split(',').map(Number);
    return w && h ? `${w}/${h}` : null;
  } catch {
    return null;
  }
}

function normalize(raw) {
  const it = { ...raw };
  for (const k of Object.keys(it)) if (typeof it[k] === 'string') it[k] = it[k].trim();
  if (typeof it.model === 'string') it.model = MODEL_ALIASES[it.model.toLowerCase()] || it.model;
  if (typeof it.type === 'string') it.type = it.type.toLowerCase();
  if (typeof it.tags === 'string') it.tags = it.tags.split(/[|,]/).map((t) => t.trim()).filter(Boolean);
  it.tags = [...new Set(it.tags || [])];
  if (it.handle && !it.handle.startsWith('@') && !/\./.test(it.handle)) it.handle = '@' + it.handle;
  for (const k of ['code', 'video', 'poster', 'aspectRatio', 'postedAt']) if (!it[k]) it[k] = null;
  it.stack = it.stack || '';
  it.sourceNote = it.sourceNote || '';
  if (!it.aspectRatio && it.video) it.aspectRatio = probeRatio(path.join(PUBLIC, it.video));
  if (!it.aspectRatio && it.poster) it.aspectRatio = probeRatio(path.join(PUBLIC, it.poster));
  return it;
}

export function validate(it, { slugs = new Set(), ids = new Set() } = {}) {
  const errs = [];
  for (const k of REQUIRED) if (!it[k] || (typeof it[k] === 'string' && !it[k].trim())) errs.push(`missing "${k}"`);
  if (it.model && !MODELS.includes(it.model)) errs.push(`unknown model "${it.model}" (use one of: ${MODELS.join(', ')})`);
  if (it.type && !['prompt', 'skill'].includes(it.type)) errs.push(`type must be "prompt" or "skill"`);
  try {
    const u = new URL(it.postUrl);
    if (!/^https?:$/.test(u.protocol)) errs.push('postUrl must be http(s)');
  } catch {
    errs.push(`postUrl is not a valid URL: ${it.postUrl}`);
  }
  if (it.postedAt && !/^\d{4}-\d{2}-\d{2}/.test(it.postedAt)) errs.push('postedAt must be YYYY-MM-DD or empty');
  if (it.aspectRatio && !/^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(it.aspectRatio)) errs.push('aspectRatio must look like "16/9"');
  for (const k of ['video', 'poster']) {
    if (!it[k]) continue;
    if (!it[k].startsWith(`/${k}s/`)) errs.push(`${k} must be a path under /${k}s/`);
    else if (!fs.existsSync(path.join(PUBLIC, it[k]))) errs.push(`${k} file not found: public${it[k]}`);
  }
  if (!Array.isArray(it.tags)) errs.push('tags must be an array');
  if (it.slug && slugs.has(it.slug)) errs.push(`duplicate slug "${it.slug}"`);
  if (it.id && ids.has(it.id)) errs.push(`duplicate id "${it.id}"`);
  return errs;
}

const ORDER = ['id', 'title', 'slug', 'model', 'type', 'creatorName', 'handle', 'postUrl', 'postedAt', 'stack', 'prompt', 'code', 'tags', 'video', 'poster', 'aspectRatio', 'sourceNote'];
const ordered = (it) => Object.fromEntries([...ORDER.filter((k) => k in it).map((k) => [k, it[k]]), ...Object.entries(it).filter(([k]) => !ORDER.includes(k))]);

function main() {
  const args = process.argv.slice(2);
  const items = JSON.parse(fs.readFileSync(DATA, 'utf8'));

  if (args.includes('--validate')) {
    const slugs = new Set(), ids = new Set();
    let bad = 0;
    for (const it of items) {
      const errs = validate(it, { slugs, ids });
      if (it.slug !== slugify(it.slug)) errs.push('slug is not url-safe');
      slugs.add(it.slug);
      ids.add(it.id);
      if (errs.length) bad++, console.error(`✗ ${it.slug || it.title}: ${errs.join('; ')}`);
    }
    const per = items.reduce((m, i) => ((m[i.model] = (m[i.model] || 0) + 1), m), {});
    console.log(`${items.length} items, ${items.filter((i) => i.video).length} with video, ${bad} invalid`);
    console.log(per);
    process.exit(bad ? 1 : 0);
  }

  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run add-item -- <file.json|file.csv> [--dry-run]   |   npm run validate');
    process.exit(2);
  }
  const text = fs.readFileSync(file, 'utf8');
  let incoming = file.toLowerCase().endsWith('.csv') ? parseCSV(text) : JSON.parse(text);
  if (!Array.isArray(incoming)) incoming = [incoming];

  const slugs = new Set(items.map((i) => i.slug));
  const ids = new Set(items.map((i) => i.id));
  const posts = new Set(items.map((i) => `${i.postUrl}|${i.model}|${i.title}`));
  const added = [];
  let failed = 0;
  for (const raw of incoming) {
    const it = normalize(raw);
    if (!it.slug && it.title) {
      const base = slugify(`${it.title} ${String(it.handle || '').replace(/^@/, '')}`) || 'item';
      let s = base, n = 2;
      while (slugs.has(s)) s = `${base}-${n++}`;
      it.slug = s;
    } else if (it.slug) it.slug = slugify(it.slug);
    if (!it.id) {
      const tweet = String(it.postUrl || '').match(/status\/(\d+)/)?.[1];
      let id = tweet ? `x-${tweet}` : it.slug;
      if (ids.has(id)) id = `${id}-${it.slug}`;
      it.id = id;
    }
    const errs = validate(it, { slugs, ids });
    if (posts.has(`${it.postUrl}|${it.model}|${it.title}`)) errs.push('looks like a duplicate of an existing entry (same postUrl, model and title)');
    if (errs.length) {
      failed++;
      console.error(`✗ ${it.title || '(untitled)'}: ${errs.join('; ')}`);
      continue;
    }
    slugs.add(it.slug);
    ids.add(it.id);
    posts.add(`${it.postUrl}|${it.model}|${it.title}`);
    added.push(ordered(it));
    console.log(`✓ ${it.slug}  [${it.model} · ${it.type}]`);
  }
  if (args.includes('--dry-run')) {
    console.log(`\nDry run: ${added.length} valid, ${failed} rejected. Nothing written.`);
  } else if (added.length) {
    fs.writeFileSync(DATA, JSON.stringify([...items, ...added], null, 1) + '\n');
    console.log(`\nAdded ${added.length} item(s) (${failed} rejected). data/items.json now has ${items.length + added.length}. Run "npm run build" to publish.`);
  } else {
    console.log(`\nNothing added (${failed} rejected).`);
  }
  process.exit(failed ? 1 : 0);
}

main();
