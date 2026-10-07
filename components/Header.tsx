import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { SITE } from '@/lib/site';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/80 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-2" aria-label={`${SITE.name} home`}>
          <span aria-hidden className="relative inline-flex h-5 w-5 items-center justify-center">
            <span className="absolute inset-0 rounded-[6px] bg-neutral-900 transition-transform duration-500 group-hover:rotate-90 dark:bg-white" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-white dark:bg-neutral-900" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Motion<span className="text-neutral-400 dark:text-neutral-500">Prompt</span>Gallery
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <a
            href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Submit a piece to MotionPromptGallery')}`}
            className="hidden rounded-full px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:inline-flex dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            Submit a piece
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
