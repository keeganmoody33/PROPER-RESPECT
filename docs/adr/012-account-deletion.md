# ADR-012: Account Deletion and Lineage Integrity

## Status
Accepted — 2026-06-05

## Context
When a user deletes their account, what happens to the lineage graph? If Keegan deletes his account, does Jordan Crawford lose the credit for putting him on Claude? Does the "who put who on" graph break?

## Decision

### What Gets Deleted (Hard Delete)
- User profile page (`props.to/keegan`) → 404
- All props created by the user
- All content (Looms, screenshots, notes) uploaded by the user
- All email scan metadata (already ephemeral)
- All OAuth tokens and connections
- All personal data (email, name, avatar)

### What Survives (Anonymized)
- **Lineage entries where the user was the RECIPIENT** ("Keegan was put on by Jordan") → The lineage survives, but the recipient is anonymized: "Someone was put on by Jordan Crawford"
- **Lineage entries where the user was the GIVER** ("Jordan put Keegan on") → The lineage is deleted. Jordan no longer gets credit for putting Keegan on (because Keegan's prop is gone).

### The Logic

```
Before deletion:
  Jordan Crawford → put on → Keegan → Claude

After Keegan deletes:
  Jordan Crawford → put on → [Anonymous User] → Claude

  OR (if Keegan's prop is deleted entirely):
  Jordan Crawford → (no longer credited for putting Keegan on)
```

**The principle:** The social graph is community property. If you delete your account, you remove your node, but you don't erase the fact that someone influenced "a user." The lineage is anonymized, not deleted.

### Why Not Delete Everything?

| Option | Problem |
|--------|---------|
| Delete all lineage | Jordan loses credit he earned. Unfair to the giver. |
| Keep full lineage with name | Violates deletion right. Keegan's name shouldn't persist. |
| Anonymize recipient | Jordan keeps credit. Keegan's privacy is respected. Graph integrity maintained. |

### The "Ghost User" Pattern

Deleted users become a "ghost" node in the lineage graph:
- Display name: "A user" or "Someone"
- No profile link
- No identifiable data
- Still counts toward Jordan's "put on" count

**Example on Jordan's profile:**
```
Jordan's Impact
• Put 16 people on products
  - 15 verified users
  - 1 anonymous user (account deleted)
```

### The 30-Day Grace Period

When a user requests deletion:
1. Account is immediately hidden from public view
2. 30-day grace period: user can cancel deletion
3. After 30 days: hard delete of personal data, anonymization of lineage
4. Irreversible

## Consequences

### Positive
- Respects deletion rights (GDPR/CCPA)
- Preserves the social graph integrity
- Givers don't lose credit because recipients leave
- Transparent: users know lineage may be anonymized, not deleted

### Negative
- "Ghost" nodes are weird UX
- Lineage graph has holes
- Anonymized data is still data (regulatory gray area)
- If a popular user deletes, many lineages become ghosts

## Mitigations
- Clear explanation at deletion: "Your PROPER-RESPECT will be deleted. Lineage you received will be anonymized. Lineage you gave will be removed."
- Ghost nodes are visually distinct (grayed out, no link)
- Annual purge: after 1 year, ghost nodes are fully removed (only if no regulatory conflict)

## Related
- ADR-004 (Public Graph Privacy) — what is public vs. private
- ADR-006 (Data Retention Forever) — user-generated data retention
