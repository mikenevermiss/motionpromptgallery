import type { MetadataRoute } from 'next';
import { getItems } from '@/lib/items';
import { SITE } from '@/lib/site';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE.url}/`, changeFrequency: 'daily', priority: 1 }, ...getItems().map((i) => ({ url: `${SITE.url}/p/${i.slug}/`, lastModified: i.postedAt ?? undefined, priority: 0.7 }))];
}
