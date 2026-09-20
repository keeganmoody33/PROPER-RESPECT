import { expect, test } from "vitest";
import { classifyEvidenceUpload, MAX_EVIDENCE_UPLOAD_BYTES } from "./evidence-upload";

test.each([
  ["png", "image/png", "SCREENSHOT"], ["jpeg", "image/jpeg", "SCREENSHOT"],
  ["webp", "image/webp", "SCREENSHOT"], ["heic", "image/heic", "SCREENSHOT"],
  ["heif", "image/heif", "SCREENSHOT"], ["csv", "text/csv", "CSV"],
  ["tsv", "text/tab-separated-values", "FILE_UPLOAD"], ["json", "application/json", "FILE_UPLOAD"],
  ["jsonl", "application/x-ndjson", "FILE_UPLOAD"], ["ndjson", "application/x-ndjson", "FILE_UPLOAD"],
  ["pdf", "application/pdf", "FILE_UPLOAD"], ["xls", "application/vnd.ms-excel", "FILE_UPLOAD"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "FILE_UPLOAD"],
  ["ods", "application/vnd.oasis.opendocument.spreadsheet", "FILE_UPLOAD"],
  ["txt", "text/plain", "FILE_UPLOAD"], ["xml", "application/xml", "FILE_UPLOAD"],
  ["html", "text/html", "FILE_UPLOAD"], ["zip", "application/zip", "FILE_UPLOAD"],
])("classifies supported %s metadata without parsing content", (extension, mimeType, sourceType) => {
  expect(classifyEvidenceUpload({ filename: `export.${extension}`, mimeType, byteSize: 15 }).sourceType).toBe(sourceType);
});

test("accepts browser-unknown MIME and case-insensitive extensions", () => {
  expect(classifyEvidenceUpload({ filename: "export.JSON", mimeType: "", byteSize: 12 }).sourceType).toBe("FILE_UPLOAD");
  expect(classifyEvidenceUpload({ filename: "export.csv", mimeType: "text/csv; charset=utf-8", byteSize: 12 }).sourceType).toBe("CSV");
});

test.each(["export.exe", "constructor", "export.constructor", "toString", "json", "../export.json"])("rejects unsupported filename %s", filename => {
  expect(() => classifyEvidenceUpload({ filename, mimeType: "", byteSize: 12 })).toThrow();
});

test("rejects contradictory MIME metadata", () => {
  expect(() => classifyEvidenceUpload({ filename: "export.json", mimeType: "image/png", byteSize: 12 })).toThrow("do not match");
});

test.each([0, -1, 1.5, NaN, MAX_EVIDENCE_UPLOAD_BYTES + 1])("rejects unsupported size %s", byteSize => {
  expect(() => classifyEvidenceUpload({ filename: "export.json", mimeType: "", byteSize })).toThrow("19 MiB");
});
