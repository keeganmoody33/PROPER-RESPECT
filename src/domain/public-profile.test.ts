import { describe, expect, it } from "vitest";
import {
  projectPublicProfile,
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
    expect(profile.cards[1].primaryLink.url).toBe("https://linear.app/keegan");
  });

  it("omits public props without an explicit primary link", () => {
    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
      props: [{ ...baseProp, links: [] }],
    });

    expect(profile.cards).toEqual([]);
  });
});
