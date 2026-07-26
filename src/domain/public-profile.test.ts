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

  it("keeps all four canonical starter cards tied to their own links", () => {
    const props: CuratedProp[] = KEEGAN_STARTER_CARDS.map((card) => ({
      visibility: "PUBLIC",
      status: card.status,
      headline: card.headline,
      note: card.note,
      startedAt: card.startedAt,
      product: card.product,
      links: [{ ...card.primaryLink, isPrimary: true }],
    }));

    const profile = projectPublicProfile({
      user: {
        handle: "keegan",
        displayName: "Keegan Moody",
        bio: "Builder.",
      },
      props,
    });

    expect(profile.cards.map((card) => card.product.name)).toEqual([
      "GitHub",
      "Wispr Flow",
      "NotebookLM",
      "Devin Desktop",
    ]);
    expect(profile.cards.map((card) => card.primaryLink.url)).toEqual(
      KEEGAN_STARTER_CARDS.map((card) => card.primaryLink.url),
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
