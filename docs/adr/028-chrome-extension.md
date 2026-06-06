# ADR-028: The Chrome Extension — Local-First Login Detector

## Status
Accepted — 2026-06-05

## Context
The Chrome extension detects which web apps the user is logged into. This provides a passive usage signal without tracking browsing history.

## Decision

### What the Extension Does

1. **Login Detection:** Checks if user is logged into known web apps
2. **Active Tab Detection:** Detects if user is currently on a known product domain
3. **No Tracking:** Does NOT track all browsing. Only checks domains the user has added to their profile.

### What the Extension Does NOT Do

- ❌ Track all browsing history
- ❌ Read form inputs or passwords
- ❌ Send data to server in real-time
- ❌ Run in background continuously
- ❌ Track time on site (only login state)
- ❌ Access cookies or localStorage

### The Technical Mechanism

```javascript
// Extension runs when user clicks the icon (not background)
chrome.action.onClicked.addListener(async (tab) => {
  // Get list of products user has in their profile
  const products = await getUserProducts();

  // Check each product domain for login state
  const results = [];
  for (const product of products) {
    const isLoggedIn = await checkLoginState(product.domain);
    results.push({
      product: product.name,
      domain: product.domain,
      isLoggedIn,
      lastChecked: new Date().toISOString(),
    });
  }

  // Store locally (chrome.storage.local)
  await chrome.storage.local.set({ loginStates: results });

  // Show results to user (popup UI)
  chrome.action.setPopup({ popup: 'popup.html' });
});

// Check login state (heuristic-based)
async function checkLoginState(domain) {
  // Method 1: Check for auth cookies
  const cookies = await chrome.cookies.getAll({ domain });
  const hasAuthCookie = cookies.some(c => 
    c.name.includes('auth') || 
    c.name.includes('session') || 
    c.name.includes('token')
  );

  // Method 2: Check for logged-in DOM elements (if content script allowed)
  // This requires user to be on the page, not background check

  return hasAuthCookie;
}
```

### The User Flow

1. User installs extension from Chrome Web Store
2. Extension asks: "Can we check which products you're logged into?"
3. User approves (optional — extension works without approval, just shows less data)
4. User clicks extension icon → sees popup:

```
┌─────────────────────────────────────┐
│ props Extension                       │
│                                     │
│ Products you're logged into:          │
│ ✅ Linear — logged in                 │
│ ✅ Notion — logged in                 │
│ ✅ Figma — logged in                  │
│ ❌ Cursor — not detected              │
│ ❌ Vercel — not detected              │
│                                     │
│ [Sync to PROPER-RESPECT →]                   │
│                                     │
│ Last synced: 2 hours ago              │
│                                     │
│ ⚙️ Settings                         │
└─────────────────────────────────────┘
```

5. User clicks "Sync to PROPER-RESPECT" → sends login states to server → updates prop verification status

### The Privacy Model

| Aspect | Policy |
|--------|--------|
| **Local-first** | All data stored in chrome.storage.local |
| **User-triggered** | Extension only runs when user clicks icon |
| **No background tracking** | No persistent background script |
| **No server communication** | Until user explicitly clicks "Sync" |
| **Minimal permissions** | Only `cookies` and `activeTab` |
| **Transparent** | User sees exactly what data is sent |

### The Permissions Required

```json
{
  "permissions": [
    "cookies",
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "https://*.linear.app/*",
    "https://*.notion.so/*",
    "https://*.figma.com/*"
    // ... dynamically added based on user's products
  ]
}
```

**Note:** `host_permissions` are dynamically requested based on the products in the user's profile. We don't ask for broad permissions upfront.

### The Chrome Web Store Policy Compliance

**Potential issues:**
- Chrome Web Store requires extensions to have a single purpose
- Our purpose: "Help users track which products they use"
- No surveillance, no tracking, no data collection without consent

**Mitigations:**
- Clear privacy policy in extension description
- No background tracking (user-triggered only)
- No data selling or third-party sharing
- Open source the extension (builds trust)

## Consequences

### Positive
- Provides OAuth-like verification without OAuth
- Detects web app usage without invasive tracking
- Local-first model respects privacy
- User-triggered = no background battery drain

### Negative
- Chrome Web Store review may reject (single purpose rule)
- Cookie-based detection is heuristic (not 100% accurate)
- Requires user to install extension (adoption barrier)
- Only works for web apps (not mobile apps, not desktop apps)
- Dynamic host permissions may be confusing to users

## Mitigations
- Open source the extension (GitHub repo)
- Clear, honest description in Chrome Web Store
- Fallback: if extension is rejected, users can still manually verify
- Cookie detection is labeled as "estimated" not "confirmed"

## Related
- ADR-010 (Screen Time) — mobile app verification
- ADR-001 (Email Passport) — primary verification method
- ADR-004 (Public Graph Privacy) — extension data is private until synced
