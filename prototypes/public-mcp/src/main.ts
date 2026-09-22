import { fileURLToPath } from "node:url";
import { assertLocalEnvironment, startLoopbackServer } from "./transport.js";
import { createPublicReader } from "./public-reader.js";
import { MCP_PORT } from "./contracts.js";

assertLocalEnvironment(process.env);
const http = await startLoopbackServer({ readProfile: createPublicReader(), widgetPath: fileURLToPath(new URL("./widget.html", import.meta.url)) });
console.log(`Local public MCP listening at http://127.0.0.1:${MCP_PORT}/mcp`);
const shutdown = () => { http.closeAllConnections(); http.close(); };
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
