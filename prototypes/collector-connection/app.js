"use strict";

const providerNames = { codex: "Codex", cursor: "Cursor" };
const contextNames = { PERSONAL: "Personal", WORK: "Work" };
const metricNames = {
  modernTotalTokens: "Codex response tokens",
  legacyObservedIncrease: "Legacy observed increase",
  cursorTokens: "Native total tokens",
  cursorRequests: "Native requests",
  cursorSourceCostUsd: "Source usage-cost estimate",
};
const elements = {
  form: document.getElementById("connect-form"),
  provider: document.getElementById("provider"),
  context: document.getElementById("context"),
  activity: document.getElementById("activity"),
  connections: document.getElementById("connections"),
  count: document.getElementById("connection-count"),
  empty: document.getElementById("empty-state"),
  storage: document.getElementById("storage-state"),
  restartState: document.getElementById("restart-state"),
  restart: document.getElementById("restart"),
  dialog: document.getElementById("approval-dialog"),
  approve: document.getElementById("approve"),
  cancel: document.getElementById("cancel-approval"),
  source: document.getElementById("approval-source"),
  accountContext: document.getElementById("approval-context"),
  window: document.getElementById("approval-window"),
  access: document.getElementById("approval-access"),
};
let pending = null;
let busy = false;
let currentState = null;
const previewSelections = new Map();

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNumericValue(value) {
  return value === null || typeof value === "string" && /^(0|[1-9][0-9]{0,127})(\.[0-9]{1,18})?$/.test(value);
}

function isWindow(value) {
  return isRecord(value) && typeof value.start === "string" && typeof value.end === "string" &&
    Number.isFinite(Date.parse(value.start)) && Number.isFinite(Date.parse(value.end)) && value.start < value.end;
}

function parseState(value) {
  if (!isRecord(value) || value.fixture !== true || !isRecord(value.persistence) ||
      value.persistence.kind !== "sqlite" || !Array.isArray(value.connections) || value.connections.length > 64) {
    throw new Error("Invalid fixture state.");
  }
  for (const connection of value.connections) {
    if (!isRecord(connection) || typeof connection.id !== "string" || connection.id.length > 128 ||
        !Object.hasOwn(providerNames, connection.provider) || !Object.hasOwn(contextNames, connection.context) ||
        !["ACTIVE", "REVOKED", "EXPIRED"].includes(connection.status) || !isWindow(connection.window) ||
        !isRecord(connection.metrics) || !Object.keys(metricNames).every(key => isNumericValue(connection.metrics[key])) ||
        !Number.isSafeInteger(connection.receiptCount) || connection.receiptCount < 0 ||
        connection.lastSyncedAt !== null && (typeof connection.lastSyncedAt !== "string" || !Number.isFinite(Date.parse(connection.lastSyncedAt)))) {
      throw new Error("Invalid fixture connection.");
    }
  }
  if (new Set(value.connections.map(connection => connection.id)).size !== value.connections.length) throw new Error("Duplicate fixture connection.");
  return value;
}

