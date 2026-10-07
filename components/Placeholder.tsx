import { hash, MODEL_STYLE } from '@/lib/format';

/** Intentional, generative cover for pieces with no published video or poster. */
export default function Placeholder({ title, model, slug, large = false }: { title: string; model: string; slug: string; large?: boolean }) {
  const h = hash(slug);
  const base = MODEL_STYLE[model]?.hue ?? 220;
  const a = (base + (h % 40) - 20 + 360) % 360;
  const b = (a + 40 + (h % 60)) % 360;
  const x = 20 + (h % 60);
  const y = 15 + ((h >> 8) % 60);
  return (
    <div
      className="relative flex h-full w-full items-end overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at ${x}% ${y}%, hsl(${a} 85% 72% / .95), transparent 60%), radial-gradient(100% 80% at ${100 - x}% ${100 - y}%, hsl(${b} 80% 60% / .9), transparent 65%), linear-gradient(135deg, hsl(${a} 30% 14%), hsl(${b} 35% 10%))`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[.18] mix-blend-overlay"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className={`relative w-full ${large ? 'p-8' : 'p-4'} text-white`}>
        <p className={`font-mono uppercase tracking-[.18em] text-white/70 ${large ? 'text-xs' : 'text-[10px]'}`}>{model} · no preview</p>
        <p className={`mt-1.5 font-semibold leading-tight tracking-tight ${large ? 'text-3xl' : 'line-clamp-3 text-lg'}`}>{title}</p>
      </div>
    </div>
  );
}
