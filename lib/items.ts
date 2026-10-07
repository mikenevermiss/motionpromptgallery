import fs from 'node:fs';
import path from 'node:path';
import type { Item, LiteItem } from './types';

let cache: Item[] | null = null;

export function getItems(): Item[] {
  if (!cache) {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'items.json'), 'utf8');
    cache = (JSON.parse(raw) as Item[]).sort(byNewest);
  }
  return cache;
}

export function byNewest(a: { postedAt: string | null; title: string }, b: { postedAt: string | null; title: string }) {
  const da = a.postedAt ? Date.parse(a.postedAt) : 0;
  const db = b.postedAt ? Date.parse(b.postedAt) : 0;
  return db - da || a.title.localeCompare(b.title);
}

export function norm(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function toLite(it: Item): LiteItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { prompt, code, sourceNote, ...rest } = it;
  return { ...rest, hasCode: !!code };
}

export function getLiteItems(): LiteItem[] {
  return getItems().map(toLite);
}

export function getItem(slug: string): Item | undefined {
  return getItems().find((i) => i.slug === slug);
}
