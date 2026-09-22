const HOST_ORIGIN = "http://127.0.0.1:8849";
const SANDBOX_ORIGIN = "http://127.0.0.1:8850";
if (window.parent === window || new URL(document.referrer).origin !== HOST_ORIGIN || window.location.origin !== SANDBOX_ORIGIN) {
  throw new Error("The resource sandbox requires the local harness.");
}
try { void window.parent.document; throw new Error("Parent is not isolated"); }
catch (error) { if (!(error instanceof DOMException && error.name === "SecurityError")) throw error; }
const inner = document.createElement("iframe");
inner.title = "Public collection card panel";
inner.setAttribute("sandbox", "allow-scripts allow-same-origin");
document.body.append(inner);
let resourceLoaded = false;
window.addEventListener("message", event => {
  if (event.source === window.parent && event.origin === HOST_ORIGIN) {
    if (event.data?.method === "ui/notifications/sandbox-resource-ready") {
      if (resourceLoaded || typeof event.data.params?.html !== "string") return;
      resourceLoaded = true;
      inner.srcdoc = event.data.params.html;
    } else inner.contentWindow?.postMessage(event.data, SANDBOX_ORIGIN);
  } else if (event.source === inner.contentWindow && event.origin === SANDBOX_ORIGIN) {
    window.parent.postMessage(event.data, HOST_ORIGIN);
  }
});
window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/sandbox-proxy-ready", params: {} }, HOST_ORIGIN);
