import { z } from "zod";

// When the owner started using a tool. Usually a calendar date; when all they gave is a year ("since 2023"), it is
// kept as just that year, with no month or day made up (voice onboarding decision 6, 2026-11-17).

const YEAR_ONLY = /^\d{4}$/;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2023": a start date that names only its year. */
export const isYearOnly = (value: string) => YEAR_ONLY.test(value);

/** A real calendar date (YYYY-MM-DD) or a year (YYYY). */
export function isStartDate(value: string): boolean {
  if (isYearOnly(value)) return Number(value) > 0;
  if (!FULL_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const START_DATE_MESSAGE = "Use a real calendar date or a year, or leave it unknown.";
export const startDateSchema = z.string().refine(isStartDate, START_DATE_MESSAGE);
