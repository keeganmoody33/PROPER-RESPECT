import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CollectionError from "@/app/app/error";
import ProfileError from "@/app/[handle]/error";
import GlobalError from "@/app/global-error";

type BoundaryProps = { error: Error & { digest?: string }; retry: () => void; reset: () => void };
type Boundary = (props: BoundaryProps) => ReactNode;

// Next forwards a server error to the boundary with a redacted message and a digest.
const serverError = Object.assign(new Error("[CONVEX Q(inventory:list)] [Request ID: 1a2b] Server Error"), { digest: "4242" });

function buttons(node: ReactNode): ReactElement<{ onClick?: () => void; children?: ReactNode }>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) return [];
  return [...(node.type === "button" ? [node] : []), ...buttons(node.props.children)];
}

function render(Boundary: Boundary) {
  const retry = vi.fn();
  const reset = vi.fn();
  const tree = Boundary({ error: serverError, retry, reset });
  return { tree, html: renderToStaticMarkup(tree as ReactElement), retry, reset };
}

const boundaries: [string, Boundary][] = [
  ["the private collection", CollectionError],
  ["the whole site", GlobalError],
  ["a public page", ProfileError],
];

describe.each(boundaries)("the error boundary for %s", (_, Boundary) => {
  it("re-fetches on Try again, instead of re-rendering what failed", () => {
    const { tree, retry, reset } = render(Boundary);
    const [button] = buttons(tree);
    expect(button.props.children).toBe("Try again");
    button.props.onClick?.();
    expect(retry).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });

  it("shows no error code, function name or stack", () => {
    const { html } = render(Boundary);
    expect(["4242", "inventory:list", "Server Error", "CONVEX", "Request ID"].filter(leak => html.includes(leak))).toEqual([]);
  });

  it("follows the copy rules", () => {
    const { html } = render(Boundary);
    expect(["–", "—", " - "].filter(dash => html.includes(dash))).toEqual([]);
    expect(html.toLowerCase()).not.toContain("verified");
  });
});

describe("private data", () => {
  it("the collection boundary says the private collection is unchanged", () => {
    expect(render(CollectionError).html).toContain("Your private collection and everything saved in it are unchanged.");
  });

  it("the site boundary says saved data is unchanged, in its own document", () => {
    const { html } = render(GlobalError);
    expect(html.startsWith("<html")).toBe(true);
    expect(html).toContain("<body");
    expect(html).toContain("Your collection and your page are unchanged.");
  });
});
