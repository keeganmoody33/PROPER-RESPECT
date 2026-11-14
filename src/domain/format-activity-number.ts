const standardNumber = new Intl.NumberFormat("en", { notation: "standard", maximumFractionDigits: 1 });
const abbreviatedNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
/** The most fraction digits Intl allows, so a number shown in full keeps every digit it has. */
const ALL_FRACTION_DIGITS = 20;
const fullNumberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: ALL_FRACTION_DIGITS });
const groupedWhole = new Intl.NumberFormat("en");

export function compactNumber(value: number): string {
  return (value >= 10_000 ? abbreviatedNumber : standardNumber).format(value);
}

/** A number shown in full, grouped in thousands: 48360 reads "48,360". */
export function fullNumber(value: number): string {
  return fullNumberFormat.format(value);
}

/**
 * A published measurement's exact decimal string, grouped in thousands: "2140000" reads "2,140,000".
 * The whole part goes through BigInt and the fraction is kept as written, so no digit is rounded away.
 */
export function groupedDecimal(value: string): string {
  const [whole, fraction] = value.split(".");
  const grouped = groupedWhole.format(BigInt(whole));
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
