# 003 - Evidence Surfaces

> Updated: 2026-09-18. Current source roles and verified implementation limits; Tasks 1–4 and accepted checkpoints stay fixed.

## Source roles

The owner's [September 18 direction is preserved verbatim](feedback/2026-09-18-direct-usage-and-screenshot-context.md). Email helps discover forgotten products, account/trial/payment events and possible past relationships. It is not the primary way to measure activity. Where permitted and available, prefer a product's documented account API or export for its own activity; use selected dashboard captures and owner context when telemetry is unavailable. Vendor-internal data does not establish customer API access.

The product remains a history of tools used, tested, chosen as go-to, stopped and returned to. Activity supports that story; it does not rank products or award importance. A relationship can be honestly owner-described without independent telemetry.

| Source | What its contents may establish | Interpretation limit |
| --- | --- | --- |
| Authorized product API | A documented metric or event for the identified account, permitted scope and measurement window | A successful authentication or tool call is not a usage history. Account activity does not automatically identify a human actor. |
| Product export | The supplied rows, units, periods and stated account/team attribution | An uploaded export is not automatically authenticated to the vendor; organization totals are not personal totals. |
| Authenticated dashboard capture | The visible metric, account context and displayed period captured at that time | Retain how it was captured; a browser session does not make every visible assertion true or complete. |
| Screenshot, including Screen Time | What the selected image visibly reports, with any supported device/account/date context | Upload, EXIF and a file hash do not independently authenticate the image. App time is not necessarily focused work or human activity. |
| Gmail headers or selected message evidence | A mention, signup, receipt or other event actually supported by that record | No automatic inference of trial use, adoption, current use, churn or importance. Absence of email proves none of those. |
| Owner statement or selected work artifact | The owner's explanation, relationship decision or the artifact's specific supported context | Keep owner assertions distinct from provider-reported facts and derived findings. |

No universal personal-usage endpoint was established by the official sources checked below. OAuth and connector brokers can reduce connection work, but each provider still determines accessible data, permissions and metric semantics. MCP or browser transport does not create a metric the source does not expose. Do not implement a universal endpoint or universal confidence score on that assumption.

## Current product paths and official references

Checked 2026-09-18. Documentation establishes a capability, not authorization or successful retrieval for this owner.

