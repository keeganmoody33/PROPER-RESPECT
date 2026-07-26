import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { activityModuleValidator } from "./validators";
import type { ActivityModule } from "../src/domain/public-profile";
import { canRefreshMetric } from "../src/domain/onboarding";
import { requireUser } from "./authHelpers";
import type { Id } from "./_generated/dataModel";

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const configured = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("CONNECTOR_ENCRYPTION_KEY is not configured.");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(configured),
  );
  return await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(secret),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

async function decryptSecret(ciphertext: string, iv: string) {
  const cleartext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    await encryptionKey(),
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(cleartext);
}

function contributionLevel(level: string) {
  return (
    {
      NONE: 0,
      FIRST_QUARTILE: 1,
      SECOND_QUARTILE: 2,
      THIRD_QUARTILE: 3,
      FOURTH_QUARTILE: 4,
    }[level] ?? 0
  );
}

type GithubResponse = {
  data?: {
    viewer?: {
      login: string;
      createdAt: string;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
              contributionLevel: string;
            }>;
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

async function fetchGithubActivity(token: string): Promise<{
  accountLabel: string;
  activity: ActivityModule;
  value: number;
}> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCFullYear(to.getUTCFullYear() - 1);
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "proper-respect",
    },
    body: JSON.stringify({
      query: `query ViewerActivity($from: DateTime!, $to: DateTime!) {
        viewer {
          login
          createdAt
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  contributionLevel
                }
              }
            }
          }
        }
      }`,
      variables: { from: from.toISOString(), to: to.toISOString() },
    }),
  });
  const body = (await response.json()) as GithubResponse;
  const viewer = body.data?.viewer;
  if (!response.ok || !viewer) {
    throw new Error(
      body.errors?.[0]?.message ?? `GitHub API error: ${response.status}`,
    );
  }
  const calendar = viewer.contributionsCollection.contributionCalendar;
  return {
    accountLabel: `github.com/${viewer.login}`,
    value: calendar.totalContributions,
    activity: {
      kind: "contributionCalendar",
      attributionScope: "PERSONAL",
      capturedAt: to.toISOString(),
      freshness: "FRESH",
      provenanceLabel: "GitHub account",
      period: {
        start: from.toISOString().slice(0, 10),
        end: to.toISOString().slice(0, 10),
        label: "Last 12 months",
      },
      total: calendar.totalContributions,
      memberSince: viewer.createdAt.slice(0, 10),
      days: calendar.weeks.flatMap((week) =>
        week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
          level: contributionLevel(day.contributionLevel),
        })),
      ),
    },
  };
}

type DevinUsage = {
  prs_created_count?: number;
  prs_merged_count?: number;
  searches_count?: number;
  sessions_count?: number;
};

