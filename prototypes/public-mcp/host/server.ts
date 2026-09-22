import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.PROPER_RESPECT_LOCAL_MCP !== "1" || ["VERCEL", "VERCEL_ENV", "CF_PAGES", "NETLIFY", "AWS_LAMBDA_FUNCTION_NAME", "K_SERVICE", "RENDER", "WEBSITE_INSTANCE_ID"].some(key => process.env[key] !== undefined)) {
  throw new Error("The MCP Apps harness is an explicitly enabled local-only prototype.");
}
const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), "host");
const hostCsp = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src http://127.0.0.1:8848; frame-src http://127.0.0.1:8850; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const sandboxCsp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:8849";
const servers = [8849, 8850].map(port => {
  const files: Record<string, string> = port === 8849
    ? { "/": "index.html", "/index.html": "index.html", "/main.js": "main.js" }
    : { "/sandbox.html": "sandbox.html", "/sandbox.js": "sandbox.js" };
  const server = createServer(async (request, response) => {
    if (request.headers.host !== "127.0.0.1:" + port) { response.writeHead(403); response.end("Invalid host."); return; }
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return; }
    const file = files[request.url ?? ""];
    if (!file) { response.writeHead(404); response.end("Not found."); return; }
    try {
      const bytes = await readFile(path.join(directory, file));
      response.writeHead(200, {
        "Content-Type": file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
        "Content-Security-Policy": port === 8849 ? hostCsp : sandboxCsp,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch { response.writeHead(500); response.end("Build the local host before starting it."); }
  });
  server.listen(port, "127.0.0.1");
  return server;
});
const stop = () => { servers.forEach(server => server.close()); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log("Local MCP Apps harness: http://127.0.0.1:8849/");
