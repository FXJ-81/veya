"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#08080f", color: "#f8f8ff", fontFamily: "system-ui", padding: 24 }}>
        <h1 style={{ color: "#f87171" }}>Application error</h1>
        <pre style={{ background: "rgba(0,0,0,0.4)", padding: 16, borderRadius: 8, overflow: "auto" }}>
          {error.message}
        </pre>
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: "12px 24px", background: "#5b6ef5", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
