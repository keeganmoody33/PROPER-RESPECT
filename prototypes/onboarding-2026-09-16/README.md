# PROPER-RESPECT onboarding prototypes

Created and checked 2026-09-16. Local design studies, using synthetic data only.

Open the running built previews at http://127.0.0.1:4320/?view=studio and http://127.0.0.1:4320/?view=collection. The development previews are also running:

- A / Connection studio: http://127.0.0.1:4319/?view=studio
- B / Living collection: http://127.0.0.1:4319/?view=collection

## Run locally

```sh
cd /Users/keeganmoody/.codex/worktrees/4b19/PROPER-RESPECT/prototypes/onboarding-2026-09-16
npm ci
npm run dev
```

Vite binds to loopback only. The standalone package does not need the production app's environment, Clerk, Convex, or API credentials. No root package files were edited.

For a production artifact:

```sh
npm run build
# Stop the dev server before previewing on the same port.
npm run preview
```

## Try the complete flow

1. Choose Gmail, select a sample identity, then allow sample read access. This is separate from the already represented sample login. The permission screen does not imitate a live Google consent page.
2. Add the second Gmail identity, an Outlook identity, and a GitHub identity. Each is a distinct connection. Already connected identities are disabled in the chooser.
3. Use “Find my tools.” A brief local loading state precedes the private discoveries. Without GitHub, email mentions do not become usage evidence. With GitHub, a sample activity record supports its card.
4. Review a product. Set Active, Tried, or Archived; optionally paste a name, @handle, domain, or URL for who put you on, and add an affiliate destination. Link hosts can suggest a platform; the platform is optional and editable. Bare handles remain unresolved. Original pasted text is preserved. Product website, introducer credit, and affiliate destination are distinct fields. An affiliate destination is rendered as text in the private preview.
5. For a mention-only discovery, add sample activity evidence to see an owner snapshot or API example. Sample Slack activity is explicitly older and does not establish current use.
6. Keep the product in the private collection. Nothing publishes. Preview the collection to inspect only retained items.
7. Set a discovery aside, switch to Dismissed, then restore it. Disconnect source accounts to see retained sample records labeled as disconnected.
8. Select the daily API or weekly snapshot refresh proposal. The interface explicitly states that no refresh is scheduled.
9. Test a declined permission request using the checkbox on the consent screen. Retry or cancel; no account is added while the request is declined.
10. Switch A/B using the top bar to compare the same in-memory progress. Reset demo clears the sample state. Reload also clears it.

## Verification

`npm run build` passed on 2026-09-16.

`npm run check` launches installed Google Chrome through Playwright against the running local server. It exercises the flow above at 1440 and 390 px for both variants, then checks the reviewed state at 320 and 768 px. The script uses reduced motion, tests keyboard focus containment, Escape restoration, and Enter submission with and without activity evidence, and records screenshots. Raw results: `checks/verification-2026-09-16.json`.

Observed result: no runtime errors, no external requests during automated flows, no horizontal overflow in checked states, and zero violations across 20 axe scans (WCAG 2 A/AA and 2.1 A/AA tags). This is bounded automated evidence, not a claim of full accessibility conformance. Real screen-reader and Safari/mobile-device testing remain unperformed. A fresh-context independent reviewer returned READY after verifying the keyboard submission correction; the exact verdict is in `checks/independent-review-2026-09-16.md`.

Screenshots are in `checks/artifacts/`. Each filename identifies variant, viewport width, and initial/review/reviewed/dark state. The production-build Lighthouse runs scored 96 performance / 100 accessibility for both variants; LCP was 2.1 s for A and 2.3 s for B. Raw JSON and `checks/performance-2026-09-16.md` distinguish those local lab measurements from the earlier development-server runs and from production performance claims.

## Known limits

- No OAuth, provider requests, token storage, mailbox reads, uploads, publication, scheduling, backend, or durable persistence.
- Six selectable synthetic identities across three providers. There is no arbitrary email entry or real provider chooser.
- All users, account identities, documents, repositories, metrics, introducers, and affiliate URLs are fictional. Example email domains are reserved. Fixture reference date is 2026-09-16; “recent” describes that fixed fixture, not the date a later reviewer opens this artifact.
- GitHub uses official Primer packages and tokens, with a custom contribution visualization and invented activity. It is not a pixel-perfect copy of every GitHub page or an official embedded GitHub card.
- Notion and Slack are authored visual reconstructions. Context7 was used for Primer only. Neither reconstruction is an official vendor component. Slack is identified by its text name rather than a recreated logo. Outlook uses a generic mail icon rather than claiming to ship Microsoft's mark.
- The chart is one synthetic identity's fixture; it does not aggregate two real GitHub accounts. Multiple connection identities demonstrate UX, not cross-account identity reconciliation.
- Retaining evidence after workplace access ends is a design proposal subject to user authorization and workplace/provider policy. This demo does not settle retention or data ownership policy.
- No main-app source, production configuration, parent-task connector implementation, or protected Downloads checkout was changed.

## Files

- `src/main.jsx`: both shell variants, shared interactions, consent/review dialogs, vendor cards.
- `src/data.js`: explicitly synthetic fixtures and derived contribution count.
- `src/introducer.js`, `src/introducer-field.jsx`: optional raw credit, local link recognition, editable platform context, and separate introducer destination.
- `src/styles.css`: shell tokens, product boundaries, responsive layouts, focus, and reduced-motion treatment.
- `DESIGN.md`: visual decisions and provenance of vendor styling.
- `checks/flows.mjs`: behavioral and accessibility checks.
- `package.json`, `package-lock.json`: isolated dependencies and commands.
- `index.html`: local prototype entry.
- `../../PRODUCT.md`: dated, scoped DesignSystem init record with verbatim brief excerpts.

## Introducer refinement checks, 2026-09-16

Run `node checks/introducer-2026-09-16.mjs` with the built preview on port 4320. The targeted check covers raw text preservation, URL/domain recognition, bare and federated handles, exact-host matching, unsafe schemes, optional/overridden platform, private save/edit, separate destinations, Enter/Escape behavior, and desktop/mobile dark review. Results are in `checks/introducer-verification-2026-09-16.json`. Earlier general-flow and Lighthouse records describe the preceding prototype revision.

## Implementation coordination

The shared master contract and explicit adapter/persistence requirements are in [INTEGRATION-HANDOFF-2026-09-16.md](INTEGRATION-HANDOFF-2026-09-16.md). Task 3 has delivered local prototypes; Task 2 mailbox OAuth and Task 4 production integration are separate. No A/B selection has been recorded.

[ARCHITECTURE-2026-09-16.md](ARCHITECTURE-2026-09-16.md) traces the inspected app in both directions and proposes the account lifecycle, private save, public projection, and component boundaries. Its source snapshot identifies the newer implementation checkout; this prototype branch's older root app is not the integration baseline. Historical verification manifests retain their original capture state. The checkpoint commit and receiving task are recorded in the shared Ref.
