import { isValidElement, type ReactElement } from "react";
import { expect, it, vi } from "vitest";
import { FirstResultPanel } from "../../components/first-result";
import { selectFirstResultSource } from "./first-result-intent";

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(), useRef: () => ({ current: null }), useEffect: () => {},
}));
vi.mock("./first-result-intent", async importOriginal => ({
  ...await importOriginal<typeof import("./first-result-intent")>(), selectFirstResultSource: vi.fn(),
}));

function findManualLink(node: unknown): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) return node.map(findManualLink).find(Boolean);
  if (!isValidElement<Record<string, unknown>>(node)) return;
  if (node.type === "a" && node.props.children === "Add your first tool") return node;
  return findManualLink(node.props.children);
}

it("finishes manual source intent when handing off to the form", () => {
  const link = findManualLink(FirstResultPanel({ source: "manual", busy: false, onConnectGithub: vi.fn() }));
  expect(link?.props.href).toBe("#add-product");
  expect(link?.props.onClick).toBeTypeOf("function");
  const preventDefault = vi.fn();
  const location = { hash: "" };
  vi.stubGlobal("window", { location });
  try {
    (link!.props.onClick as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(selectFirstResultSource).toHaveBeenCalledWith(null);
    expect(location.hash).toBe("add-product");
  } finally { vi.unstubAllGlobals(); }
});
