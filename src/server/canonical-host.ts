import { NextResponse, type NextRequest } from "next/server";
import { publicSiteOrigin } from "./public-site";

const HOST_BOUND_PREFIXES = ["/api/", "/trpc", "/__clerk"];

/**
 * The production Clerk instance serves only the public origin, so Clerk
 * rejects a page that loads on any other production host, such as the
 * project's vercel.app alias. Send those page requests to the public origin.
 */
export function canonicalHostRedirect(request: NextRequest): NextResponse | undefined {
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") return undefined;
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const { host, pathname, search } = request.nextUrl;
  if (HOST_BOUND_PREFIXES.some(prefix => pathname.startsWith(prefix))) return undefined;
  const origin = publicSiteOrigin();
  if (host === origin.host) return undefined;
  return NextResponse.redirect(new URL(pathname + search, origin), 308);
}
