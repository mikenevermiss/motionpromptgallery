export type ItemType = 'prompt' | 'skill';

export interface Item {
  id: string;
  title: string;
  slug: string;
  model: string;
  type: ItemType;
  creatorName: string;
  handle: string;
  postUrl: string;
  postedAt: string | null;
  stack: string;
  prompt: string;
  code?: string | null;
  tags: string[];
  video: string | null;
  poster: string | null;
  aspectRatio: string | null;
  sourceNote?: string;
}

/** Light version shipped with every page; prompt/code are loaded on demand. */
export interface LiteItem extends Omit<Item, 'prompt' | 'code' | 'sourceNote'> {
  hasCode: boolean;
}

export const MODELS = ['Claude Opus 5.5', 'Kimi K3', 'Claude Fable 5', 'GPT-6 Astra'] as const;
