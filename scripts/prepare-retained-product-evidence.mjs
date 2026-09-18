#!/usr/bin/env node
// File-only preparation. Run with Node 22+ and --experimental-strip-types.
import { prepareRetainedProductEvidenceFiles } from "../src/server/retained-product-evidence.ts";

const [sourceDirectory, recoveryManifestPath, outputDirectory, sourceCapturedDate, ...extra] = process.argv.slice(2);
if (!sourceDirectory || !recoveryManifestPath || !outputDirectory || !sourceCapturedDate || extra.length) {
  console.error("Usage: node --experimental-strip-types scripts/prepare-retained-product-evidence.mjs PRIVATE_SOURCE_DIRECTORY RECOVERY_MANIFEST.json NEW_PRIVATE_OUTPUT_DIRECTORY SOURCE_CAPTURE_DATE");
  process.exit(1);
}
try {
  const result = await prepareRetainedProductEvidenceFiles({ sourceDirectory, recoveryManifestPath, outputDirectory, sourceCapturedDate });
  console.log(`Prepared ${result.files.length} private retained-evidence packets. No provider read or backend write.`);
  console.log(`Private preparation receipt: ${result.receiptPath}`);
} catch {
  // Original values, private account details, and source text must not reach logs.
  console.error("Retained evidence preparation failed. Check source format, manifest hashes, capture date, and a new output directory outside Git. No backend write occurred.");
  process.exit(1);
}
