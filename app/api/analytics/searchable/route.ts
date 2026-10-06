import { SEARCHABLE_PUBLIC_PATH, SEARCHABLE_TRACKER_ORIGIN, searchablePublicPath } from "@/src/client/searchable-path";

export function GET(request: Request) {
  const pathname = searchablePublicPath(new URL(request.url).searchParams.get("path"));
  if (process.env.VERCEL_ENV !== "production" || pathname === null) return new Response(null, { status: 404 });

  const body = `<!doctype html><html><head><meta name="referrer" content="no-referrer"><title></title></head><body><script>
    const publicPath = new RegExp(${JSON.stringify(SEARCHABLE_PUBLIC_PATH)});
    const parentOrigin = location.origin;
    history.replaceState(null, "", ${JSON.stringify(pathname)});
    let started = false;
    addEventListener("message", event => {
      if (event.source !== parent || event.origin !== parentOrigin || event.data?.type !== "searchable-public-path") return;
      const pathname = event.data.pathname;
      if (typeof pathname !== "string" || !publicPath.test(pathname)) return;
      if (location.pathname !== pathname) history.replaceState(null, "", pathname);
      if (started) return;
      started = true;
      const tracker = document.createElement("script");
      tracker.src = "${SEARCHABLE_TRACKER_ORIGIN}/s.js";
      tracker.dataset.domain = "proper-respect.com";
      tracker.dataset.siteToken = "pst_8cd07ae0c6361d5c9e6e4087";
      tracker.dataset.cookie = "false";
      tracker.dataset.plugins = "-engagement,-scroll,-webvitals,-outbound,-ecommerce";
      document.head.appendChild(tracker);
    });
  </script></body></html>`;

  return new Response(body, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": `default-src 'none'; script-src 'unsafe-inline' ${SEARCHABLE_TRACKER_ORIGIN}; connect-src ${SEARCHABLE_TRACKER_ORIGIN}; frame-ancestors 'self'; sandbox allow-scripts`,
  } });
}
