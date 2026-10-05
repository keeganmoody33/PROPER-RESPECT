// PostHog session replay stays off on signed-in and auth routes: the private
// collection, evidence and sign-in forms never leave the browser as recordings.
const PRIVATE_REPLAY_PREFIXES = ["/app", "/sign-in", "/sign-up", "/onboarding"];

export function isPrivateReplayPath(pathname: string): boolean {
  return PRIVATE_REPLAY_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
