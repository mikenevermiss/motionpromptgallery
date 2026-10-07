import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { SITE } from '@/lib/site';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: AI motion graphics and the prompts behind them`, template: `%s · ${SITE.name}` },
  description: SITE.tagline,
  applicationName: SITE.name,
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.tagline,
    url: `${SITE.url}/`,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}`, type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.name,
    description: SITE.tagline,
    images: [{ url: SITE.ogImage, alt: `${SITE.name}: ${SITE.tagline}` }],
    site: SITE.curator.handle,
    creator: SITE.curator.handle,
  },
  icons: { icon: '/favicon.svg' },
  alternates: { canonical: `${SITE.url}/` },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem('mpg-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <a href="#gallery" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-neutral-900 focus:px-4 focus:py-2 focus:text-white">
          Skip to gallery
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
