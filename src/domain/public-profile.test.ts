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
