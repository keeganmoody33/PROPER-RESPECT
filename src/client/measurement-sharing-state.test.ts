import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReturnType } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeasurementSharingChoices } from "../../components/measurement-review";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const boundary = vi.hoisted(() => ({ query: vi.fn(), effects: [] as (() => void)[] }));
vi.mock("convex/react", () => ({ useQuery: boundary.query, useMutation: () => vi.fn() }));
// Exercise the component's query-to-parent synchronization without a DOM. The
// browser spec covers React's real effect scheduling and publication preview.
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void) => { boundary.effects.push(effect); },
}));

type Captures = FunctionReturnType<typeof api.retainedEvidence.measurements>;
const first = "fixture-first" as Id<"rawEvidence">;
const second = "fixture-second" as Id<"rawEvidence">;
const missing = "fixture-deleted" as Id<"rawEvidence">;
function capture(rawEvidenceId: Id<"rawEvidence">, reviewedMeasurementIds = ["fixture-row"]): Captures[number] {
  return {
    rawEvidenceId, digest: "fixture-digest", capturedAt: "2026-10-06T10:00:00.000Z",
    adapter: "metric-packet", source: { namespace: "fixture", identityBasis: "OWNER_SUPPLIED", sourceAlias: "fixture-source", ownerAlias: "fixture-owner", accountAlias: null, workspaceAlias: null, deviceAlias: null },
    reviewedMeasurementIds, reviewVersion: 1, captureCount: 1, measurements: [],
  };
}

function render(captures: Captures | undefined, selected: Id<"rawEvidence">[], onChange: (ids: Id<"rawEvidence">[]) => void, disabled = false) {
  boundary.query.mockReturnValue(captures);
  const html = renderToStaticMarkup(createElement(MeasurementSharingChoices, {
    propId: "fixture-prop" as Id<"props">, selected, onChange, disabled,
  }));
  for (const effect of boundary.effects.splice(0)) effect();
  return html;
}

beforeEach(() => { boundary.query.mockReset(); boundary.effects.length = 0; });

describe("reviewed measurement sharing selections", () => {
  it.each([
    { reason: "review invalidation", captures: [capture(first, [])] },
    { reason: "source deletion", captures: [] },
  ])("clears the parent selection after $reason even when no choices render", ({ captures }) => {
    const onChange = vi.fn();
    expect(render(captures, [first], onChange, true)).toBe("");
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
    render(captures, [], onChange, true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes only invalid IDs and never selects a newly reviewed source", () => {
    const onChange = vi.fn();
    render([capture(second, []), capture(first), capture("fixture-new" as Id<"rawEvidence">)], [second, first, missing], onChange);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([first]);
  });

  it("preserves choices while the query is undefined", () => {
    const onChange = vi.fn();
    expect(render(undefined, [first, second], onChange)).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not update unchanged choices or their order", () => {
    const onChange = vi.fn();
    render([capture(first), capture(second)], [second, first], onChange);
    render([capture(first), capture(second)], [], onChange);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not restore sharing consent when an invalidated source is reviewed again", () => {
    let selected = [first];
    const onChange = vi.fn((ids: Id<"rawEvidence">[]) => { selected = ids; });
    render([capture(first)], selected, onChange);
    render(undefined, selected, onChange);
    expect(selected).toEqual([first]);
    render([capture(first, [])], selected, onChange);
    expect(selected).toEqual([]);
    render([capture(first)], selected, onChange);
    expect(selected).toEqual([]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
  });
});