async function fetchDevinActivity(
  token: string,
  organizationId: string,
): Promise<{
  accountLabel: string;
  activity: ActivityModule;
  value: number;
}> {
  const response = await fetch(
    `https://api.devin.ai/v3/organizations/${encodeURIComponent(organizationId)}/metrics/usage`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Devin API error: ${response.status}`);
  }
  const raw = (await response.json()) as DevinUsage & { data?: DevinUsage };
  const usage = raw.data ?? raw;
  const sessions = usage.sessions_count ?? 0;
  const capturedAt = new Date().toISOString();
  return {
    accountLabel: `Devin organization ${organizationId}`,
    value: sessions,
    activity: {
      kind: "headlineMetrics",
      attributionScope: "ORGANIZATION",
      capturedAt,
      freshness: "FRESH",
      provenanceLabel: "Devin organization metrics",
      primary: { label: "Sessions", value: sessions },
      supporting: [
        { label: "Searches", value: usage.searches_count ?? 0 },
        { label: "PRs created", value: usage.prs_created_count ?? 0 },
        { label: "PRs merged", value: usage.prs_merged_count ?? 0 },
      ],
    },
  };
}

const providerValidator = v.union(v.literal("GITHUB"), v.literal("DEVIN"));

export const saveConnectedSnapshot = internalMutation({
  args: {
    authSubject: v.string(),
    provider: providerValidator,
    accountLabel: v.string(),
    ciphertext: v.string(),
    iv: v.string(),
    product: v.object({
      name: v.string(),
      slug: v.string(),
      domain: v.string(),
      description: v.string(),
      logoUrl: v.optional(v.string()),
    }),
    activity: activityModuleValidator,
    metricKey: v.string(),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", args.authSubject),
      )
      .unique();
    if (!user) throw new Error("Complete account setup before connecting.");
    const now = new Date().toISOString();

    let secret = await ctx.db
      .query("connectorSecrets")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", args.provider),
      )
      .unique();
    if (secret) {
      await ctx.db.patch(secret._id, {
        ciphertext: args.ciphertext,
        iv: args.iv,
        rotatedAt: now,
      });
    } else {
      const secretId = await ctx.db.insert("connectorSecrets", {
        userId: user._id,
        provider: args.provider,
        ciphertext: args.ciphertext,
        iv: args.iv,
        createdAt: now,
      });
      secret = (await ctx.db.get(secretId))!;
    }

    let connector = await ctx.db
      .query("connectorAccounts")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", user._id).eq("provider", args.provider),
      )
      .unique();
    const connectorValue = {
      status: "CONNECTED" as const,
      accountLabel: args.accountLabel,
      attributionScope: args.activity.attributionScope,
      connectedAt: connector?.connectedAt ?? now,
      lastSyncedAt: now,
      lastError: undefined,
      secretRef: secret._id,
    };
    if (connector) {
      await ctx.db.patch(connector._id, connectorValue);
    } else {
      const connectorId = await ctx.db.insert("connectorAccounts", {
        userId: user._id,
        provider: args.provider,
        ...connectorValue,
      });
      connector = (await ctx.db.get(connectorId))!;
    }

    let product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.product.slug))
      .unique();
    if (!product) {
      const productId = await ctx.db.insert("products", args.product);
      product = (await ctx.db.get(productId))!;
    }

    const userProps = await ctx.db
      .query("props")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    let prop = userProps.find((item) => item.productId === product._id);
    if (!prop) {
      const propId = await ctx.db.insert("props", {
        userId: user._id,
        productId: product._id,
        status: "TESTING",
        visibility: "DRAFT",
        headline: `${product.name} is in my stack.`,
        note: "Connected activity is private until I approve this card.",
        startedAt:
          args.activity.kind === "contributionCalendar"
            ? args.activity.memberSince
            : undefined,
        startedAtSource:
          args.activity.kind === "contributionCalendar" &&
          args.activity.memberSince
            ? "AUTHORITATIVE"
            : undefined,
        activity: args.activity,
      });
      prop = (await ctx.db.get(propId))!;
      await ctx.db.insert("links", {
        propId,
        type: "CANONICAL",
        url: `https://${product.domain}`,
        label: `Open ${product.name}`,
        isPrimary: true,
      });
    } else if (prop.visibility === "DRAFT") {
      await ctx.db.patch(prop._id, { activity: args.activity });
    }

    await ctx.db.insert("usageSignals", {
      userId: user._id,
      propId: prop._id,
      metricKey: args.metricKey,
      value: args.value,
      capturedAt: args.activity.capturedAt,
      attributionScope: args.activity.attributionScope,
      evidenceRuleVersion: "provider-v1",
      visibility: "DRAFT",
    });

    const draft = await ctx.db
      .query("draftImports")
      .withIndex("by_user_slug", (q) =>
        q
          .eq("userId", user._id)
          .eq("suggestedProductSlug", product.slug),
      )
      .first();
    if (!draft) {
      await ctx.db.insert("draftImports", {
        userId: user._id,
        status: "PENDING",
        suggestedProductSlug: product.slug,
        suggestedProductName: product.name,
        suggestedDomain: product.domain,
        suggestedDescription: product.description,
        suggestedUrl: `https://${product.domain}`,
        rawEvidenceIds: [],
        resultPropId: prop._id,
      });
    }
    await ctx.db.patch(user._id, {
      onboardingStatus: "REVIEW",
      updatedAt: now,
    });
    return { connectorId: connector._id, propId: prop._id };
  },
});

