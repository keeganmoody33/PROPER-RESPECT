import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "refresh approved product metrics",
  { hourUTC: 6, minuteUTC: 0 },
  internal.connectors.refreshApproved,
);

export default crons;
