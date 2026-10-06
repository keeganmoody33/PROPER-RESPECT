import posthog, { type CaptureResult } from "posthog-js";
import { isPrivateReplayPath, sanitizeAnalyticsEvent } from "@/src/client/analytics";

// One shared PostHog project (groundskeep) serves every lecturesfrom LLC site.
// NEXT_PUBLIC_POSTHOG_API_HOST becomes https://flow.proper-respect.com once the
// managed proxy CNAME is live. It is not NEXT_PUBLIC_POSTHOG_HOST, which the
// Vercel PostHog integration manages for a different project.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let resumeToken = 0;

function startReplayIfPublic() {
  if (!isPrivateReplayPath(window.location.pathname)) posthog.startSessionRecording();
}

/**
 * Resume replay only after the public destination has committed: the App
 * Router updates the URL after it renders the new route, so wait for the
 * pathname to match, then one more frame, before taking a snapshot.
 */
function resumeAfterCommit(destination: string) {
  const token = ++resumeToken;
  const deadline = performance.now() + 5000;
  const check = () => {
    if (token !== resumeToken) return;
    if (window.location.pathname === destination) {
      requestAnimationFrame(() => { if (token === resumeToken) startReplayIfPublic(); });
    } else if (performance.now() < deadline) {
      requestAnimationFrame(check);
    }
  };
  requestAnimationFrame(check);
}

if (key) {
  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_API_HOST ?? "https://us.i.posthog.com",
      ui_host: "https://us.posthog.com",
      defaults: "2026-05-30",
      capture_exceptions: true,
      // Tag bots as $browser_type=bot instead of dropping them (Humans vs Machines tally).
      opt_out_useragent_filter: true,
      // Fail closed: replay starts only once the route is known to be public.
      disable_session_recording: true,
      session_recording: { maskAllInputs: true },
      // Private routes send only a pageview collapsed to the route prefix.
      before_send: event => (event ? (sanitizeAnalyticsEvent(event) as CaptureResult | null) : null),
      loaded: client => {
        client.register({ site: "proper-respect" });
        startReplayIfPublic();
      },
    });
  } catch {
    // Analytics must never break the app.
  }
}

export function onRouterTransitionStart(url: string) {
  if (!key) return;
  try {
    const destination = new URL(url, window.location.origin).pathname;
    if (isPrivateReplayPath(destination)) {
      resumeToken++;
      posthog.stopSessionRecording();
    } else if (isPrivateReplayPath(window.location.pathname)) {
      // Leaving a private page: keep replay off until the public page has rendered.
      posthog.stopSessionRecording();
      resumeAfterCommit(destination);
    }
  } catch {
    // ignore
  }
}
