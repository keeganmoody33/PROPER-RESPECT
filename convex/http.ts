import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_EVIDENCE_UPLOAD_BYTES, normalizeUploadMime } from "../src/domain/evidence-upload";

const http = httpRouter();
// Bearer authentication, never cookies: CORS does not grant access to an owner's ticket.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

http.route({ path: "/evidence-upload", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: cors })) });
http.route({
  path: "/evidence-upload", method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!await ctx.auth.getUserIdentity()) return response({ error: "Authentication required." }, 401);
    const ticketId = new URL(request.url).searchParams.get("ticket");
    if (!ticketId) return response({ error: "Upload unavailable." }, 404);
    let ticket;
    try {
      ticket = await ctx.runQuery(internal.onboarding.uploadTicket, { ticketId: ticketId as Id<"uploadTickets"> });
    } catch {
      return response({ error: "Upload unavailable or expired. Choose the file again." }, 404);
    }
    if (normalizeUploadMime(request.headers.get("Content-Type") ?? "") !== ticket.mimeType)
      return response({ error: "Upload content type changed." }, 400);
    const declared = request.headers.get("Content-Length");
    if (declared !== null && Number(declared) !== ticket.byteSize)
      return response({ error: "Upload size changed." }, 400);
    if (!request.body) return response({ error: "Empty upload." }, 400);
    const reader = request.body.getReader();
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > ticket.byteSize || length > MAX_EVIDENCE_UPLOAD_BYTES) {
          await reader.cancel();
          return response({ error: "Upload exceeds its declared size." }, 413);
        }
        parts.push(new Uint8Array(value));
      }
    } catch {
      return response({ error: "Upload interrupted. Retry the same file." }, 400);
    }
    if (length !== ticket.byteSize) return response({ error: "Upload size changed." }, 400);
    const blob = new Blob(parts, { type: ticket.mimeType });
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    if (ticket.storageId) {
      if (ticket.sha256 !== sha256) return response({ error: "Upload already used for different bytes." }, 409);
      return response({ storageId: ticket.storageId });
    }
    const created = await ctx.storage.store(blob);
    try {
      const storageId = await ctx.runMutation(internal.onboarding.bindUploadedFile, { ticketId: ticket._id, storageId: created, sha256 });
      // A concurrent identical retry may already have bound the ticket.
      if (storageId !== created) await ctx.storage.delete(created);
      return response({ storageId });
    } catch {
      await ctx.storage.delete(created);
      return response({ error: "Upload could not be bound to your account. Choose the file again." }, 409);
    }
  }),
});

export default http;
