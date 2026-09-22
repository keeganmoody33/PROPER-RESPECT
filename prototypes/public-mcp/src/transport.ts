import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createPublicMcpServer, type ServerDependencies } from "./server.js";
import { HOST_ORIGIN, MAX_REQUEST_BYTES, MCP_PORT } from "./contracts.js";

export function assertLocalEnvironment(env: Readonly<Record<string, string | undefined>>) {
  if (env.PROPER_RESPECT_LOCAL_MCP !== "1") throw new Error("Set PROPER_RESPECT_LOCAL_MCP=1 to start this loopback-only prototype.");
  if (["VERCEL", "VERCEL_ENV", "AWS_LAMBDA_FUNCTION_NAME", "CF_PAGES", "K_SERVICE", "WEBSITE_INSTANCE_ID", "NETLIFY", "RENDER"].some(key => env[key] !== undefined)) throw new Error("Hosted runtimes are not allowed for this local prototype.");
}
export function acceptedHeaders(host: string | undefined, origin: string | undefined, port: number) {
  return host === `127.0.0.1:${port}` && (origin === undefined || origin === HOST_ORIGIN);
}
export function boundedBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let rejected = false;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) { rejected = true; chunks.length = 0; reject(new RangeError("Request limit")); return; }
      chunks.push(chunk);
    });
    request.once("end", () => {
      if (rejected) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (cause) { reject(cause); }
    });
    request.once("error", reject);
    request.once("aborted", () => reject(new Error("Request aborted")));
  });
}
export async function startLoopbackServer(dependencies: ServerDependencies, options: { port?: number; env?: Readonly<Record<string, string | undefined>> } = {}) {
  assertLocalEnvironment(options.env ?? process.env);
  const requestedPort = options.port ?? MCP_PORT;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error("Invalid local port");
  const http = createHttpServer(async (request, response) => {
    const port = (http.address() as { port: number }).port;
    const origin = request.headers.origin;
    if (!acceptedHeaders(request.headers.host, origin, port)) { response.writeHead(403).end("Local origin required"); return; }
    if (request.url !== "/mcp") { response.writeHead(404).end("Not found"); return; }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Vary", "Origin");
    if (origin === HOST_ORIGIN) {
      response.setHeader("Access-Control-Allow-Origin", HOST_ORIGIN);
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, MCP-Protocol-Version, MCP-Session-Id, Accept");
      response.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");
    }
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.method !== "POST") { response.setHeader("Allow", "POST, OPTIONS"); response.writeHead(405).end("Only stateless MCP POST requests are supported"); return; }
    if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") { response.writeHead(415).end("JSON required"); return; }
    let body: unknown;
    try { body = await boundedBody(request); }
    catch (cause) { if (!response.destroyed) { response.setHeader("Connection", "close"); response.writeHead(cause instanceof RangeError ? 413 : 400).end("Invalid or oversized JSON request"); } return; }
    const server = createPublicMcpServer(dependencies);
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    response.once("close", () => { void transport.close().catch(() => {}); void server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch {
      if (!response.headersSent) response.writeHead(500).end("MCP request failed");
      else response.end();
    }
  });
  http.requestTimeout = 10_000;
  http.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => { http.once("error", reject); http.listen(requestedPort, "127.0.0.1", resolve); });
  return http;
}
