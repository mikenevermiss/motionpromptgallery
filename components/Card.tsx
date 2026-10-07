'use client';
import { memo, useEffect, useRef, useState } from 'react';
import type { LiteItem } from '@/lib/types';
import { hash, MODEL_STYLE } from '@/lib/format';
import Placeholder from './Placeholder';

const PH_RATIOS = ['4/5', '1/1', '4/3', '3/4'];

function Card({ item, canPlay, onOpen, index }: { item: LiteItem; canPlay: boolean; onOpen: (slug: string) => void; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false); // within preload distance: mount the <video>
  const [visible, setVisible] = useState(false); // actually on screen: play
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !item.video) return;
    const pre = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '400px 0px' });
    const vis = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    pre.observe(el);
    vis.observe(el);
    return () => {
      pre.disconnect();
      vis.disconnect();
    };
  }, [item.video]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible && canPlay) v.play().catch(() => {});
    else v.pause();
  }, [visible, canPlay, near]);

  const ratio = item.aspectRatio || PH_RATIOS[hash(item.slug) % PH_RATIOS.length];
  const hasMedia = !!(item.video || item.poster);

  return (
    <a
      ref={ref}
      href={`/p/${item.slug}/`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(item.slug);
      }}
      className="group mb-5 block break-inside-avoid animate-fadeUp rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-4 focus-visible:ring-offset-white sm:mb-6 dark:focus-visible:ring-white dark:focus-visible:ring-offset-neutral-950"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      aria-label={`${item.title} by ${item.handle}`}
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-inset ring-black/5 transition-[transform,box-shadow] duration-500 ease-out group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/[.06] dark:bg-neutral-900 dark:ring-white/5"
        style={{ aspectRatio: ratio.replace('/', ' / ') }}
      >
        {hasMedia ? (
          <>
            {item.poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.poster}
                alt=""
                loading={index < 8 ? 'eager' : 'lazy'}
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready && visible && canPlay ? 'opacity-0' : 'opacity-100'}`}
              />
            )}
            {item.video && near && (
              <video
                ref={videoRef}
                src={item.video}
                muted
                loop
                playsInline
                preload="metadata"
                onPlaying={() => setReady(true)}
                className="absolute inset-0 h-full w-full object-cover"
                aria-hidden
              />
            )}
          </>
        ) : (
          <Placeholder title={item.title} model={item.model} slug={item.slug} />
        )}
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className={`h-1.5 w-1.5 rounded-full ${MODEL_STYLE[item.model]?.dot ?? 'bg-white'}`} />
          {item.model}
        </span>
        {item.video && (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/45 p-1.5 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-1 pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-tight text-neutral-900 dark:text-neutral-100">{item.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-neutral-500 dark:text-neutral-400">{item.handle}</p>
        </div>
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            item.type === 'skill'
              ? 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
              : 'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400'
          }`}
        >
          {item.type === 'skill' ? 'Skill' : 'Prompt'}
        </span>
      </div>
    </a>
  );
}

export default memo(Card);
