export const MAX_EVIDENCE_UPLOAD_BYTES = 25 * 1024 * 1024;

const formats = {
  png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], webp: ["image/webp"],
  heic: ["image/heic", "image/heif"], heif: ["image/heif", "image/heic"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
  tsv: ["text/tab-separated-values", "text/plain"],
  json: ["application/json", "text/json", "text/plain"],
  jsonl: ["application/jsonl", "application/x-jsonlines", "application/x-ndjson", "application/json", "text/plain"],
  ndjson: ["application/x-ndjson", "application/ndjson", "application/json", "text/plain"],
  pdf: ["application/pdf"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  txt: ["text/plain"], xml: ["application/xml", "text/xml", "text/plain"],
  html: ["text/html"], htm: ["text/html"],
  zip: ["application/zip", "application/x-zip-compressed"],
} as const;

export const EVIDENCE_UPLOAD_ACCEPT = Object.keys(formats).map(extension => `.${extension}`).join(",");
export function normalizeUploadMime(mimeType: string) {
  return mimeType.split(";")[0].trim().toLowerCase() || "application/octet-stream";
}

export function classifyEvidenceUpload(input: { filename: string; mimeType: string; byteSize: number }) {
  if (!input.filename.trim() || input.filename.length > 255 || /[\x00-\x1f/\\]/.test(input.filename)) throw new Error("Choose a file with a valid filename.");
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > MAX_EVIDENCE_UPLOAD_BYTES) throw new Error("Choose a nonempty file of 25 MiB or less.");
  const extension = input.filename.toLowerCase().split(".").at(-1)!;
  if (!input.filename.includes(".") || !Object.hasOwn(formats, extension)) throw new Error("Unsupported export format. Choose an image, CSV/TSV, JSON/JSONL, PDF, spreadsheet, text/XML/HTML, or ZIP file.");
  const mimeType = normalizeUploadMime(input.mimeType);
  if (mimeType !== "application/octet-stream" && !(formats[extension as keyof typeof formats] as readonly string[]).includes(mimeType)) throw new Error("The file extension and content type do not match.");
  const sourceType = ["png", "jpg", "jpeg", "webp", "heic", "heif"].includes(extension)
    ? "SCREENSHOT" : extension === "csv" ? "CSV" : "FILE_UPLOAD";
  return { extension, mimeType, sourceType } as const;
}