async function request(path, body) {
  const response = await fetch(path, body === undefined ? { credentials: "same-origin" } : {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Fixture operation failed.");
  return response.json();
}

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function formatNumber(value) {
  if (value === null) return "Not available";
  const [integer, fraction] = value.split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
}

function formatMetric(key, value) {
  if (value === null) return "Not available";
  return (key === "cursorSourceCostUsd" ? "$" : "") + formatNumber(value);
}

function windowLabel(window) {
  return `${window.start.slice(0, 10)} to ${window.end.slice(0, 10)} UTC · end exclusive`;
}

function setBusy(value) {
  busy = value;
  elements.form.querySelectorAll("button, select").forEach(control => { control.disabled = value; });
  elements.connections.querySelectorAll("button").forEach(control => {
    control.disabled = value || control.dataset.requiresActive === "true" && control.dataset.active !== "true";
  });
  elements.approve.disabled = value;
  elements.restart.disabled = value || currentState === null;
}

async function operation(action, successMessage) {
  if (busy) return;
  setBusy(true);
  try {
    await action();
    await refresh();
    elements.activity.textContent = successMessage;
  } catch {
    elements.activity.textContent = "The fixture operation could not finish. Accepted results remain in the private store. Try again.";
  } finally {
    setBusy(false);
  }
}

function addMetric(parent, connection, key, note) {
  const block = node("div", "metric");
  block.append(node("p", "metric-label", metricNames[key]));
  const value = node("strong", `metric-value${connection.metrics[key] === null ? " unknown" : ""}`, formatMetric(key, connection.metrics[key]));
  value.dataset.testid = key;
  block.append(value, node("p", "metric-note", note));
  parent.append(block);
}

function addAction(parent, connection, label, endpoint, successMessage, className) {
  const button = node("button", `button ${className}`, label);
  button.type = "button";
  button.dataset.requiresActive = "true";
  button.dataset.active = String(connection.status === "ACTIVE");
  button.disabled = busy || connection.status !== "ACTIVE";
  button.addEventListener("click", () => operation(() => request(endpoint, { connectionId: connection.id }), successMessage));
  parent.append(button);
}

function sharingControls(connection) {
  const details = node("details", "sharing");
  details.append(node("summary", "", "Choose preview fields"));
  details.append(node("p", "small-copy", "Choose the exact quantities you would show. Selections stay in this page and are cleared on reload."));
  const keys = connection.provider === "codex" ? ["modernTotalTokens", "legacyObservedIncrease"] : ["cursorTokens", "cursorRequests", "cursorSourceCostUsd"];
  const chosen = previewSelections.get(connection.id) ?? new Set();
  previewSelections.set(connection.id, chosen);
  const fields = node("div", "sharing-fields");
  const preview = node("div", "share-preview");
  preview.dataset.testid = "share-preview";
  const update = () => {
    preview.replaceChildren(node("strong", "", "Preview only, nothing published"));
    preview.append(node("p", "", "Synthetic fixture · partial history · unverified provider identity"));
    if (!chosen.size) {
      preview.append(node("p", "", "No measurement fields selected."));
      return;
    }
    const list = node("ul");
    for (const key of keys) {
      if (chosen.has(key)) list.append(node("li", "", `${metricNames[key]}: ${formatMetric(key, connection.metrics[key])}`));
    }
    preview.append(list);
  };
  for (const key of keys) {
    const label = node("label");
    const checkbox = node("input");
    checkbox.type = "checkbox";
    checkbox.checked = chosen.has(key);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) chosen.add(key); else chosen.delete(key);
      update();
    });
    label.append(checkbox, node("span", "", metricNames[key]));
    fields.append(label);
  }
  update();
  details.append(fields, preview);
  return details;
}

function connectionCard(connection) {
  const article = node("article", "connection-card");
  article.dataset.connectionId = connection.id;
  article.dataset.provider = connection.provider;
  article.dataset.context = connection.context;
  article.setAttribute("aria-label", `${providerNames[connection.provider]} ${contextNames[connection.context]} connection`);
  const heading = node("div", "card-heading");
  const product = node("div", "product-heading");
  const mark = node("span", "product-mark", connection.provider === "codex" ? ">_" : "↗");
  mark.setAttribute("aria-hidden", "true");
  const title = node("div");
  title.append(node("p", "eyebrow", `${contextNames[connection.context]} · synthetic source`), node("h3", "", providerNames[connection.provider]));
  product.append(mark, title);
  heading.append(product, node("span", "private-badge", "Private"));
  const status = node("div", "connection-status");
  const dot = node("span", `status-dot${connection.status === "ACTIVE" ? " active" : ""}`);
  dot.setAttribute("aria-hidden", "true");
  const phase = node("span", "", connection.status === "ACTIVE" ? "Approved · fixture connected" :
    connection.status === "EXPIRED" ? "Approval expired · history retained" : "Disconnected · history retained");
  phase.dataset.testid = "connection-phase";
  status.append(dot, phase, node("span", "coverage-label", "Partial history · provider identity unverified"));
  const metrics = node("div", "metrics");
  if (connection.provider === "codex") {
    addMetric(metrics, connection, "modernTotalTokens", "Native response usage. Replay identities counted once.");
    addMetric(metrics, connection, "legacyObservedIncrease", "Cumulative-counter increases. Kept separate from responses.");
  } else {
    addMetric(metrics, connection, "cursorTokens", "Source-native total from the complete supplied sample report.");
    addMetric(metrics, connection, "cursorRequests", "Unknown when the source supplies no request count.");
    addMetric(metrics, connection, "cursorSourceCostUsd", "Source usage-cost estimate in USD. Not an actual charge.");
  }
  const scope = node("p", "scope-line", windowLabel(connection.window));
  const actions = node("div", "card-actions");
  const row = node("div", "action-row");
  addAction(row, connection, "Sync again", "/fixture/sync", "Sync finished. Private results refreshed from the receiver.", "primary");
  addAction(row, connection, "Add synthetic update", "/fixture/update", "A synthetic source update was synced to the private record.", "secondary");
  addAction(row, connection, "Disconnect", "/fixture/disconnect", "Access revoked. New reads and sync are stopped; accepted private history is retained.", "text-button");
  const receipts = `${connection.receiptCount} committed review${connection.receiptCount === 1 ? "" : "s"}`;
  const saved = connection.lastSyncedAt === null ? "No acknowledged checkpoint yet." : "Acknowledged checkpoint saved in the companion.";
  actions.append(row, node("p", "receipt-note", `${receipts} · ${saved}`));
  article.append(heading, status, metrics, scope, actions, sharingControls(connection));
  return article;
}

