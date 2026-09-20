// Updated 2026-09-19. Fixture-only queue lifecycle checks.
import { afterEach, expect, test, vi } from "vitest";
import { prepareCollectionBrands } from "./product-brand-preparation";

afterEach(() => vi.useRealTimers());

test("prepares deduplicated batches once and waits for completion before enrolling the next", async () => {
  vi.useFakeTimers();
  const ids = Array.from({ length: 26 }, (_, index) => `prop-${index}`);
  const prepare = vi.fn(async () => undefined);
  let ready = false;
  const read = vi.fn(async (propIds: string[]) => propIds.map(propId => ({ propId, status: ready ? "READY" as const : "RUNNING" as const })));
  const report = vi.fn();
  const result = prepareCollectionBrands({ propIds: [...ids, ids[0]], prepare, read, report, signal: new AbortController().signal });
  await vi.advanceTimersByTimeAsync(0);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare.mock.calls[0]).toEqual([ids.slice(0, 25)]);
  await vi.advanceTimersByTimeAsync(4_000);
  expect(prepare).toHaveBeenCalledTimes(1);
  ready = true;
  await vi.advanceTimersByTimeAsync(2_000);
  await result;
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(prepare.mock.calls[1]).toEqual([[ids[25]]]);
  expect(report.mock.lastCall).toEqual([ids.map(propId => ({ propId, status: "READY" })), true]);
});

test("failure and identity blocks stay explicit without an automatic retry loop", async () => {
  const prepare = vi.fn(async () => undefined);
  const items = [{ propId: "failed", status: "FAILED" as const }, { propId: "copilot", status: "PRODUCT_IDENTITY_REQUIRED" as const }];
  const report = vi.fn();
  await prepareCollectionBrands({ propIds: items.map(item => item.propId), prepare, read: async () => items, report, signal: new AbortController().signal });
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(report.mock.lastCall).toEqual([items, true]);
});

test("timeout stops the queue so a hanging batch cannot accumulate provider work", async () => {
  vi.useFakeTimers();
  const ids = Array.from({ length: 26 }, (_, index) => `prop-${index}`);
  const prepare = vi.fn(async () => undefined);
  const report = vi.fn();
  const result = prepareCollectionBrands({ propIds: ids, prepare, read: async propIds => propIds.map(propId => ({ propId, status: "RUNNING" as const })), report, signal: new AbortController().signal });
  await vi.advanceTimersByTimeAsync(182_000);
  await result;
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(report.mock.lastCall?.[0].filter((item: { status: string }) => item.status === "FAILED")).toHaveLength(25);
  expect(report.mock.lastCall?.[0][25].status).toBe("NOT_REQUESTED");
  expect(report.mock.lastCall?.[1]).toBe(true);
});

test("owner change or unmount cancels pending reads and further enrollment", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const prepare = vi.fn(async () => undefined);
  const read = vi.fn(async (propIds: string[]) => propIds.map(propId => ({ propId, status: "PENDING" as const })));
  const report = vi.fn();
  const result = prepareCollectionBrands({ propIds: ["one"], prepare, read, report, signal: controller.signal });
  await vi.advanceTimersByTimeAsync(0);
  const count = report.mock.calls.length;
  controller.abort();
  await result;
  await vi.advanceTimersByTimeAsync(200_000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledTimes(count);
});

test("a rejected preparation is visible and stops subsequent batches", async () => {
  const prepare = vi.fn(async () => { throw new Error("Authentication required."); });
  const read = vi.fn();
  const report = vi.fn();
  await prepareCollectionBrands({ propIds: ["one"], prepare, read, report, signal: new AbortController().signal });
  expect(read).not.toHaveBeenCalled();
  expect(report.mock.lastCall).toEqual([[{ propId: "one", status: "FAILED" }], true]);
});

test("an unresponsive backend read times out with an explicit unavailable state", async () => {
  vi.useFakeTimers();
  const report = vi.fn();
  const result = prepareCollectionBrands({ propIds: ["one"], prepare: async () => undefined,
    read: () => new Promise(() => undefined), report, signal: new AbortController().signal });
  await vi.advanceTimersByTimeAsync(30_001);
  await result;
  expect(report.mock.lastCall).toEqual([[{ propId: "one", status: "FAILED" }], true]);
});
