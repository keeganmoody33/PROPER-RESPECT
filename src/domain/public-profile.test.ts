import { describe, expect, it } from "vitest";
import {
  projectPublicProfile,
  projectPublicProfileV1,
  publicProfileV1Schema,
  type CuratedProp,
} from "./public-profile";

const baseProp: CuratedProp = {
  visibility: "PUBLIC",
  status: "ACTIVE",
  headline: "Where the receipts live.",
  note: "Public note",
  product: {
    name: "GitHub",
    slug: "github",
    domain: "github.com",
    description: "Code and collaboration.",
  },
  links: [
    {
      type: "CANONICAL",
      url: "https://github.com/keeganmoody33",
      label: "See Keegan on GitHub",
      isPrimary: true,
    },
  ],
};

describe("projectPublicProfile", () => {
  it("keeps costs private by default and supports all-public, all-private, and per-card choices", () => {
    const cost = { amount: 12.34, currency: "USD", cadence: "MONTHLY" as const, basis: "RECEIPT" as const, asOf: "2026-09-01" };
    const user = { handle: "example", displayName: "Example", bio: "" };
    const props = [{ ...baseProp, cost }, { ...baseProp, cost: { ...cost, amount: 23.45 } }];
    const project = (choices: Array<"PUBLIC" | "PRIVATE" | undefined>) => projectPublicProfile({ user, props: props.map((prop, i) => ({ ...prop, costVisibility: choices[i] })) });
    expect(project([undefined, undefined]).cards.every(card => card.cost === undefined)).toBe(true);
    expect(project(["PRIVATE", "PRIVATE"]).cards.every(card => card.cost === undefined)).toBe(true);
    expect(project(["PUBLIC", "PUBLIC"]).cards.map(card => card.cost?.amount)).toEqual([12.34, 23.45]);
    expect(project(["PUBLIC", "PRIVATE"]).cards.map(card => card.cost?.amount)).toEqual([12.34, undefined]);
    expect(projectPublicProfile({ user, props: [{ ...props[0], visibility: "PRIVATE", costVisibility: "PUBLIC" }] }).cards).toEqual([]);
  });
  it("publishes an approved activity module without raw evidence", () => {
    const propWithPrivateEvidence: CuratedProp & {
      privateEvidence: { payload: string };
    } = {
      ...baseProp,
      product: {
        ...baseProp.product,
        logoUrl: "https://github.githubassets.com/favicons/favicon.svg",
      },
      activity: {
        kind: "contributionCalendar",
        attributionScope: "PERSONAL",
        capturedAt: "2026-07-26T12:00:00.000Z",
        freshness: "FRESH",
        provenanceLabel: "GitHub public profile",
        total: 523,
        memberSince: "2024-01-01",
        days: [
          {
            date: "2026-07-25",
            count: 4,
            level: 3,
          },
        ],
      },
      privateEvidence: {
        payload: "private-repository-name",
      },
    };

    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
      props: [propWithPrivateEvidence],
    });

    expect(profile.cards[0].product.logoUrl).toContain("githubassets.com");
    expect(profile.cards[0].activity).toMatchObject({
      kind: "contributionCalendar",
      total: 523,
      attributionScope: "PERSONAL",
    });
    expect(JSON.stringify(profile)).not.toContain("private-repository-name");
  });

  it("publishes only public props", () => {
    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
      props: [
        baseProp,
        {
          ...baseProp,
          visibility: "DRAFT",
          note: "draft secret",
        },
        {
          ...baseProp,
          visibility: "PRIVATE",
          note: "private secret",
        },
      ],
    });

    expect(profile.cards).toHaveLength(1);
    expect(JSON.stringify(profile)).not.toContain("draft secret");
    expect(JSON.stringify(profile)).not.toContain("private secret");
  });

  it("keeps each card tied to its own product", () => {
    const linearProp: CuratedProp = {
      ...baseProp,
      note: "Linear note",
      product: {
        name: "Linear",
        slug: "linear",
        domain: "linear.app",
        description: "Issue tracking.",
      },
      links: [
        {
          type: "CANONICAL",
          url: "https://linear.app/keegan",
          label: "See Keegan on Linear",
          isPrimary: true,
        },
      ],
    };

    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
      props: [baseProp, linearProp],
    });

    expect(profile.cards.map((card) => card.product.slug)).toEqual([
      "github",
      "linear",
    ]);
    expect(profile.cards[1].product.domain).toBe("linear.app");
    expect(profile.cards[1].primaryLink?.url).toBe("https://linear.app/keegan");
  });

  it("preserves an explicitly shared owner-described product without inventing a website", () => {
    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
      props: [{ ...baseProp, product: { ...baseProp.product, domain: "" }, goTo: true, links: [] }],
    });

    expect(profile.cards).toHaveLength(1);
    expect(profile.cards[0]).toMatchObject({ goTo: true, product: { domain: "" } });
    expect(profile.cards[0].primaryLink).toBeUndefined();
  });

  it("preserves complete cards for v1 readers and omits only cards their contract cannot represent", () => {
    const profile = projectPublicProfile({
      user: { handle: "owner", displayName: "Owner", bio: "" },
      props: [
        baseProp,
        { ...baseProp, product: { ...baseProp.product, domain: "" } },
        { ...baseProp, links: [] },
      ],
    });

    expect(publicProfileV1Schema.safeParse(profile).success).toBe(false);
    expect(projectPublicProfileV1(profile)).toEqual({ ...profile, cards: [profile.cards[0]] });
    // Compatibility is a read projection, never a mutation of the approved v2 snapshot.
    expect(profile.cards).toHaveLength(3);
    expect(profile.cards[1].product.domain).toBe("");
    expect(profile.cards[2].primaryLink).toBeUndefined();
  });
});
