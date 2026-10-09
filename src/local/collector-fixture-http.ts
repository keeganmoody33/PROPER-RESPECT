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
  let ipv4Origin = "";
  let ipv6Origin = "";
  const originForHost = (host: string | undefined) => {
    if (host === new URL(ipv4Origin).host) return ipv4Origin;
    if (host === new URL(ipv6Origin).host) return ipv6Origin;
    return null;
  };
  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const origin = originForHost(request.headers.host);
      if (!origin || request.headers.origin !== undefined && request.headers.origin !== origin || request.headers["sec-fetch-site"] === "cross-site") throw new Error(fixedError);
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
  };
  const ipv4 = createServer(handler);
  const ipv6 = createServer(handler);
  ipv4.requestTimeout = 10_000; ipv4.headersTimeout = 10_000; ipv4.keepAliveTimeout = 1000;
  ipv6.requestTimeout = 10_000; ipv6.headersTimeout = 10_000; ipv6.keepAliveTimeout = 1000;
  const closeServer = (server: ReturnType<typeof createServer>) => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
  try {
    await new Promise<void>((resolve, reject) => { ipv4.once("error", reject); ipv4.listen({ port: input.port ?? 0, host: "127.0.0.1" }, resolve); });
    const address = ipv4.address();
    if (!address || typeof address === "string") throw new Error(fixedError);
    await new Promise<void>((resolve, reject) => { ipv6.once("error", reject); ipv6.listen({ port: address.port, host: "::1", ipv6Only: true }, resolve); });
    const ipv6Address = ipv6.address();
    if (!ipv6Address || typeof ipv6Address === "string" || ipv6Address.address !== "::1") throw new Error(fixedError);
    ipv4Origin = `http://127.0.0.1:${address.port}`;
    ipv6Origin = `http://[::1]:${address.port}`;
  } catch (error) {
    await closeServer(ipv4).catch(() => undefined);
    await closeServer(ipv6).catch(() => undefined);
    throw error instanceof Error && error.message === fixedError ? error : new Error(fixedError);
  }
  return {
    origin: ipv4Origin,
    ipv6Origin,
    boundHosts: ["127.0.0.1", "::1"] as const,
    close: async () => { await closeServer(ipv6); await closeServer(ipv4); },
  };
}

/** This transport intentionally refuses remote hosts, HTTPS and redirects. */
export function createCollectorFixtureTransport(input: { origin: string }): CollectorTransport {
  const url = new URL(input.origin);
  const loopbackHost = url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]";
  if (url.protocol !== "http:" || !loopbackHost || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash || input.origin !== url.origin) throw new Error("A loopback fixture origin is required.");
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
