import { expect, test } from "vitest";
import { creditHref, creditInputSchema, creditText, listedCredit, normalizeCredit, CREDIT_PLATFORMS, CREDIT_OTHER_HANDLE_MAX, CREDIT_OTHER_PLATFORM_MAX, type CreditPlatform } from "./props-credit";

// R03's bad-URL set, beside one good https link.
const X_HANDLE_MAX = 15;
const BAD_LINKS = ["javascript:alert(1)", "data:text/html,x", "ftp://x.com/jack", "https://user:pass@x.com/jack"];

test("the platforms are offered in this order, Proper Respect first", () => {
  expect(CREDIT_PLATFORMS.map(platform => platform.label)).toEqual(["Proper Respect", "X", "LinkedIn", "GitHub", "YouTube", "Instagram", "Substack", "Other"]);
});

test("a typed handle, a pasted @ and a pasted profile link all save as the same handle", () => {
  const cases = [
    ["PROPER_RESPECT", "@LecturesFrom", "lecturesfrom"],
    ["PROPER_RESPECT", "https://proper-respect.com/lecturesfrom", "lecturesfrom"],
    ["X", "@jack", "jack"],
    ["X", "https://x.com/jack", "jack"],
    ["X", "https://twitter.com/jack/", "jack"],
    ["LINKEDIN", "https://www.linkedin.com/in/jane-doe/", "jane-doe"],
    ["LINKEDIN", "jane-doe", "jane-doe"],
    ["GITHUB", "https://github.com/keeganmoody33", "keeganmoody33"],
    ["GITHUB", "@keeganmoody33", "keeganmoody33"],
    ["YOUTUBE", "https://www.youtube.com/@mkbhd", "mkbhd"],
    ["YOUTUBE", "@mkbhd", "mkbhd"],
    ["YOUTUBE", "https://www.youtube.com/@%E3%83%A6%E3%83%BC", "ユー"],
    ["INSTAGRAM", "https://www.instagram.com/jane.doe_/", "jane.doe_"],
    ["SUBSTACK", "https://substack.com/@janedoe", "janedoe"],
    ["SUBSTACK", "@janedoe", "janedoe"],
  ] as const;
  expect(cases.map(([platform, handle]) => normalizeCredit({ platform, handle })))
    .toEqual(cases.map(([platform, , saved]) => ({ ok: true, credit: { platform, handle: saved } })));
});

test("a blank handle saves no credit", () => {
  expect(normalizeCredit({ platform: "X", handle: "  " })).toEqual({ ok: true, credit: undefined });
  expect(normalizeCredit({ platform: "OTHER", handle: " ", platformName: "Slack" })).toEqual({ ok: true, credit: undefined });
  expect(normalizeCredit(undefined)).toEqual({ ok: true, credit: undefined });
});

test("a handle outside its platform's rule is refused with a message the owner can act on", () => {
  const refused = (platform: CreditPlatform, handle: string) => normalizeCredit({ platform, handle });
  expect(refused("PROPER_RESPECT", "-dash")).toEqual({ ok: false, message: "Enter a Proper Respect handle: up to 39 lowercase letters, numbers or hyphens, starting and ending with a letter or number." });
  expect(refused("X", "a".repeat(X_HANDLE_MAX + 1))).toEqual({ ok: false, message: "Enter an X handle: up to 15 letters, numbers or underscores." });
  expect(refused("LINKEDIN", "jo")).toEqual({ ok: false, message: "Enter the part of their LinkedIn profile link after /in/: 3 to 100 letters, numbers or hyphens." });
  expect(refused("GITHUB", "pricing")).toEqual({ ok: false, message: "Enter a GitHub username: up to 39 letters, numbers or single hyphens, not starting or ending with a hyphen." });
  expect(refused("GITHUB", "-jo")).toEqual(refused("GITHUB", "pricing"));
  expect(refused("YOUTUBE", "_mkbhd")).toEqual({ ok: false, message: "Enter a YouTube handle: 3 to 30 letters, numbers, underscores, hyphens or periods, starting and ending with a letter or number." });
  expect(refused("YOUTUBE", "ab")).toEqual(refused("YOUTUBE", "_mkbhd"));
  expect(refused("INSTAGRAM", "jane..doe")).toEqual({ ok: false, message: "Enter an Instagram username: up to 30 letters, numbers, periods or underscores, with no period first, last or twice in a row." });
  expect(refused("INSTAGRAM", ".jane")).toEqual(refused("INSTAGRAM", "jane..doe"));
  expect(refused("SUBSTACK", "jane-doe")).toEqual({ ok: false, message: "Enter a Substack handle: 4 to 32 letters or numbers, from their substack.com/@ profile." });
});

test("a pasted link that isn't a profile on that platform is refused, never followed", () => {
  const notAProfile = (label: string) => ({ ok: false, message: `That link isn't a profile on ${label}. Paste their ${label} profile link or just the handle.` });
  const pasted = BAD_LINKS.filter(link => link.includes("/"));
  expect(pasted.map(handle => normalizeCredit({ platform: "X", handle }))).toEqual(pasted.map(() => notAProfile("X")));
  expect(normalizeCredit({ platform: "X", handle: "javascript:alert(1)" })).toEqual({ ok: false, message: "Enter an X handle: up to 15 letters, numbers or underscores." });
  expect(normalizeCredit({ platform: "X", handle: "https://x.com.evil.example/jack" })).toEqual(notAProfile("X"));
  expect(normalizeCredit({ platform: "X", handle: "https://x.com/jack/status/1" })).toEqual(notAProfile("X"));
  expect(normalizeCredit({ platform: "SUBSTACK", handle: "https://janedoe.substack.com/" })).toEqual(notAProfile("Substack"));
  expect(normalizeCredit({ platform: "LINKEDIN", handle: "https://www.linkedin.com/company/acme" })).toEqual(notAProfile("LinkedIn"));
  expect(normalizeCredit({ platform: "PROPER_RESPECT", handle: "https://proper-respect.com.evil.example/jack" })).toEqual(notAProfile("Proper Respect"));
});

