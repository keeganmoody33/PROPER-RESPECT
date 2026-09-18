import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import wisprReceipt from "../../docs/verification/fixtures/2026-09-17-context-brands/wisprflow.json";
import { readRetainedBrandReceipt } from "./retained-brand-receipt";

test("real Wispr and GitHub receipts validate and restore without a provider call", async () => {
  const dir = resolve("docs/verification/fixtures/2026-09-17-context-brands");
  for (const slug of ["wisprflow", "github"]) {
    const first = await readRetainedBrandReceipt(dir, slug);
    expect(first.snapshot.productSlug).toBe(first.product.slug);
    expect(await readRetainedBrandReceipt(dir, slug)).toEqual(first);
  }
});

test("local preview rejects altered receipts and non-canonical paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "proper-brand-receipt-"));
  try {
    await writeFile(join(dir, "wisprflow.json"), JSON.stringify({ ...wisprReceipt, response: {} }));
    await expect(readRetainedBrandReceipt(dir, "wisprflow")).rejects.toThrow("hash mismatch");
    await expect(readRetainedBrandReceipt(dir, "../../etc/passwd")).rejects.toThrow("Verified canonical product");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
