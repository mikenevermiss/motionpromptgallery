'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { LiteItem } from '@/lib/types';
import { MODELS } from '@/lib/types';
import { hash, MODEL_STYLE } from '@/lib/format';
import { SITE } from '@/lib/site';
import Card from './Card';
import Modal, { type Full } from './Modal';
import Toast from './Toast';

type TypeFilter = 'all' | 'prompt' | 'skill';
type Sort = 'featured' | 'newest' | 'oldest';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const time = (d: string | null) => (d ? Date.parse(d) : 0);
const ratioOf = (it: LiteItem) => {
  const r = it.aspectRatio || ['4/5', '1/1', '4/3', '3/4'][hash(it.slug) % 4]; // same fallback as Card
  const [w, h] = r.split('/').map(Number);
  return w && h ? w / h : 1;
};
const slugFromPath = (p: string) => p.match(/^\/p\/([^/]+)\/?$/)?.[1] ?? null;

interface Props {
  items: LiteItem[];
  initialSlug?: string;
  initialFull?: Full;
}

export default function Gallery({ items, initialSlug, initialFull }: Props) {
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<string>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<Sort>('featured');
  const [cols, setCols] = useState<number | null>(null); // null until mounted: CSS columns for SSR / no-JS
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(initialSlug ?? null);
  const [fullCache, setFullCache] = useState<Record<string, Full>>(initialSlug && initialFull ? { [initialSlug]: initialFull } : {});
  const [fullError, setFullError] = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState<Record<string, string> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const dq = useDeferredValue(query);
  const PAGE = 24;
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // preferences
  useEffect(() => {
    try {
      setPaused(localStorage.getItem('mpg-paused') === '1');
    } catch {}
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const upd = () => setReduceMotion(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  // Row-major masonry: CSS columns fill top-to-bottom, which would push featured cards below the fold,
  // so once mounted we distribute cards into flex columns in reading order (shortest column first).
  useEffect(() => {
    const qs = ['(min-width: 640px)', '(min-width: 1024px)', '(min-width: 1536px)'].map((q) => window.matchMedia(q));
    const upd = () => setCols(1 + qs.filter((q) => q.matches).length);
    upd();
    qs.forEach((q) => q.addEventListener('change', upd));
    return () => qs.forEach((q) => q.removeEventListener('change', upd));
  }, []);

  const togglePaused = () => {
    setPaused((p) => {
      try {
        localStorage.setItem('mpg-paused', p ? '0' : '1');
      } catch {}
      return !p;
    });
  };

  // full-text search index: load lazily (on first focus / when idle)
  const loadIndex = useCallback(() => {
    if (searchIndex) return;
    fetch('/data/search.json')
      .then((r) => r.json())
      .then(setSearchIndex)
      .catch(() => {});
  }, [searchIndex]);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(loadIndex) : window.setTimeout(loadIndex, 1500);
    return () => {
      if (!w.requestIdleCallback) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtering
  const tokens = useMemo(() => norm(dq).split(/\s+/).filter(Boolean), [dq]);
  const meta = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.slug] = norm([it.title, it.creatorName, it.handle, it.model, it.stack, it.type, ...(it.tags || [])].join(' '));
    return m;
  }, [items]);
  const matchesQuery = useCallback(
    (it: LiteItem) => tokens.every((t) => meta[it.slug].includes(t) || (searchIndex?.[it.slug]?.includes(t) ?? false)),
    [tokens, searchIndex, meta],
  );
  const base = useMemo(() => items.filter((it) => (type === 'all' || it.type === type) && matchesQuery(it)), [items, type, matchesQuery]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const it of base) c[it.model] = (c[it.model] || 0) + 1;
    return c;
  }, [base]);
  const typeCounts = useMemo(() => {
    const c = { all: 0, prompt: 0, skill: 0 };
    for (const it of items) if ((model === 'all' || it.model === model) && matchesQuery(it)) (c.all++, c[it.type]++);
    return c;
  }, [items, model, matchesQuery]);
  const visible = useMemo(() => {
    const v = base.filter((it) => model === 'all' || it.model === model);
    if (sort === 'featured') return v; // items arrive pre-sorted (featured, then video, then newest)
    const dir = sort === 'newest' ? -1 : 1;
    return [...v].sort((a, b) => dir * (time(a.postedAt) - time(b.postedAt)) || a.title.localeCompare(b.title));
  }, [base, model, sort]);

  // progressive rendering: render a page of cards, add more as the user nears the end
  useEffect(() => setLimit(PAGE), [dq, model, type, sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, visible.length]);

  // modal navigation within the current filtered list (falls back to all items)
  const navList = useMemo(() => (openSlug && visible.some((i) => i.slug === openSlug) ? visible : items), [visible, items, openSlug]);
  const openIndex = openSlug ? navList.findIndex((i) => i.slug === openSlug) : -1;
  const openItem = openIndex >= 0 ? navList[openIndex] : null;

  const showToast = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const open = useCallback(
    (slug: string, mode: 'push' | 'replace' = 'push') => {
      setOpenSlug(slug);
      const url = `/p/${slug}/`;
      if (window.location.pathname !== url) window.history[mode === 'push' ? 'pushState' : 'replaceState']({ slug }, '', url);
      const it = items.find((i) => i.slug === slug);
      if (it) document.title = `${it.title} · ${SITE.name}`;
    },
    [items],
  );
  const close = useCallback(() => {
    setOpenSlug(null);
    if (window.location.pathname !== '/') {
      if (window.history.state?.slug && window.history.length > 1 && !initialSlug) window.history.back();
      else window.history.pushState({}, '', '/');
    }
    document.title = `${SITE.name}: AI motion graphics and the prompts behind them`;
  }, [initialSlug]);

  useEffect(() => {
    const onPop = () => setOpenSlug(slugFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // fetch prompt/code for the open item (and prefetch neighbours)
  useEffect(() => {
    if (!openItem) return;
    const want = [openItem, navList[openIndex - 1], navList[openIndex + 1]].filter(Boolean) as LiteItem[];
    for (const it of want) {
      if (fullCache[it.slug]) continue;
      fetch(`/data/items/${it.slug}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then((f: Full) => setFullCache((c) => ({ ...c, [it.slug]: f })))
        .catch(() => it.slug === openItem.slug && setFullError(it.slug));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItem?.slug]);

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !openSlug && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSlug]);

  const Heading = initialSlug ? 'h2' : 'h1';
  const shown = visible.slice(0, limit);
  const columns = useMemo(() => {
    if (!cols || cols < 2) return null;
    const out: { it: LiteItem; i: number }[][] = Array.from({ length: cols }, () => []);
    const h = new Array(cols).fill(0);
    shown.forEach((it, i) => {
      const c = h.indexOf(Math.min(...h));
      out[c].push({ it, i });
      h[c] += 1 / ratioOf(it) + 0.2; // media height + caption, in column widths
    });
    return out;
  }, [shown, cols]);
  const canPlay = !paused && !reduceMotion && !openSlug;
  const reset = () => {
    setQuery('');
    setModel('all');
    setType('all');
  };

  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${
      active
        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-white'
    }`;

  return (
    <>
      <section className="mx-auto max-w-[1600px] px-4 pb-8 pt-14 sm:px-6 sm:pt-20 lg:px-10">
        <div className="max-w-3xl animate-fadeUp">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {items.length} pieces · {MODELS.length} models
          </p>
          <Heading className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Motion graphics made with frontier AI models, <span className="text-neutral-400 dark:text-neutral-500">next to the prompts that made them.</span>
          </Heading>
          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            A curated gallery of work made with Claude Opus 5.5, Kimi K3, Claude Fable 5 and GPT-6 Astra. Every piece credits its creator and links back to the original post.
          </p>
        </div>
      </section>

      {/* controls */}
      <div className="sticky top-14 z-30 border-b border-transparent bg-white/85 backdrop-blur-xl dark:bg-neutral-950/85">
        <div className="mx-auto max-w-[1600px] space-y-2.5 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-10">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search</span>
              <svg aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onFocus={loadIndex}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                placeholder="Search prompts, creators, tags…"
                className="h-10 w-full rounded-full border border-neutral-200 bg-neutral-50 pl-10 pr-10 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600 dark:focus:bg-neutral-950"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-neutral-200 px-1.5 font-mono text-[10px] text-neutral-400 sm:block dark:border-neutral-700">/</kbd>
            </label>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <label className="relative">
                <span className="sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-9 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-[13px] font-medium text-neutral-700 outline-none hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                >
                  <option value="featured">Featured</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
                <svg aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
              </label>
              <button
                type="button"
                onClick={togglePaused}
                aria-pressed={paused}
                title={reduceMotion ? 'Previews are paused because your system prefers reduced motion' : undefined}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3.5 text-[13px] font-medium text-neutral-700 transition hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-300"
              >
                {paused || reduceMotion ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
                )}
                <span className="hidden sm:inline">{paused || reduceMotion ? 'Play previews' : 'Pause previews'}</span>
              </button>
            </div>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 items-center lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Filters">
            <div className="flex shrink-0 items-center rounded-full border border-neutral-200 p-0.5 dark:border-neutral-800" role="group" aria-label="Filter by type">
              {(['all', 'prompt', 'skill'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium capitalize transition ${type === t ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`}
                >
                  {t === 'all' ? 'All' : t === 'prompt' ? 'Prompt' : 'Skill'}
                  <span className="ml-1 tabular-nums opacity-60">{typeCounts[t]}</span>
                </button>
              ))}
            </div>

            <span aria-hidden className="mx-1 h-6 w-px shrink-0 self-center bg-neutral-200 dark:bg-neutral-800" />
            <button type="button" className={chip(model === 'all')} onClick={() => setModel('all')} aria-pressed={model === 'all'}>
              All models <span className="tabular-nums opacity-60">{counts.all}</span>
            </button>
            {MODELS.map((m) => (
              <button key={m} type="button" className={chip(model === m)} onClick={() => setModel(model === m ? 'all' : m)} aria-pressed={model === m}>
                <span className={`h-1.5 w-1.5 rounded-full ${MODEL_STYLE[m].dot}`} />
                {m} <span className="tabular-nums opacity-60">{counts[m] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main id="gallery" className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6 lg:px-10">
        <p className="mb-5 text-xs text-neutral-400" aria-live="polite">
          {visible.length === items.length ? `${items.length} pieces` : `${visible.length} of ${items.length} pieces`}
          {reduceMotion && ' · previews paused (reduced motion)'}
        </p>
        {visible.length ? (
          columns ? (
            <div className="flex items-start gap-5 sm:gap-6">
              {columns.map((col, c) => (
                <div key={c} className="min-w-0 flex-1">
                  {col.map(({ it, i }) => (
                    <Card key={it.slug} item={it} index={i % PAGE} canPlay={canPlay} onOpen={open} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 sm:gap-6 lg:columns-3 2xl:columns-4">
              {shown.map((it, i) => (
                <Card key={it.slug} item={it} index={i % PAGE} canPlay={canPlay} onOpen={open} />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 py-24 text-center dark:border-neutral-800">
            <p className="text-sm font-medium">Nothing matches that yet.</p>
            <p className="mt-1 text-sm text-neutral-500">Try another search or clear the filters.</p>
            <button type="button" onClick={reset} className="mt-5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Clear filters
            </button>
          </div>
        )}
        {limit < visible.length && (
          <div ref={sentinel} className="flex justify-center py-10">
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300">
              Load more
            </button>
          </div>
        )}
      </main>

      {openItem && (
        <Modal
          item={openItem}
          full={fullCache[openItem.slug] ?? null}
          error={fullError === openItem.slug && !fullCache[openItem.slug]}
          position={{ index: openIndex, total: navList.length }}
          reduceMotion={reduceMotion}
          onClose={close}
          onPrev={openIndex > 0 ? () => open(navList[openIndex - 1].slug, 'replace') : undefined}
          onNext={openIndex < navList.length - 1 ? () => open(navList[openIndex + 1].slug, 'replace') : undefined}
          onToast={showToast}
        />
      )}
      <Toast message={toast} />
    </>
  );
}
