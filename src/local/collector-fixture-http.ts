import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { chunkSchema, manifestSchema, COLLECTOR_LIMITS } from "../domain/collector-contract.ts";
import type { CollectorTransport } from "./collector-companion.ts";
import type { CollectorOwner, CollectorService } from "./collector-service.ts";

const authSchema = z.strictObject({ connectionId: z.string().min(1).max(128), credential: z.string().min(32).max(256) });
const stageSchema = authSchema.extend({ chunk: chunkSchema });
const commitSchema = authSchema.extend({ manifest: manifestSchema });
const MAX_HTTP_BYTES = COLLECTOR_LIMITS.chunkBytes + 1024;
const fixedError = "Local fixture request rejected.";
const authorized = (actual: string | undefined, expected: string) => actual !== undefined && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers["content-type"] !== "application/json" || request.headers["content-encoding"] !== undefined) throw new Error(fixedError);
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of request) {
    if (!Buffer.isBuffer(chunk)) throw new Error(fixedError);
    bytes += chunk.length;
    if (bytes > MAX_HTTP_BYTES) throw new Error(fixedError);
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(value));
}

/** A loopback-only synthetic owner boundary. It is deliberately not Clerk authentication. */
export async function startCollectorFixtureHttp(input: {
  service: () => CollectorService;
  owner: CollectorOwner;
  ownerToken: string;
  port?: number;
  assetsDirectory?: string;
  action?: (path: string, body: unknown) => Promise<unknown>;
  state?: () => Promise<unknown>;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.ownerToken)) throw new Error(fixedError);
  let origin = "";
  const server = createServer(async (request, response) => {
    try {
      if (request.headers.host !== new URL(origin).host || request.headers.origin !== undefined && request.headers.origin !== origin || request.headers["sec-fetch-site"] === "cross-site") throw new Error(fixedError);
      const url = new URL(request.url ?? "/", origin);
      if (url.search || url.hash) throw new Error(fixedError);
      const path = url.pathname;
      if (request.method === "GET" && input.assetsDirectory && ["/", "/app.js", "/style.css"].includes(path)) {
        const file = path === "/" ? "index.html" : path.slice(1);
        const bytes = await readFile(join(input.assetsDirectory, file));
        response.writeHead(200, {
          "content-type": file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html",
          "cache-control": "no-store", "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          ...(path === "/" ? { "set-cookie": `fixture-owner=${input.ownerToken}; HttpOnly; SameSite=Strict; Path=/` } : {}),
        });
        response.end(bytes); return;
      }
      const ownerAuthorized = authorized(request.headers.authorization, `Bearer ${input.ownerToken}`) || authorized(request.headers.cookie, `fixture-owner=${input.ownerToken}`);
      if (path.startsWith("/fixture/")) {
        if (!ownerAuthorized) throw new Error(fixedError);
        if (path === "/fixture/state" && request.method === "GET" && input.state) { sendJson(response, 200, await input.state()); return; }
        if (request.method !== "POST" || !input.action) throw new Error(fixedError);
        sendJson(response, 200, await input.action(path, await readJson(request))); return;
      }
      if (request.method !== "POST") throw new Error(fixedError);
      const body = await readJson(request);
      switch (path) {
        case "/collector/grant": sendJson(response, 200, await input.service().getGrant(authSchema.parse(body))); break;
        case "/collector/chunk": sendJson(response, 200, await input.service().stageChunk(stageSchema.parse(body))); break;
        case "/collector/commit": sendJson(response, 200, await input.service().commitReview(commitSchema.parse(body))); break;
        case "/collector/delivery-status": sendJson(response, 200, await input.service().deliveryStatus(commitSchema.parse(body))); break;
        default: throw new Error(fixedError);
      }
    } catch { if (!response.headersSent) sendJson(response, 400, { error: fixedError }); else response.destroy(); }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 1000;
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(input.port ?? 0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") { server.close(); throw new Error(fixedError); }
  origin = `http://127.0.0.1:${address.port}`;
  return { origin, close: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }) };
}

/** This transport intentionally refuses remote hosts, HTTPS and redirects. */
export function createCollectorFixtureTransport(input: { origin: string }): CollectorTransport {
  const url = new URL(input.origin);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash || input.origin !== url.origin) throw new Error("A loopback fixture origin is required.");
  const post = async (path: string, body: unknown, signal?: AbortSignal): Promise<unknown> => {
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > MAX_HTTP_BYTES) throw new Error(fixedError);
    const deadline = AbortSignal.timeout(10_000);
    const response = await fetch(`${input.origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: encoded,
      redirect: "error", signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    if (!response.ok || !response.body) throw new Error(fixedError);
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) { const result = await reader.read(); if (result.done) break; bytes += result.value.length; if (bytes > MAX_HTTP_BYTES) throw new Error(fixedError); chunks.push(result.value); }
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    } finally { await reader.cancel(); }
  };
  return {
    getGrant: ({ signal, ...body }) => post("/collector/grant", body, signal),
    stageChunk: ({ signal, ...body }) => post("/collector/chunk", body, signal),
    commitReview: ({ signal, ...body }) => post("/collector/commit", body, signal),
    deliveryStatus: ({ signal, ...body }) => post("/collector/delivery-status", body, signal),
  };
}
