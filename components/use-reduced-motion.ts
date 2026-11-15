import { useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Whether a media query matches now; `assumed` stands in on the server and before the first client render. */
export function useMediaQuery(query: string, assumed: boolean): boolean {
  return useSyncExternalStore(
    listener => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => assumed,
  );
}

/** Whether the visitor asked for less motion. The server assumes they did, so nothing starts moving before the preference is known. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION, true);
}