export const connectGithub = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    { token },
  ): Promise<{
    connectorId: Id<"connectorAccounts">;
    propId: Id<"props">;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required.");
    const snapshot = await fetchGithubActivity(token);
    const encrypted = await encryptSecret(token);
    return await ctx.runMutation(internal.connectors.saveConnectedSnapshot, {
      authSubject: identity.subject,
      provider: "GITHUB",
      accountLabel: snapshot.accountLabel,
      ...encrypted,
      product: {
        name: "GitHub",
        slug: "github",
        domain: "github.com",
        description: "Code, collaboration, and shipped work.",
        logoUrl: "https://github.githubassets.com/favicons/favicon.svg",
      },
      activity: snapshot.activity,
      metricKey: "github.contributions",
      value: snapshot.value,
    });
  },
});

export const connectDevin = action({
  args: { token: v.string(), organizationId: v.string() },
  handler: async (
    ctx,
    { token, organizationId },
  ): Promise<{
    connectorId: Id<"connectorAccounts">;
    propId: Id<"props">;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required.");
    const snapshot = await fetchDevinActivity(token, organizationId);
    const encrypted = await encryptSecret(
      JSON.stringify({ token, organizationId }),
    );
    return await ctx.runMutation(internal.connectors.saveConnectedSnapshot, {
      authSubject: identity.subject,
      provider: "DEVIN",
      accountLabel: snapshot.accountLabel,
      ...encrypted,
      product: {
        name: "Devin",
        slug: "devin",
        domain: "devin.ai",
        description: "Autonomous software engineering activity.",
        logoUrl: "https://devin.ai/favicon.ico",
      },
      activity: snapshot.activity,
      metricKey: "devin.sessions",
      value: snapshot.value,
    });
  },
});

export const revokeConnector = mutation({
  args: { connectorId: v.id("connectorAccounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const connector = await ctx.db.get(args.connectorId);
    if (!connector || connector.userId !== user._id) {
      throw new Error("Connector not found.");
    }
    await ctx.db.patch(connector._id, {
      status: "REVOKED",
      lastError: undefined,
    });
    const subscriptions = await ctx.db
      .query("metricSubscriptions")
      .withIndex("by_connector", (q) =>
        q.eq("connectorId", connector._id),
      )
      .collect();
    const now = new Date().toISOString();
    for (const subscription of subscriptions) {
      await ctx.db.patch(subscription._id, { revokedAt: now });
    }
    if (connector.secretRef) {
      await ctx.db.delete(connector.secretRef);
    }
    await ctx.db.patch(connector._id, { secretRef: undefined });
  },
});

export const listRefreshWork = internalQuery({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.db
      .query("metricSubscriptions")
      .collect();
    return await Promise.all(
      subscriptions
        .filter((subscription) => !subscription.revokedAt)
        .map(async (subscription) => {
          const connector = await ctx.db.get(subscription.connectorId);
          const secret = connector?.secretRef
            ? await ctx.db.get(connector.secretRef)
            : null;
          return { subscription, connector, secret };
        }),
    );
  },
});

