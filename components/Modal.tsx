'use client';
import { useEffect, useRef, useState } from 'react';
import type { LiteItem } from '@/lib/types';
import { formatDate, MODEL_STYLE, postLabel } from '@/lib/format';
import Placeholder from './Placeholder';

export interface Full {
  prompt: string;
  code: string | null;
  sourceNote?: string | null;
}

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;
function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-400 underline-offset-2 hover:decoration-current">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}

function TextBlock({ text, onCopy, copyLabel }: { text: string; onCopy: () => void; copyLabel: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 900 || text.split('\n').length > 16;
  useEffect(() => setOpen(false), [text]);
  return (
    <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/60">
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-950 active:scale-95 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
        {copyLabel}
      </button>
      <div className={`relative overflow-hidden ${long && !open ? 'max-h-[19rem]' : ''}`}>
        <pre className="thin-scroll whitespace-pre-wrap break-words p-4 pr-24 font-mono text-[12.5px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <Linkified text={text} />
        </pre>
        {long && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-50 to-transparent dark:from-neutral-950" />}
      </div>
      {long && (
        <div className="border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white">
            {open ? 'Show less' : `Show all · ${text.length.toLocaleString('en-US')} characters`}
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  item: LiteItem;
  full: Full | null;
  error: boolean;
  position: { index: number; total: number } | null;
  reduceMotion: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToast: (msg: string) => void;
}

export default function Modal({ item, full, error, position, reduceMotion, onClose, onPrev, onNext, onToast }: Props) {
  const [tab, setTab] = useState<'prompt' | 'code'>('prompt');
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab('prompt');
    scrollRef.current?.scrollTo({ top: 0 });
  }, [item.slug]);

  // focus management + scroll lock
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${sw}px`;
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (!typing && e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (!typing && e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast(msg);
    } catch {
      onToast('Copy failed. Select the text manually.');
    }
  };

  const posted = formatDate(item.postedAt);
  const isSkill = item.type === 'skill';
  const text = tab === 'prompt' ? full?.prompt : full?.code;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6 lg:p-10" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 animate-fadeIn bg-neutral-950/50 backdrop-blur-sm dark:bg-black/70" onClick={onClose} aria-hidden />

      {onPrev && (
        <button type="button" onClick={onPrev} aria-label="Previous piece" className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:scale-105 xl:flex dark:bg-neutral-800 dark:text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      {onNext && (
        <button type="button" onClick={onNext} aria-label="Next piece" className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:scale-105 xl:flex dark:bg-neutral-800 dark:text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      )}

      <div
        ref={panelRef}
        className="relative grid h-full w-full max-w-[1280px] animate-pop grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white shadow-2xl sm:h-[min(88vh,860px)] sm:rounded-3xl md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:grid-rows-1 dark:bg-neutral-900 dark:ring-1 dark:ring-white/10"
      >
        {/* media */}
        <div className="relative flex max-h-[45vh] min-h-[220px] items-center justify-center bg-neutral-100 md:max-h-none dark:bg-black">
          {item.video ? (
            <video
              key={item.video}
              src={item.video}
              poster={item.poster ?? undefined}
              className="h-full max-h-[45vh] w-full object-contain md:max-h-full"
              muted
              loop
              playsInline
              controls
              autoPlay={!reduceMotion}
            />
          ) : item.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.poster} alt={`Still from ${item.title}`} className="h-full max-h-[45vh] w-full object-contain md:max-h-full" />
          ) : (
            <div className="h-full min-h-[220px] w-full">
              <Placeholder title={item.title} model={item.model} slug={item.slug} large />
            </div>
          )}
        </div>

        {/* details */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200/80 px-5 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-1">
              <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous piece" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 dark:hover:bg-neutral-800 dark:hover:text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next piece" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 dark:hover:bg-neutral-800 dark:hover:text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              {position && (
                <span className="ml-1 font-mono text-[11px] tabular-nums text-neutral-400">
                  {position.index + 1} / {position.total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => copy(`${window.location.origin}/p/${item.slug}/`, 'Link copied')} className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
                Copy link
              </button>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close (Esc)" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-5 sm:px-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold uppercase text-white dark:bg-white dark:text-neutral-900">
                  {item.creatorName.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1) || '•'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.creatorName}</p>
                  <p className="truncate text-[13px] text-neutral-500 dark:text-neutral-400">{item.handle}</p>
                </div>
              </div>
              <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs font-medium transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white dark:border-neutral-700 dark:hover:border-white dark:hover:bg-white dark:hover:text-neutral-900">
                {postLabel(item.postUrl)} ↗
              </a>
            </div>

            <h2 id="modal-title" className="mt-6 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {item.title}
            </h2>

            <div className="mt-5 flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800" role="tablist">
              {(['prompt', 'code'] as const).map((t) => {
                const disabled = t === 'code' && !item.hasCode;
                return (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    disabled={disabled}
                    onClick={() => setTab(t)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      tab === t ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                    title={disabled ? 'No code was published with this piece' : undefined}
                  >
                    {t === 'prompt' ? (isSkill ? 'Skill' : 'Prompt') : 'Code'}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              {error ? (
                <p className="text-sm text-neutral-500">Couldn&apos;t load this prompt. Open the original post instead.</p>
              ) : text ? (
                <TextBlock text={text} copyLabel={tab === 'prompt' ? (isSkill ? 'Copy' : 'Copy prompt') : 'Copy code'} onCopy={() => copy(text, tab === 'prompt' ? 'Prompt copied' : 'Code copied')} />
              ) : (
                <div className="space-y-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800" aria-busy>
                  {[92, 80, 86, 60].map((w) => (
                    <div key={w} className="h-3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
            </div>

            <dl className="mt-7 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              <dt className="text-neutral-500 dark:text-neutral-400">Model</dt>
              <dd className="flex items-center gap-2 font-medium">
                <span className={`h-2 w-2 rounded-full ${MODEL_STYLE[item.model]?.dot ?? 'bg-neutral-400'}`} />
                {item.model}
              </dd>
              <dt className="text-neutral-500 dark:text-neutral-400">Type</dt>
              <dd>{isSkill ? 'Skill' : 'Prompt'}</dd>
              <dt className="text-neutral-500 dark:text-neutral-400">Stack</dt>
              <dd>{item.stack || 'n/a'}</dd>
              <dt className="text-neutral-500 dark:text-neutral-400">Posted on</dt>
              <dd>{posted ?? <span className="text-neutral-400">Not published</span>}</dd>
              {item.tags?.length > 0 && (
                <>
                  <dt className="text-neutral-500 dark:text-neutral-400">Tags</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {item.tags.map((t) => (
                      <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {t}
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {full?.sourceNote && <p className="mt-6 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">Source note: {full.sourceNote}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
