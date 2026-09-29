import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return Response.json({ error: "Same-origin POST required." }, { status: 403 });
  }
  const { userId, sessionClaims, getToken } = await auth();
  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return Response.json(
      { error: "Convex is not configured." },
      { status: 503 },
    );
  }

  const client = await clerkClient();
  const oauthTokens = await client.users.getUserOauthAccessToken(
    userId,
    "oauth_github",
  );
  const githubToken = oauthTokens.data[0]?.token;
  const convexToken = sessionClaims?.aud === "convex"
    ? await getToken()
    : await getToken({ template: "convex" });
  if (!githubToken || !convexToken) {
    return Response.json(
      { error: "Link GitHub to your account before connecting it." },
      { status: 409 },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);
  try {
    const result = await convex.action(api.connectors.connectGithub, {
      token: githubToken,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof ConvexError && typeof error.data === "string" ? error.data : "";
    const limit = /^Too many GitHub connection attempts\. Try again in ([1-9]|[1-5][0-9]|60) minutes?\.$/.exec(message);
    if (limit) {
      return Response.json({ error: message }, {
        status: 429,
        headers: { "Retry-After": String(Number(limit[1]) * 60) },
      });
    }
    return Response.json({ error: "GitHub connection failed. Please try again." }, { status: 500 });
  }
}