function render(state) {
  currentState = state;
  elements.connections.replaceChildren(...state.connections.map(connectionCard));
  elements.empty.hidden = state.connections.length !== 0;
  elements.count.textContent = `${state.connections.length} source${state.connections.length === 1 ? "" : "s"}`;
  elements.storage.textContent = "Accepted history and pending delivery use private SQLite stores.";
  elements.restartState.textContent = state.persistence.restartVerified === true ?
    "Receiver and companion reopened. Accepted records survived this fixture restart." :
    "A process restart has not been checked in this run.";
  setBusy(busy);
}

async function refresh() {
  render(parseState(await request("/fixture/state")));
}

elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  const provider = elements.provider.value;
  const context = elements.context.value;
  setBusy(true);
  try {
    const response = await request("/fixture/connect", { provider, context });
    if (!isRecord(response) || typeof response.pairingId !== "string" || response.pairingId.length > 128 || !isWindow(response.window)) throw new Error("Invalid fixture pairing.");
    pending = { pairingId: response.pairingId, provider, context };
    elements.source.textContent = provider === "codex" ? "Codex local-history sample" : "Cursor supplied-report sample";
    elements.accountContext.textContent = contextNames[context];
    elements.window.textContent = windowLabel(response.window);
    elements.access.textContent = provider === "codex" ?
      "Read mixed sample rollout files locally; retain only allowlisted numeric usage and opaque response identities." :
      "Read the complete supplied sample report; retain native quantities and source usage-cost estimates.";
    elements.dialog.showModal();
    elements.cancel.focus();
    elements.activity.textContent = "Pairing requested. No source history is collected before approval.";
  } catch {
    elements.activity.textContent = "The fixture pairing request could not finish. No access was approved. Try again.";
  } finally {
    setBusy(false);
  }
});

elements.cancel.addEventListener("click", () => { elements.dialog.close(); });
elements.dialog.addEventListener("close", () => {
  pending = null;
  elements.form.querySelector("button").focus();
});
elements.approve.addEventListener("click", () => operation(async () => {
  if (pending === null) throw new Error("No pending request.");
  const approval = await request("/fixture/approve", { pairingId: pending.pairingId });
  if (!isRecord(approval) || typeof approval.connectionId !== "string") throw new Error("Invalid fixture approval.");
  elements.dialog.close();
  await request("/fixture/sync", { connectionId: approval.connectionId });
}, "Source approved and backfilled. Accepted numeric history is private."));

elements.restart.addEventListener("click", () => operation(() => request("/fixture/restart", {}),
  "Fixture receiver and companion reopened. Accepted results remain available."));

refresh().then(() => {
  elements.activity.textContent = "Ready. Choose a synthetic source to review its access request.";
}).catch(() => {
  elements.activity.textContent = "The local fixture receiver is unavailable. No source was read.";
});
