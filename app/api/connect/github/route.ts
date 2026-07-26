import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST() {
  const { userId, getToken } = await auth();
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
  const convexToken = await getToken({ template: "convex" });
  if (!githubToken || !convexToken) {
    return Response.json(
      { error: "Link GitHub to your account before connecting it." },
      { status: 409 },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);
  const result = await convex.action(api.connectors.connectGithub, {
    token: githubToken,
  });
  return Response.json(result);
}
