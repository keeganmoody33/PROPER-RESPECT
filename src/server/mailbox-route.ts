import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { createMailboxOAuthConfig } from "./mailbox-oauth";
import { isMailboxScanMode, type MailboxScanMode } from "./mailbox-search";
const headers = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
function applicationOrigin() {
  const origin = process.env.MAILBOX_APPLICATION_ORIGIN;
  if (!origin) throw new Error("Configuration unavailable.");
  return new URL(createMailboxOAuthConfig({ provider: "GOOGLE", clientId: "route", applicationOrigin: origin, allowLoopbackHttp: process.env.MAILBOX_ALLOW_LOOPBACK_HTTP === "true" }).redirectUri).origin;
}
function error(status: number, message: string) { return Response.json({ error: message }, { status, headers }); }
async function client() {
  const { userId, sessionClaims, getToken } = await auth();
  if (!userId) return null;
  const token = sessionClaims?.aud === "convex"
    ? await getToken()
    : await getToken({ template: "convex" });
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Configuration unavailable.");
  const convex = new ConvexHttpClient(url);
  convex.setAuth(token);
  return convex;
}
async function intent(request: Request, required = false): Promise<{ accountId?: Id<"mailboxAccounts">; expectedGeneration?: number; mode?: MailboxScanMode }> {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new Error("Invalid request.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) { await reader.cancel(); throw new Error("Invalid request."); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  if (form.getAll("accountId").length > 1 || form.getAll("expectedGeneration").length > 1 || form.getAll("mode").length > 1) throw new Error("Invalid request.");
  const accountId = form.get("accountId");
  const generation = form.get("expectedGeneration");
  if (!accountId && !generation && !required) return {};
  if (!accountId || accountId.length > 128 || !generation || !/^[1-9]\d*$/.test(generation) || !Number.isSafeInteger(Number(generation))) throw new Error("Invalid request.");
  const mode = form.get("mode");
  if (mode !== null && (!required || !isMailboxScanMode(mode))) throw new Error("Invalid request.");
  return { accountId: accountId as Id<"mailboxAccounts">, expectedGeneration: Number(generation),
    ...(mode ? { mode } : {}) };
}
function sameOrigin(request: Request, origin: string) {
  return request.method === "POST" && request.headers.get("origin") === origin &&
    (!request.headers.has("sec-fetch-site") || request.headers.get("sec-fetch-site") === "same-origin");
}
export async function mailboxStart(request: Request) {
  try {
    if (!sameOrigin(request, applicationOrigin())) return error(403, "Same-origin POST required.");
    const convex = await client();
    if (!convex) return error(401, "Authentication required.");
    const result = await convex.action(api.mailboxGoogle.start, await intent(request));
    return new Response(null, { status: 303, headers: { ...headers, location: result.url } });
  } catch { return error(400, "Gmail connection could not start. Check configuration and try again."); }
}
export async function mailboxCallback(request: Request) {
  let origin: string;
  try { origin = applicationOrigin(); }
  catch { return error(503, "Gmail connection is not configured."); }
  let status = "failed";
  try {
    const convex = await client();
    if (convex) {
      await convex.action(api.mailboxGoogle.callback, { query: new URL(request.url).search.slice(1) });
      status = "connected";
    }
  } catch { /* Only a fixed status escapes, never OAuth/provider error details. */ }
  return new Response(null, { status: 303, headers: { ...headers, location: `${origin}/onboarding?gmail=${status}` } });
}
export async function mailboxRead(request: Request) {
  try {
    if (!sameOrigin(request, applicationOrigin())) return error(403, "Same-origin POST required.");
    const convex = await client();
    if (!convex) return error(401, "Authentication required.");
    const args = await intent(request, true);
    if (!args.accountId || !args.expectedGeneration) return error(400, "Mailbox required.");
    const result = await convex.action(api.mailboxGoogle.read, { accountId: args.accountId, expectedGeneration: args.expectedGeneration,
      ...(args.mode ? { mode: args.mode } : {}) });
    return Response.json(result, { headers });
  } catch { return error(400, "Gmail read failed. Check account status and retry or reconnect."); }
}
