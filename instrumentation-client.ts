import posthog from "posthog-js";
import { isPrivateReplayPath } from "@/src/client/analytics";

// One shared PostHog project (groundskeep) serves every lecturesfrom LLC site.
// NEXT_PUBLIC_POSTHOG_API_HOST becomes https://flow.proper-respect.com once the
// managed proxy CNAME is live. It is not NEXT_PUBLIC_POSTHOG_HOST, which the
// Vercel PostHog integration manages for a different project.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function syncReplay(pathname: string) {
  if (isPrivateReplayPath(pathname)) posthog.stopSessionRecording();
  else posthog.startSessionRecording();
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
      session_recording: { maskAllInputs: true },
      loaded: client => {
        client.register({ site: "proper-respect" });
        syncReplay(window.location.pathname);
      },
    });
  } catch {
    // Analytics must never break the app.
  }
}

export function onRouterTransitionStart(url: string) {
  if (!key) return;
  try {
    syncReplay(new URL(url, window.location.origin).pathname);
  } catch {
    // ignore
  }
}
