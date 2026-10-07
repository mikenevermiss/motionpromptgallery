'use client';
export default function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      {message && (
        <div key={message + Date.now()} className="animate-pop rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-black/10 dark:bg-white dark:text-neutral-900">
          {message}
        </div>
      )}
    </div>
  );
}
