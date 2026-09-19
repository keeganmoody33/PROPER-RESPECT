import { describe, expect, it } from "vitest";
import { isProductWebsite, privateCardPrimaryLink } from "./product-destination";

const github = { name: "GitHub", slug: "github", domain: "github.com" };
const copilot = { name: "GitHub Copilot", slug: "github-copilot", domain: "github.com" };
const homepage = {
  type: "CANONICAL" as const,
  url: "https://github.com",
  label: "Check out GitHub",
  isPrimary: true,
};
const ownerEvidence = {
  relationshipOwnerId: "owner",
  evidenceOwnerId: "owner",
  productSlug: "github",
  accountId: "synthetic-account",
  url: "https://github.com/synthetic-account",
};

describe("privateCardPrimaryLink", () => {
  it("opens the retained GitHub account page instead of the vendor homepage", () => {
    expect(privateCardPrimaryLink({
      product: github,
      links: [homepage],
      associatedEvidence: [ownerEvidence],
    })).toEqual({
      type: "CANONICAL",
      url: "https://github.com/synthetic-account",
      label: "Check out GitHub",
    });
  });

  it("keeps the product website when no owned account evidence is attached", () => {
    expect(privateCardPrimaryLink({
      product: github,
      links: [homepage],
      associatedEvidence: [],
    })).toEqual({ type: "CANONICAL", url: "https://github.com", label: "Check out GitHub" });
  });

  it("does not invent an account from the product name, Clerk handle, or email", () => {
    expect(privateCardPrimaryLink({
      product: github,
      links: [homepage],
      associatedEvidence: [{
        relationshipOwnerId: "owner",
        evidenceOwnerId: "owner",
        productSlug: "github",
        accountId: "owner@github.com",
        url: "https://github.com",
      }],
    })?.url).toBe("https://github.com");
    expect(privateCardPrimaryLink({
      product: { ...github, name: "keeganmoody33" },
      links: [homepage],
      associatedEvidence: [],
    })?.url).toBe("https://github.com");
  });

  it("rejects another owner's GitHub account evidence", () => {
    expect(privateCardPrimaryLink({
      product: github,
      links: [homepage],
      associatedEvidence: [{
        ...ownerEvidence,
        evidenceOwnerId: "other",
        accountId: "other-account",
        url: "https://github.com/other-account",
      }],
    })?.url).toBe("https://github.com");
  });

  it("does not borrow GitHub account evidence for a different product", () => {
    expect(privateCardPrimaryLink({
      product: copilot,
      links: [{
        type: "CANONICAL",
        url: "https://github.com/features/copilot",
        label: "Check out GitHub Copilot",
        isPrimary: true,
      }],
      associatedEvidence: [{ ...ownerEvidence, productSlug: "github-copilot" }],
    })?.url).toBe("https://github.com/features/copilot");
  });

  it("preserves an explicit owner-selected link that is not the product website", () => {
    expect(privateCardPrimaryLink({
      product: github,
      links: [{
        type: "REFERRAL",
        url: "https://github.com/synthetic-account/selected-work",
        label: "Selected work sample",
        isPrimary: true,
      }],
      associatedEvidence: [ownerEvidence],
    })).toEqual({
      type: "REFERRAL",
      url: "https://github.com/synthetic-account/selected-work",
      label: "Selected work sample",
    });
  });

  it("treats www and trailing-slash homepages as the vendor site", () => {
    expect(isProductWebsite("https://www.github.com/", github)).toBe(true);
    expect(isProductWebsite("https://github.com/synthetic-account", github)).toBe(false);
    expect(privateCardPrimaryLink({
      product: github,
      links: [{ ...homepage, url: "https://www.github.com/" }],
      associatedEvidence: [ownerEvidence],
    })?.url).toBe("https://github.com/synthetic-account");
  });
});
