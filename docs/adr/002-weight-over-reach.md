# ADR-002: Two Weight Systems — Credibility vs. Reward

## Status
Accepted — Updated 2026-06-05

## Context
The original concept had a single "weight" score that determined both how a prop was displayed and how valuable it was to the company. This conflated two different things: **credibility** (does this person actually use the product?) and **reward** (how much does the company pay for this referral?).

We now separate these into two distinct systems.

## Decision

### System 1: Credibility Weight (Display Algorithm)
**Purpose:** Determine how PROPER-RESPECT are sorted and displayed on a user's profile.  
**Owner:** PROPER-RESPECT platform (universal, transparent, user-driven).  
**Philosophy:** Rewards depth over reach. A daily user with 100 followers ranks higher than an influencer who opened the product once.

**The Algorithm (Public, Explainable):**

```
Credibility Weight = 
  min(tenure_months, 24) * 1.0          // Tenure cap at 24 months
  + verification_tier_score * 1.0         // Self(0) | Email(15) | OAuth(30) | Company(50)
  + activity_status_score * 1.0           // Active(25) | Testing(5) | Archived(-10)
  + content_count * 10.0 (max 50)          // Looms, screenshots, notes
  + confirmed_put_on_count * 5.0          // Network effect
```

**Recalculation triggers:** New content, status change, OAuth data, lineage confirmation.

### System 2: Reward Weight (Company Configuration)
**Purpose:** Determine how much credit/reward a company gives for a referral.  
**Owner:** Each individual company (configurable, optional).  
**Philosophy:** It's up to the company. If they want to reward all affiliates equally regardless of usage, that's their business decision.

**Company Config Options:**

| Config | Description |
|--------|-------------|
| **Flat Rate** | All affiliates get the same reward regardless of usage |
| **Usage-Based** | Reward scales with verified usage depth (tenure, activity) |
| **New Adopter Boost** | Extra reward for users in their first 30 days |
| **Servant Leader Bonus** | Extra reward for high-credibility, low-reach advocates |
| **Custom Rules** | Company defines their own weight tiers |

**Example:**
- Company A (Linear-style): "All referrals get $20. Usage doesn't matter."
- Company B (Notion-style): "Top 10% advocates get 50% off. Verified users get priority support."
- Company C (Custom): "New adopters get 2x credit for 30 days. Power users get exclusive swag."

## The Interaction Between Systems

```
User Profile Display:     Sorted by Credibility Weight (universal algorithm)
Company Reward Payout:    Determined by Reward Weight (company config)
```

A user can have:
- High credibility weight (displayed prominently on their profile)
- Low reward weight (company pays flat rate to everyone)
- Or vice versa: low credibility (new user) but high reward (company gives new adopter boost)

## Why This Separation Matters

1. **User profiles are honest.** Display is based on actual usage, not how much the company pays.
2. **Companies are autonomous.** They set their own economics without us dictating terms.
3. **No financial intermediation.** We don't hold money. We just expose the company's rules.
4. **Fraud resistance.** Credibility weight is hard to fake (requires usage proof). Reward weight is the company's problem to manage.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Single universal weight for both | Conflates display with economics. Companies want control over their reward structure. |
| props controls all reward rules | Makes us a financial intermediary. Violates ADR-003. |
| No credibility weight, only company weight | Profile becomes a paid billboard. Loses trust. |
| AI-generated "authenticity" score | Black box. Not explainable. Users won't trust it. |

## Consequences

### Positive
- User profiles remain credible and usage-based
- Companies get autonomy over their reward economics
- We stay out of the money flow
- "Servant Leaders" are visible even if companies pay flat rates

### Negative
- Two systems to explain instead of one
- Companies may configure reward rules that seem unfair (e.g., flat rate for everyone)
- Users may be confused why their high credibility doesn't translate to higher pay
- More complex company onboarding (need to explain config options)

## Mitigations
- Clear UI separation: "Your Profile Ranking" vs. "Company Reward Tiers"
- Default company config: "Usage-based" (nudges toward rewarding depth)
- Education: "Companies set their own rules. Your credibility is public regardless."

## Related
- ADR-003 (No Money Holding) — we don't process rewards, just display company rules
- ADR-007 (Company-Configurable Rewards) — the full reward configuration system
- ADR-001 (Email Passport) — provides credibility signals (tenure, activity)
