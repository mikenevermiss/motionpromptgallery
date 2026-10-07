import { SITE } from '@/lib/site';

export default function Footer() {
  const removal = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Removal request: MotionPromptGallery')}`;
  const submit = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Submit a piece to MotionPromptGallery')}&body=${encodeURIComponent('Link to the original post:\nModel used:\nPrompt or skill link:\n')}`;
  return (
    <footer className="mt-24 border-t border-neutral-200/70 dark:border-neutral-800/70">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-12 text-sm text-neutral-500 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-10 dark:text-neutral-400">
        <div className="max-w-xl space-y-3">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">Credits</p>
          <p>
            Every piece in this gallery belongs to its creator. Each entry credits the person who made it and links to the original post or source.
            Prompts are reproduced so people can learn from them. We don&apos;t claim ownership of any video, image, prompt or code.
          </p>
          <p>
            If you made something here and want it changed or removed, or you want to add a piece,{' '}
            <a className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 dark:text-white dark:decoration-neutral-700 dark:hover:decoration-white" href={removal}>
              request removal
            </a>{' '}
            or{' '}
            <a className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 dark:text-white dark:decoration-neutral-700 dark:hover:decoration-white" href={submit}>
              submit a piece
            </a>
            .
          </p>
        </div>
        <div className="space-y-3 md:text-right">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{SITE.name}</p>
          <p>
            Curated by{' '}
            <a className="text-neutral-900 hover:underline dark:text-white" href={SITE.curator.url} target="_blank" rel="noopener noreferrer">
              {SITE.curator.handle}
            </a>
          </p>
          <p className="text-xs">© {new Date().getFullYear()} {SITE.domain}</p>
        </div>
      </div>
    </footer>
  );
}
