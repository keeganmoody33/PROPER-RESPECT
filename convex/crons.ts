import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "refresh approved product metrics",
  { hourUTC: 6, minuteUTC: 0 },
  internal.connectors.refreshApproved,
);

crons.interval(
  "refresh watched official product sources",
  { minutes: 15 },
  internal.productKnowledge.refreshDue,
);

// Accounts are disabled by default. Only explicit owner opt-in creates due work.
crons.interval(
  "refresh opted-in Gmail discovery",
  { minutes: 15 },
  internal.mailboxGoogle.refreshDue,
);

export default crons;