export const applyRefresh = internalMutation({
  args: {
    subscriptionId: v.id("metricSubscriptions"),
    activity: activityModuleValidator,
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return;
    if (
      !canRefreshMetric(subscription, {
        metricKey: subscription.metricKey,
        attributionScope: args.activity.attributionScope,
      })
    ) {
      throw new Error("Refresh exceeds the approved metric or scope.");
    }
    const connector = await ctx.db.get(subscription.connectorId);
    if (!connector || connector.status === "REVOKED") return;
    const prop = await ctx.db.get(subscription.propId);
    if (!prop || prop.visibility !== "PUBLIC") return;

    await ctx.db.patch(prop._id, { activity: args.activity });
    const [user, product] = await Promise.all([
      ctx.db.get(subscription.userId),
      ctx.db.get(prop.productId),
    ]);
    if (user && product) {
      const published = await ctx.db
        .query("publishedProfiles")
        .withIndex("by_handle", (q) => q.eq("handle", user.handle))
        .unique();
      if (published) {
        await ctx.db.patch(published._id, {
          revision: published.revision + 1,
          publishedAt: args.activity.capturedAt,
          profile: {
            ...published.profile,
            cards: published.profile.cards.map((card) =>
              card.product.slug === product.slug
                ? { ...card, activity: args.activity }
                : card,
            ),
          },
        });
      }
    }
    await ctx.db.insert("usageSignals", {
      userId: subscription.userId,
      propId: prop._id,
      metricKey: subscription.metricKey,
      value: args.value,
      capturedAt: args.activity.capturedAt,
      attributionScope: args.activity.attributionScope,
      evidenceRuleVersion: "provider-v1",
      visibility: "PUBLIC",
    });
    await ctx.db.patch(subscription._id, {
      lastAttemptedAt: args.activity.capturedAt,
      lastSuccessfulAt: args.activity.capturedAt,
      lastError: undefined,
    });
    await ctx.db.patch(connector._id, {
      status: "CONNECTED",
      lastSyncedAt: args.activity.capturedAt,
      lastError: undefined,
    });
  },
});

export const markRefreshFailed = internalMutation({
  args: {
    subscriptionId: v.id("metricSubscriptions"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return;
    const prop = await ctx.db.get(subscription.propId);
    if (prop?.activity) {
      const staleActivity = { ...prop.activity, freshness: "STALE" as const };
      await ctx.db.patch(prop._id, {
        activity: staleActivity,
      });
      const [user, product] = await Promise.all([
        ctx.db.get(subscription.userId),
        ctx.db.get(prop.productId),
      ]);
      if (user && product) {
        const published = await ctx.db
          .query("publishedProfiles")
          .withIndex("by_handle", (q) => q.eq("handle", user.handle))
          .unique();
        if (published) {
          await ctx.db.patch(published._id, {
            profile: {
              ...published.profile,
              cards: published.profile.cards.map((card) =>
                card.product.slug === product.slug
                  ? { ...card, activity: staleActivity }
                  : card,
              ),
            },
          });
        }
      }
    }
    const now = new Date().toISOString();
    await ctx.db.patch(subscription._id, {
      lastAttemptedAt: now,
      lastError: args.message,
    });
    await ctx.db.patch(subscription.connectorId, {
      status: "ERROR",
      lastError: args.message,
    });
  },
});

export const refreshApproved = internalAction({
  args: {},
  handler: async (ctx) => {
    const work = await ctx.runQuery(internal.connectors.listRefreshWork, {});
    for (const item of work) {
      if (!item.connector || !item.secret) continue;
      try {
        const cleartext = await decryptSecret(
          item.secret.ciphertext,
          item.secret.iv,
        );
        const snapshot =
          item.connector.provider === "GITHUB"
            ? await fetchGithubActivity(cleartext)
            : await (async () => {
                const parsed = JSON.parse(cleartext) as {
                  token: string;
                  organizationId: string;
                };
                return await fetchDevinActivity(
                  parsed.token,
                  parsed.organizationId,
                );
              })();
        await ctx.runMutation(internal.connectors.applyRefresh, {
          subscriptionId: item.subscription._id,
          activity: snapshot.activity,
          value: snapshot.value,
        });
      } catch (error) {
        await ctx.runMutation(internal.connectors.markRefreshFailed, {
          subscriptionId: item.subscription._id,
          message:
            error instanceof Error ? error.message : "Connector refresh failed.",
        });
      }
    }
  },
});