| Product or source | Documented capability | Proper Respect status and limit |
| --- | --- | --- |
| GitHub | GraphQL exposes a contribution calendar: “A calendar of this user's contributions on GitHub.” [Reference](https://docs.github.com/en/graphql/reference/users#contributionscollection) | The existing direct connector requests the authenticated viewer's contribution calendar for an explicit twelve-month window. It is the next existing activity path to verify under authorized source access; the retained imported response remains a historical snapshot. Contributions are not hours, total work or all tool use. |
| Cursor | Admin API: “Retrieve daily usage metrics for your team.” [Reference](https://cursor.com/docs/account/teams/admin-api) | The documented endpoint is team-scoped. Check the owner's actual plan, role and permitted key before promising access; no universal personal-account access or Proper Respect Cursor connector is established. |
| Wispr Flow personal | “Your Usage is always available” in the documented usage view. [Your Usage](https://docs.wisprflow.ai/articles/8760230576-your-usage-tab-track-your-dictation-stats-in-wispr-flow) | Retained Insights evidence and separate owner testimony already reach the private card. This is a static capture, not live tracking; no documented personal usage API was established in this check. |
| Wispr Flow enterprise | “Available on: Wispr Flow Enterprise (admin portal)” for usage export. [CSV reference](https://docs.wisprflow.ai/articles/2356896572-admin-usage-v2-team-members-table-and-words-dictated-csv-export) | A supported export is a possible owner-supplied path when authorized. Preserve user/team attribution; do not assume a personal account has enterprise admin access. |
| Apple Screen Time | DeviceActivity reports run in an extension sandbox that “prevents your extension from making network requests”. [DeviceActivityReport](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport?language=objc) | This is not a universal web usage feed. Native access needs appropriate authorization and distribution entitlements; a new device collector is deferred. User-selected screenshots remain possible. |

Apple separately documents [individual authorization](https://developer.apple.com/documentation/familycontrols/authorizationcenter/requestauthorization(for:)) and [Family Controls distribution entitlements](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement). Do not turn entitlement availability into a claim that sensitive report data may be exported to Proper Respect.

The existing [Wispr plan](plans/2026-09-16-wispr-product-and-usage-plan.md) already states: “No personal usage API has been established.” That remains an access limitation, not a reason to block a truthful product relationship or rebuild the evidence model.

## Screenshot context and validation

Screenshot support should preserve the artifact and explain what was checked, rather than label every screenshot verified or assign blanket medium/strong confidence:

1. Keep the original private. A selected crop or redaction is a separate derivative linked to it; publication is an independent exact-field decision.
2. Distinguish server receipt time, any supplied file/capture metadata, and the measurement period visibly displayed by the product. Record timezone and device/account context only when available. Missing dates remain unknown.
3. A computed content hash can identify retained bytes and detect later change relative to that capture. It cannot establish that the original screenshot was truthful. EXIF may be absent or edited; it is supporting metadata, not attestation.
4. When image extraction is implemented, retain the exact visible text/region, extraction method/version and proposed observation separately from the original. Let the owner confirm or correct the interpretation; that review does not convert owner-supplied material into an authenticated provider response.
5. Corroborating an image with an authorized API or original export can support specific fields. Do not invent corroboration, infer unseen periods, or add overlapping cross-device totals.

Even signed provenance is not a universal truth test: the [C2PA explainer](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) says it “cannot tell you whether the digital content is true”. No C2PA or image-forensics subsystem is required for this release.

**Implemented now:** authenticated private file upload retains the original storage object, filename, MIME type, byte size and server capture time. The interface explicitly says it does not read the image or CSV automatically. Selected observations can be supplied for private review. Prepared retained packets separately verify their expected content hashes before canonical intake.

**Not implemented in the generic upload path:** image OCR, EXIF validation, content-based replay identity, screenshot authenticity verification or automatic Screen Time extraction. Do not describe the prepared-packet checks as a generic screenshot verifier. These are bounded follow-ups within the existing intake work when needed; no new collector or architecture program starts with this document correction.

Current code: [upload interface](../components/onboarding-client.tsx), [retained upload](../convex/onboarding.ts), [private observations/review](../convex/privateEvidence.ts), [prepared retained intake](../convex/retainedEvidence.ts), [direct account connectors](../convex/connectors.ts).

## Private retention, review and sharing

```text
Authorized source or owner-supplied artifact
  -> retained original + source identity + capture provenance
  -> typed observations / private discovery / support for an existing relationship
  -> owner review and relationship decisions
  -> saved private collection
  -> separately approved exact public projection
```

A proof/supporting record can remain private. Evidence can support an existing relationship as well as propose a new one. A source never publishes or confirms a relationship by itself. Routine permitted evidence updates do not require repeated approval, but new personal relationship claims, go-to designation and consequential lifecycle changes remain owner-controlled. Raw originals are not automatically included in a public projection.

Retain metric definition, value/units, measurement period, actual coverage, freshness, source lineage, transformation/version, known actor and capture method where applicable. `capturedAt` is collection time, not first use. SOURCE_REPORTED, ASSISTANT_EXTRACTED and USER_SUPPLIED remain different acquisition labels. Account creation, signup and payment cannot populate a use-start date without separate support. Corrections and earlier relationship decisions remain available.

The [runtime validators](../convex/validators.ts) and [schema](../convex/schema.ts) define implemented enums and storage; earlier conceptual lists are not additional implemented connectors. The current [delivery receipt](verification/2026-09-18-personal-product-delivery.md) records actual account/source proof.

## Continuation inside the existing tasks

The Gmail recognized-product gate is closed. Its four-page authorization is exhausted; further mailbox reads remain paused and maintenance remains off. Historical email discovery remains useful but is not a prerequisite to displaying direct product activity or owner-described relationships.

For activity, reuse and verify the accepted direct GitHub connection/refresh path under the appropriate account and source authorization, preserving private retention and explicit sharing. Keep Wispr's retained evidence labeled static until a permitted refreshed capture, export or documented API path exists. Present each source's capability, refresh mode, period, coverage and failure state honestly. Production Composio adoption, native collectors and additional vendor integrations remain separate; no provider read, recurring collection or deployment is authorized by this clarification.

Related: [current thesis](000-current-product-thesis.md), [development continuation](DEVELOPMENT.md), [Tasks 1–4](plans/2026-09-16-multiple-mailboxes-and-native-cards.md), [canonical Ref](https://plan.ref.tools/oUl8LCIQb32SAicK).
