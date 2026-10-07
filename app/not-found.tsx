import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-40 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">This piece isn&apos;t here.</h1>
      <p className="mt-3 text-neutral-500">It may have been removed at the creator&apos;s request.</p>
      <Link href="/" className="mt-8 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
        Back to the gallery
      </Link>
    </main>
  );
}
