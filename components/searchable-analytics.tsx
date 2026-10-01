export function SearchableAnalytics() {
  if (process.env.VERCEL_ENV !== "production") return null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "window.sa=window.sa||function(){(sa.q=sa.q||[]).push(arguments)}" }} />
      <script
        defer
        src="https://tracker.searchableanalytics.com/s.js"
        data-domain="proper-respect.com"
        data-site-token="pst_8cd07ae0c6361d5c9e6e4087"
        data-cookie="false"
      />
    </>
  );
}
