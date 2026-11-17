"use client";

// retry() fetches the segment again; reset() would only re-render what failed.
export default function CollectionError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="system-message">
      <p className="eyebrow">PRIVATE COLLECTION / UNAVAILABLE</p>
      <h1>Your collection didn’t load.</h1>
      <p>Your private collection and everything saved in it are unchanged. Try again. If it keeps failing, come back in a few minutes.</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </main>
  );
}
