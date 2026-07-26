import { describe, expect, it } from "vitest";
import {
  projectPublicProfile,
  type CuratedProp,
} from "./public-profile";
import { KEEGAN_STARTER_CARDS } from "./keegan-starter-profile";

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

  it("keeps canonical starter cards and future public props tied to their own links", () => {
    const starterProps: CuratedProp[] = KEEGAN_STARTER_CARDS.map((card) => ({
      visibility: "PUBLIC",
      status: card.status,
      headline: card.headline,
      note: card.note,
      startedAt: card.startedAt,
      product: card.product,
      links: [{ ...card.primaryLink, isPrimary: true }],
    }));
    const futurePublicProp: CuratedProp = {
      ...baseProp,
      headline: "A future public product.",
      product: {
        name: "Future Product",
        slug: "future-product",
        domain: "future.example",
        description: "A product added after the starter set.",
      },
      links: [
        {
          type: "CANONICAL",
          url: "https://future.example/keegan",
          label: "See Keegan on Future Product",
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
      props: [...starterProps, futurePublicProp],
    });

    expect(profile.cards.map((card) => card.product.name)).toEqual([
      "GitHub",
      "Wispr Flow",
      "NotebookLM",
      "Devin Desktop",
      "Future Product",
    ]);
    expect(profile.cards.map((card) => card.primaryLink.url)).toEqual(
      [
        ...KEEGAN_STARTER_CARDS.map((card) => card.primaryLink.url),
        "https://future.example/keegan",
      ],
    );
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
