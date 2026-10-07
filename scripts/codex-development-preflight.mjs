import { pathToFileURL } from "node:url";
export function summarizeDevelopmentEnvironment(env) {
  const deployment = "dev:utmost-mongoose-374", url = "https://utmost-mongoose-374.convex.cloud";
  const publicKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "", secretKey = env.CLERK_SECRET_KEY ?? "";
  let clerkHost = null;
  if (publicKey.startsWith("pk_test_")) {
    const decoded = Buffer.from(publicKey.slice(8), "base64").toString("utf8").replace(/\$$/, "");
    if (/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(decoded)) clerkHost = decoded;
  }
  return {
    targetMatches: env.CONVEX_DEPLOYMENT === deployment, urlMatches: env.NEXT_PUBLIC_CONVEX_URL === url,
    clerkPublicKeyPresent: Boolean(publicKey), clerkPublicKeyIsDevelopment: publicKey.startsWith("pk_test_"),
    clerkSecretPresent: Boolean(secretKey), clerkSecretIsDevelopment: secretKey.startsWith("sk_test_"),
    clerkSecretIsProduction: secretKey.startsWith("sk_live_"), clerkHost,
    matchingClerkAppVerified: false,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = summarizeDevelopmentEnvironment(process.env);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.targetMatches || !result.urlMatches || !result.clerkPublicKeyIsDevelopment || !result.clerkSecretIsDevelopment) process.exitCode = 1;
}
