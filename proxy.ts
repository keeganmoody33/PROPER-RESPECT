import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { homepageRepresentation } from "@/src/server/homepage-representation";
import { classifyUserAgent, isCountablePageRequest } from "@/src/server/request-tally";
import { recordHit } from "@/src/server/tally-store";

const clerkRoute = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware((_auth, request) => homepageRepresentation(request))
  : null;

/** Counts the page request for the footer tally (without delaying it), then routes as before. */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (typeof event?.waitUntil === "function" && isCountablePageRequest(request.method, request.nextUrl.pathname, request.headers)) {
    event.waitUntil(recordHit(classifyUserAgent(request.headers.get("user-agent"))));
  }
  return clerkRoute ? clerkRoute(request, event) : homepageRepresentation(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
