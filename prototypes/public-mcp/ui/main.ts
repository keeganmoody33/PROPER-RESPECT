import { App } from "@modelcontextprotocol/ext-apps";
import { publicToolResultSchema, type PublicProfileResult } from "../src/contracts";
import github from "./assets/github.svg";
import wispr from "./assets/wispr-flow.jpg";

const app = new App({ name: "Proper Respect public collection", version: "0.1.0" }, {});
const root = document.getElementById("root")!;
const logos: Record<string, string> = { github, "wispr-flow": wispr };
let current: PublicProfileResult | undefined;
let selected = 0;
let epoch = 0;
let busy = false;
let connected = false;
let error = "";
let guide = "";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text: string, key: string, action: () => void) {
  const control = el("button", text);
  control.type = "button";
  control.dataset.focus = key;
  control.addEventListener("click", action);
  return control;
}
function label(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase());
}
function values(value: unknown): HTMLElement {
  if (Array.isArray(value)) {
    const list = el("ul", undefined, "evidence-list");
    value.forEach(item => { const row = el("li"); row.append(values(item)); list.append(row); });
    if (value.length === 0) list.append(el("li", "None supplied"));
    return list;
  }
  if (value !== null && typeof value === "object") {
    const list = el("dl", undefined, "evidence-fields");
    for (const [key, item] of Object.entries(value)) {
      list.append(el("dt", label(key)));
      const definition = el("dd");
      if (Array.isArray(item) && item.length > 8) {
        const details = el("details");
        details.append(el("summary", item.length + " supplied observations"), values(item));
        definition.append(details);
      } else definition.append(values(item));
      list.append(definition);
    }
    return list;
  }
  return el("span", typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "Not supplied"));
}
function safeExternalUrl(raw: string): string | undefined {
  try { const url = new URL(raw); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
async function openSource(url: string) {
  const safeUrl = safeExternalUrl(url);
  if (!safeUrl) { error = "This source link is unavailable."; render(); return; }
  try {
    const response = await app.openLink({ url: safeUrl });
    if (response.isError) throw new Error("The host did not open this link.");
  } catch { error = "The host could not open the source. The source URL is shown below."; render(); }
}
function accept(payload: unknown) {
  const parsed = publicToolResultSchema.safeParse(payload);
  if (!parsed.success) { error = "The host returned an invalid public result. No new data was displayed."; return; }
  const result = parsed.data;
  if (result.kind === "error") { error = result.message; return; }
  error = "";
  if (result.kind === "guide") { guide = result.markdown; current = undefined; return; }
  current = result;
  guide = "";
  selected = Math.min(selected, Math.max(0, result.profile.cards.length - 1));
}
async function refresh() {
  if (!current || busy) return;
  const ticket = ++epoch;
  const sourceUrl = current.sourceUrl;
  busy = true;
  error = "";
  render();
  try {
    const result = await app.callServerTool({ name: "get_public_profile", arguments: { profileReference: sourceUrl } });
    if (ticket === epoch) accept(result.structuredContent);
  } catch {
    if (ticket === epoch) error = "Refresh could not complete. The previous public snapshot is still shown.";
  } finally {
    if (ticket === epoch) { busy = false; render(); }
  }
}
function render() {
  const focusKey = (document.activeElement as HTMLElement | null)?.dataset.focus;
  const main = el("main", undefined, "panel");
  const top = el("header", undefined, "panel-header");
  top.append(el("p", "PROPER RESPECT", "wordmark"), el("p", "Public collection", "eyebrow"));
  main.append(top);
  if (error) { const warning = el("p", error, "error"); warning.setAttribute("role", "alert"); main.append(warning); }
  if (!connected) main.append(el("p", "Connecting to the host…", "status"));
  else if (guide) main.append(el("h1", "A guide to Proper Respect"), el("pre", guide, "guide"));
  else if (!current) main.append(el("p", error ? "No public snapshot is displayed." : "Waiting for a public profile…", "status"));
  else {
    const profile = current.profile;
    if (current.dataMode === "synthetic") main.append(el("p", "Synthetic test data", "test-data-badge"));
    main.append(el("h1", profile.displayName), el("p", profile.bio, "bio"));
    if (profile.profileLinks.length || profile.nameLink) {
      const links = el("details");
      links.append(el("summary", "Shared profile links"), values({ profileLinks: profile.profileLinks, ...(profile.nameLink ? { nameLink: profile.nameLink } : {}) }));
      main.append(links);
    }
    const controls = el("div", undefined, "controls");
    const refreshButton = button(busy ? "Refreshing…" : "Refresh", "refresh", () => { void refresh(); });
    refreshButton.disabled = busy;
    controls.append(refreshButton, button("Open source ↗", "source", () => { void openSource(current!.sourceUrl); }));
    main.append(controls);
    const status = el("p", (error ? "Previous snapshot · " : "Public snapshot retrieved ") + current.retrievedAt, "receipt");
    status.setAttribute("role", "status");
    main.append(status);
    if (profile.emptyNote) main.append(el("p", profile.emptyNote, "empty"));
    if (profile.cards.length) {
      const nav = el("nav", undefined, "card-selector");
      nav.setAttribute("aria-label", "Choose a product card");
      profile.cards.forEach((card, index) => {
        const select = button(card.product.name, "card-" + index, () => { selected = index; render(); });
        select.setAttribute("aria-pressed", String(index === selected));
        nav.append(select);
      });
      main.append(nav);
      const card = profile.cards[selected];
      const presentation = current.presentation.find(item => item.cardIndex === selected);
      const article = el("article", undefined, "product-card");
      article.dataset.brand = presentation?.brandKey ?? "neutral";
      if (presentation?.background) article.style.backgroundColor = presentation.background;
      if (presentation?.foreground) article.style.color = presentation.foreground;
      const heading = el("div", undefined, "product-heading");
      const logo = presentation?.brandKey ? logos[presentation.brandKey] : undefined;
      if (logo) { const image = el("img"); image.src = logo; image.alt = ""; image.width = 52; image.height = 52; image.className = "product-logo"; heading.append(image); }
      const identity = el("div");
      identity.append(el("p", card.status + (card.ownerSelectedGoTo ? " · Owner-selected go-to" : ""), "eyebrow"), el("h2", card.product.name));
      heading.append(identity);
      article.append(heading, el("p", card.product.description, "description"), el("h3", card.headline));
      if (card.note !== card.headline) article.append(el("p", card.note));
      article.append(el("p", card.startedAt ? "Started " + card.startedAt : card.startDateNote ?? "Start date not supplied", "subtle"));
      if (card.activity) { const section = el("section"); section.append(el("h3", "Activity & evidence"), values(card.activity)); article.append(section); }
      else article.append(el("p", "No activity evidence supplied."));
      if (card.cost) { const section = el("section"); section.append(el("h3", "Shared cost"), values(card.cost)); article.append(section); }
      if (card.primaryLink) { const section = el("section"); section.append(el("h3", "Shared product link"), values(card.primaryLink)); article.append(section); }
      main.append(article);
    }
    main.append(el("p", "This is the owner's selected public record. Refresh reads the current publication; it does not sync a connected account.", "caveat"), el("p", current.sourceUrl, "source-url"));
  }
  root.replaceChildren(main);
  if (focusKey) Array.from(root.querySelectorAll<HTMLElement>("[data-focus]")).find(element => element.dataset.focus === focusKey)?.focus();
}

app.ontoolinput = () => { epoch++; busy = false; current = undefined; guide = ""; error = ""; render(); };
app.ontoolresult = result => { epoch++; busy = false; accept(result.structuredContent); render(); };
app.ontoolcancelled = () => { epoch++; busy = false; error = "The host cancelled the read. No new snapshot was loaded."; render(); };
app.onhostcontextchanged = context => { if (context.theme) document.documentElement.dataset.theme = context.theme; };
app.onerror = () => { error = "The connection to the host encountered a problem."; render(); };
app.onteardown = async () => { epoch++; return {}; };
render();
void app.connect().then(() => {
  connected = true;
  document.documentElement.dataset.theme = app.getHostContext()?.theme ?? "light";
  render();
}).catch(() => { error = "Unable to connect to the MCP Apps host."; render(); });
