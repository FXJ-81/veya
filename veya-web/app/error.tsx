"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#08080f] flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h1>
      <pre className="bg-black/40 p-4 rounded-lg text-sm overflow-auto max-w-full mb-4">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#5b6ef5] rounded-lg font-medium"
      >
        Try again
      </button>
    </div>
  );
}
