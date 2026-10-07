import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Gallery from '@/components/Gallery';
import { getItem, getItems, getLiteItems } from '@/lib/items';
import { SITE } from '@/lib/site';
import { formatDate } from '@/lib/format';

export const dynamicParams = false;

export function generateStaticParams() {
  return getItems().map((i) => ({ slug: i.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const it = getItem(slug);
  if (!it) return {};
  const excerpt = it.prompt.replace(/\s+/g, ' ').trim().slice(0, 155);
  const title = `${it.title} by ${it.handle}`;
  const description = `${it.model} ${it.type} · ${excerpt}${it.prompt.length > 155 ? '…' : ''}`;
  const image = it.poster || '/og.png';
  const url = `/p/${it.slug}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    authors: [{ name: it.creatorName, url: it.postUrl }],
    openGraph: {
      type: 'article',
      siteName: SITE.name,
      url,
      title,
      description,
      images: [{ url: image, alt: it.title }],
      ...(it.video ? { videos: [{ url: new URL(it.video, SITE.url).toString(), type: 'video/mp4' }] } : {}),
      ...(it.postedAt ? { publishedTime: it.postedAt } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function ItemPage({ params }: Params) {
  const { slug } = await params;
  const it = getItem(slug);
  if (!it) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': it.video ? 'VideoObject' : 'CreativeWork',
    name: it.title,
    description: it.prompt.slice(0, 300),
    creator: { '@type': 'Person', name: it.creatorName, url: it.postUrl },
    ...(it.postedAt ? { datePublished: it.postedAt, uploadDate: it.postedAt } : {}),
    ...(it.poster ? { thumbnailUrl: new URL(it.poster, SITE.url).toString() } : {}),
    ...(it.video ? { contentUrl: new URL(it.video, SITE.url).toString() } : {}),
    isBasedOn: it.postUrl,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Crawlable summary for the piece; the interactive modal renders on top of the gallery. */}
      <article className="sr-only">
        <h1>{it.title}</h1>
        <p>
          By {it.creatorName} ({it.handle}). Model: {it.model}. Posted {formatDate(it.postedAt) ?? 'date unknown'}. Original post: <a href={it.postUrl}>{it.postUrl}</a>
        </p>
        <pre>{it.prompt}</pre>
      </article>
      <Gallery items={getLiteItems()} initialSlug={it.slug} initialFull={{ prompt: it.prompt, code: it.code ?? null, sourceNote: it.sourceNote ?? null }} />
    </>
  );
}
