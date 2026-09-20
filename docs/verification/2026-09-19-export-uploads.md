# Export upload correction

Verified: 2026-09-19. Base: `f808fc834c7900681d10b043a6bb09d4f8e76314`.
Test-first commit: `d428ba5`.
Existing Ref: https://plan.ref.tools/oUl8LCIQb32SAicK.

## Behavior

The upload form accepts PNG, JPEG, WebP, HEIC, HEIF, CSV, TSV, JSON, JSONL,
NDJSON, PDF, XLS, XLSX, ODS, TXT, XML, HTML and ZIP files up to 25 MiB.
A shared metadata classifier rejects unsupported formats and contradictory
extension/MIME combinations before upload. The backend independently derives
the source category and checks stored size and content type. JSON and other
non-image/non-CSV exports use `FILE_UPLOAD`.

Original bytes remain in private storage. The retained record preserves filename,
MIME, size and upload provenance. A proof links the record to private supporting
context, where original metadata is visible. Retention does not parse, unpack,
authenticate publisher origin or create usage measurements. The activity actor
remains unknown. Devin cloud and Devin Desktop are separate product choices.

Repeated finalization of the same storage object returns the same evidence ID.
Conflicting metadata and another owner's already-retained storage object are
rejected. Existing confirmed relationships, explanations and approved review
remain unchanged. The upload endpoint rejects direct measurement injection.

## Verification

Original regression output:

```text
Tests  3 failed (3)
- Expected: FILE_UPLOAD
+ Received: SCREENSHOT
```

The other two failures showed no linked proof and a new evidence ID on replay.
The same three regressions now pass. `npm test` passes 443 Vitest tests and six
Node tests; one optional private-file test is skipped. `npm run lint`,
`npm run typecheck`, and `npm run build` pass. The existing rendered-form test
now checks JSON/spreadsheet/ZIP picker support and distinct Devin choices.

The authenticated localhost form was inspected through browser controls at
desktop and 390px mobile widths. Both render the accepted formats and retention
limitations. This is frontend verification against the existing development
session, not a live upload through the changed backend. Convex-test exercises
the actual mutation, storage metadata and private query. Its storage fixture
needs explicit contentType because convex-test store() omits that HTTP-upload
metadata. An independent static review found no blocking introduced defect.

## Release boundary and remaining limits

The owner approved development synchronization of application commit
`6bf69c2476c8f4eb0e94136b9c893c23ca3c878e`. The explicit target was verified as
`dev:utmost-mongoose-374` before running `convex dev --once` with codegen disabled
and a target-only temporary environment file. The CLI confirmed that exact
deployment and added `rawEvidence.by_storage`. Function-spec readback exposes
FILE_UPLOAD on retainUpload and the private evidence query. All 32 preexisting
application tables are byte-identical in private before/after exports. The
authenticated local upload form loads after synchronization.

No provider read, data import, push, production deployment or publication
occurred. Next, upload the real Devin export through the signed-in local form.
The original has not been located or imported by the agent. Verify its private
retention before proposing a production release to `striped-chicken-693`.

The owner's previously reported Devin JSON is not proven retained. No private
original is included in this commit. Upload classification checks metadata,
not magic bytes or publisher authenticity. Same-storage finalization is
idempotent; uploading identical bytes into separate storage IDs remains distinct.
The existing signed upload URL does not bind first retention to an uploader
identity. Already-retained objects are owner protected. A separate upload-ticket
contract is not implemented or claimed by this fix. Unknown vendor strings can
retain an original without producing a catalog candidate. No file download or
automatic parsing feature was added.

The owner selected pstack-codex as the primary workflow. AGENTS.md and
DEVELOPMENT.md carry that direction without replacing Tasks 1–4.
