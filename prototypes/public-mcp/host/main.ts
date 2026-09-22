import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { HOST_ORIGIN, MCP_URL, PROFILE_RESOURCE_URI } from "../src/contracts";

if (window.location.origin !== HOST_ORIGIN) throw new Error("Local harness origin required.");
const status = document.getElementById("status")!;
const iframe = document.getElementById("frame") as HTMLIFrameElement;
const form = document.getElementById("load") as HTMLFormElement;
const reference = document.getElementById("reference") as HTMLInputElement;
const themeButton = document.getElementById("theme") as HTMLButtonElement;
let theme: "light" | "dark" = "light";
let sequence = 0;
let calls = 0;

async function start() {
  const client = new Client({ name: "Proper Respect local MCP Apps harness", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
  const tools = await client.listTools();
  if (!tools.tools.some(tool => tool.name === "get_public_profile")) throw new Error("Public profile tool is unavailable.");
  const resource = await client.readResource({ uri: PROFILE_RESOURCE_URI });
  const item = resource.contents.find(entry => entry.uri === PROFILE_RESOURCE_URI && "text" in entry);
  if (!item || !("text" in item)) throw new Error("Public collection HTML is unavailable.");
  const bridge = new AppBridge(null, { name: "Proper Respect local harness", version: "0.1.0" }, {
    openLinks: {}, serverTools: client.getServerCapabilities()?.tools, serverResources: client.getServerCapabilities()?.resources,
  }, { hostContext: { theme, platform: "web", displayMode: "inline", availableDisplayModes: ["inline"], containerDimensions: { maxHeight: 12000 } } });
  bridge.onopenlink = async ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return { isError: true };
    const link = document.createElement("a");
    link.href = parsed.href;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.textContent = "Open approved source: " + parsed.href;
    document.getElementById("links")!.replaceChildren(link);
    status.textContent = "Source link received through the SDK bridge. Open it above.";
    return {};
  };
  bridge.oncalltool = async params => {
    if (params.name !== "get_public_profile" && params.name !== "get_public_site_guide") throw new Error("Tool is not allowed.");
    calls++;
    status.textContent = "Widget requested an actual server read (" + calls + ").";
    const result = await client.callTool(params);
    status.textContent = "Widget server read completed (" + calls + ").";
    status.dataset.completedReads = String(calls);
    return result;
  };
  bridge.onlistresources = params => client.listResources(params);
  bridge.onreadresource = params => {
    if (params.uri !== PROFILE_RESOURCE_URI) throw new Error("Resource is not allowed.");
    return client.readResource(params);
  };
  bridge.onsizechange = ({ height }) => { iframe.style.height = Math.min(12000, Math.max(500, height ?? 900)) + "px"; };
  const initialized = new Promise<void>(resolve => { bridge.oninitialized = () => resolve(); });
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Sandbox did not start.")), 10000);
    const onReady = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.origin === "http://127.0.0.1:8850" && event.data?.method === "ui/notifications/sandbox-proxy-ready") {
        clearTimeout(timeout); window.removeEventListener("message", onReady); resolve();
      }
    };
    window.addEventListener("message", onReady);
  });
  iframe.src = "http://127.0.0.1:8850/sandbox.html";
  await ready;
  await bridge.sendSandboxResourceReady({ html: item.text, csp: { connectDomains: [], resourceDomains: [] } });
  await Promise.race([initialized, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("App handshake timed out.")), 10000))]);
  async function load() {
    const ticket = ++sequence;
    status.textContent = "Reading one public profile…";
    try {
      const args = { profileReference: reference.value };
      await bridge.sendToolInput({ arguments: args });
      const result = await client.callTool({ name: "get_public_profile", arguments: args });
      if (ticket !== sequence) return;
      await bridge.sendToolResult(result);
      status.textContent = result.isError ? "The server returned a public-read error." : "Public snapshot delivered through the SDK bridge.";
    } catch {
      if (ticket === sequence) { await bridge.sendToolCancelled({ reason: "Public read could not complete." }); status.textContent = "Public read could not complete."; }
    }
  }
  form.addEventListener("submit", event => { event.preventDefault(); void load(); });
  themeButton.addEventListener("click", () => {
    theme = theme === "light" ? "dark" : "light";
    themeButton.textContent = theme === "light" ? "Use dark theme" : "Use light theme";
    void bridge.sendHostContextChange({ theme });
  });
  window.addEventListener("pagehide", () => { void bridge.close(); void client.close(); });
  await load();
}
void start().catch(error => { status.textContent = error instanceof Error ? error.message : "Local harness could not connect."; });
