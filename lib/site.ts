// Public site URL used for metadataBase, canonical/og:url, og:image, sitemap and robots.
// Defaults to the live Vercel deployment. To switch to a custom domain later, set
// NEXT_PUBLIC_SITE_URL (e.g. https://motionpromptgallery.com) in the Vercel project, or change DEFAULT_SITE_URL.
const DEFAULT_SITE_URL = 'https://motionpromptgallery.vercel.app';
const url = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');

export const SITE = {
  name: 'MotionPromptGallery',
  domain: new URL(url).host,
  url,
  ogImage: `${url}/og.png`,
  tagline: 'Motion graphics made with frontier AI models, next to the prompts that made them.',
  contactEmail: 'mikenevermis@gmail.com',
  curator: { name: 'Mike', handle: '@mikenevermiss', url: 'https://x.com/mikenevermiss' },
};
