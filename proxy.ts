import { clerkMiddleware } from "@clerk/nextjs/server";
import { homepageRepresentation } from "@/src/server/homepage-representation";

const proxy = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware((_auth, request) => homepageRepresentation(request))
  : homepageRepresentation;

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
