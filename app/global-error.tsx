"use client";

// Replaces the root layout, so it brings its own document and no global CSS.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <head>
        <title>Proper Respect</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "48px 16px", maxWidth: "560px" }}>
        <main>
          <h1>Proper Respect didn’t load.</h1>
          <p>Your collection and your page are unchanged. Try again. If it keeps failing, come back in a few minutes.</p>
          <button onClick={retry} style={{ font: "inherit", padding: "8px 16px" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