test("Other keeps the owner's words and the platform they typed, short and plain", () => {
  expect(normalizeCredit({ platform: "OTHER", handle: "  a teammate ", platformName: " Slack " }))
    .toEqual({ ok: true, credit: { platform: "OTHER", handle: "a teammate", platformName: "Slack" } });
  expect(normalizeCredit({ platform: "OTHER", handle: "a teammate" }))
    .toEqual({ ok: false, message: `Say where they are, in ${CREDIT_OTHER_PLATFORM_MAX} characters or fewer.` });
  expect(normalizeCredit({ platform: "OTHER", handle: "a".repeat(CREDIT_OTHER_HANDLE_MAX + 1), platformName: "Slack" }))
    .toEqual({ ok: false, message: `Keep their name or handle to ${CREDIT_OTHER_HANDLE_MAX} characters, in plain text.` });
  expect(normalizeCredit({ platform: "OTHER", handle: "a‮teammate", platformName: "Slack" }))
    .toEqual({ ok: false, message: `Keep their name or handle to ${CREDIT_OTHER_HANDLE_MAX} characters, in plain text.` });
});

test("a credit's link is built only from the platform's own host and the encoded handle", () => {
  expect([
    creditHref({ platform: "X", handle: "jack" }),
    creditHref({ platform: "LINKEDIN", handle: "jane-doe" }),
    creditHref({ platform: "GITHUB", handle: "keeganmoody33" }),
    creditHref({ platform: "YOUTUBE", handle: "ユー" }),
    creditHref({ platform: "INSTAGRAM", handle: "jane.doe_" }),
    creditHref({ platform: "SUBSTACK", handle: "janedoe" }),
    creditHref({ platform: "PROPER_RESPECT", handle: "lecturesfrom", linked: true }),
  ]).toEqual([
    "https://x.com/jack",
    "https://www.linkedin.com/in/jane-doe",
    "https://github.com/keeganmoody33",
    "https://www.youtube.com/@%E3%83%A6%E3%83%BC",
    "https://www.instagram.com/jane.doe_/",
    "https://substack.com/@janedoe",
    "https://proper-respect.com/lecturesfrom",
  ]);
});

test("a Proper Respect handle with no published profile, and any Other credit, are never links", () => {
  expect(creditHref({ platform: "PROPER_RESPECT", handle: "lecturesfrom" })).toBeUndefined();
  expect(creditHref({ platform: "PROPER_RESPECT", handle: "lecturesfrom", linked: true })).toBe("https://proper-respect.com/lecturesfrom");
  expect(creditHref({ platform: "OTHER", handle: "https://x.com/jack", platformName: "X" })).toBeUndefined();
});

test("a stored credit that no longer fits its platform's rule reads as no credit, and is never a link", () => {
  const stored = [
    ...BAD_LINKS.map(handle => ({ platform: "X", handle })),
    { platform: "X", handle: "@jack" },
    { platform: "PROPER_RESPECT", handle: "LecturesFrom", linked: true },
    { platform: "PROPER_RESPECT", handle: "lecturesfrom", linked: "yes" },
    { platform: "MYSPACE", handle: "jack" },
    { platform: "OTHER", handle: "a teammate" },
    { platform: "OTHER", handle: "a teammate", platformName: "x".repeat(CREDIT_OTHER_PLATFORM_MAX + 1) },
    "jack",
    undefined,
  ];
  expect(stored.map(listedCredit)).toEqual(stored.map(() => undefined));
  expect(stored.map(credit => creditHref(credit))).toEqual(stored.map(() => undefined));
});

test("a stored credit that fits reads back as stored, without fields it doesn't hold", () => {
  expect(listedCredit({ platform: "PROPER_RESPECT", handle: "lecturesfrom", linked: true, extra: 1 }))
    .toEqual({ platform: "PROPER_RESPECT", handle: "lecturesfrom", linked: true });
  expect(listedCredit({ platform: "X", handle: "jack", linked: true })).toEqual({ platform: "X", handle: "jack" });
  expect(listedCredit({ platform: "OTHER", handle: "a teammate", platformName: "Slack" }))
    .toEqual({ platform: "OTHER", handle: "a teammate", platformName: "Slack" });
});

test("a credit reads as Props to the person and where they are", () => {
  expect([
    creditText({ platform: "X", handle: "jack" }),
    creditText({ platform: "LINKEDIN", handle: "jane-doe" }),
    creditText({ platform: "PROPER_RESPECT", handle: "lecturesfrom" }),
    creditText({ platform: "OTHER", handle: "a teammate", platformName: "Slack" }),
  ]).toEqual([
    { name: "@jack", platform: "X" },
    { name: "jane-doe", platform: "LinkedIn" },
    { name: "@lecturesfrom", platform: "Proper Respect" },
    { name: "a teammate", platform: "Slack" },
  ]);
});

test("a pasted profile link for the longest non-Latin YouTube handle fits the input and saves as that handle", () => {
  const handle = "д".repeat(30);
  const pasted = `https://www.youtube.com/@${encodeURIComponent(handle)}?si=AbCdEfGhIjKlMnOp`;
  expect(creditInputSchema.safeParse({ platform: "YOUTUBE", handle: pasted }).success).toBe(true);
  expect(normalizeCredit({ platform: "YOUTUBE", handle: pasted })).toEqual({ ok: true, credit: { platform: "YOUTUBE", handle } });
});
