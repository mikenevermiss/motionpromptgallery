export function formatDate(d: string | null) {
  if (!d) return null;
  const t = Date.parse(d.length === 10 ? `${d}T00:00:00Z` : d);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(t);
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const MODEL_STYLE: Record<string, { dot: string; hue: number }> = {
  'Claude Opus 5.5': { dot: 'bg-orange-500', hue: 22 },
  'Kimi K3': { dot: 'bg-sky-500', hue: 205 },
  'Claude Fable 5': { dot: 'bg-violet-500', hue: 265 },
  'GPT-6 Astra': { dot: 'bg-emerald-500', hue: 155 },
};

export function postLabel(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h === 'x.com' || h === 'twitter.com') return 'View post';
    if (h === 'github.com') return 'View on GitHub';
    return 'View source';
  } catch {
    return 'View source';
  }
}
