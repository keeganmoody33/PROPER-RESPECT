# ADR-059: Error Handling — Graceful Degradation and Recovery

## Status
Accepted — 2026-06-05

## Context
Things will break. The database will go down. The email API will fail. The OG image generator will crash. How do we handle errors gracefully?

## Decision

### The Error Types and Handling

| Error Type | Example | User Experience | Recovery |
|------------|---------|-----------------|----------|
| **Database timeout** | Neon connection pool exhausted | "Something went wrong. Try again." | Retry with backoff, alert on-call |
| **Email API failure** | Gmail OAuth token expired | "Could not connect to Gmail. Try again or skip." | Prompt re-auth, allow skip |
| **OG image generation failure** | @vercel/og crashes | Profile loads without OG image. Fallback to static. | Retry once, then fallback |
| **Product logo fetch failure** | Favicon 404 | Show generic placeholder logo. | Cache placeholder, retry later |
| **Third-party API failure** | Clearbit/Crunchbase down | Product created without enrichment. | Retry later, allow manual edit |
| **Rate limit exceeded** | Too many API requests | "Slow down. Try again in a minute." | Exponential backoff |
| **Validation error** | Invalid username | "Username must be 3-30 characters." | Inline error, no page reload |
| **Network error** | User offline | "You're offline. Changes saved locally." | Local storage, sync when online |
| **Server error (500)** | Unknown bug | "Something went wrong. We've been notified." | Sentry alert, auto-retry |

### The Error UI Patterns

**Inline Error (Form Validation):**
```
┌─────────────────────────────────────┐
│ Username                              │
│ [keegan!                      ]       │
│ ⚠️ Usernames can only contain         │
│    letters, numbers, and underscores.  │
└─────────────────────────────────────┘
```

**Toast Error (Action Failure):**
```
┌─────────────────────────────────────┐
│ ⚠️ Could not save prop                │
│    Please try again.                  │
│                                     │
│ [Retry] [Dismiss]                     │
└─────────────────────────────────────┘
```

**Full Page Error (Critical Failure):**
```
┌─────────────────────────────────────┐
│ 🔧 Something went wrong               │
│                                     │
│ We're having trouble loading this    │
│ page. Our team has been notified.    │
│                                     │
│ [Reload Page] [Go Home]               │
│                                     │
│ Error ID: err_abc123                  │
│ (include this if contacting support) │
└─────────────────────────────────────┘
```

**Offline State:**
```
┌─────────────────────────────────────┐
│ 📡 You're offline                       │
│                                     │
│ Don't worry — your changes are saved  │
│ locally. They'll sync when you're    │
│ back online.                          │
│                                     │
│ [View Saved Changes →]                │
└─────────────────────────────────────┘
```

### The Error Logging and Monitoring

| Tool | Purpose |
|------|---------|
| **Sentry** | Error tracking, stack traces, user context |
| **LogRocket** | Session replay (see what user did before error) |
| **Vercel Logs** | Serverless function logs |
| **Prisma Logs** | Database query logs |
| **PagerDuty** | On-call alerts for critical errors |

### The Error Recovery Strategies

**Retry with Backoff:**
```
Attempt 1: Immediate
Attempt 2: 1 second delay
Attempt 3: 2 second delay
Attempt 4: 4 second delay
Attempt 5: Fail gracefully
```

**Circuit Breaker:**
- If a service fails 5 times in 1 minute, stop calling it for 5 minutes
- Show fallback UI
- Alert on-call team

**Graceful Degradation:**
- If OG image fails → show static fallback
- If email scan fails → allow manual entry
- If analytics fail → show cached data
- If search fails → show popular results

### The User Communication

**What users see:**
- Friendly, non-technical language
- Clear next steps
- No blame ("Something went wrong" not "You did something wrong")
- Error ID for support (but not scary technical details)

**What we log:**
- Full stack trace
- User ID (if authenticated)
- Request URL and method
- Timestamp
- Browser and OS
- Error ID (linked to user-facing message)

## Consequences

### Positive
- Graceful errors don't break user trust
- Monitoring catches issues before users report them
- Error IDs make support efficient
- Offline support enables usage anywhere

### Negative
- Error handling adds code complexity
- Fallback UIs require additional design
- Monitoring tools add cost
- On-call rotation is stressful

## Mitigations
- Start with basic error handling (Phase 1)
- Add monitoring tools as scale demands (Phase 2+)
- Use Sentry's free tier initially
- Document common errors and runbooks

## Related
- ADR-058 (Performance) — errors affect perceived performance
- ADR-022 (Risk Register) — system failures are a risk
