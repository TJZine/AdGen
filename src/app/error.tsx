'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans p-10 flex items-center justify-center">
      <main className="w-full max-w-lg border border-zinc-200 bg-white rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-950">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          The action could not be completed. Try again, or check the server logs if the problem persists.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs font-mono text-zinc-500">Error reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 px-4 py-2 bg-zinc-950 text-white rounded text-sm font-semibold hover:bg-zinc-800 transition"
        >
          Try again
        </button>
      </main>
    </div>
  );
}
