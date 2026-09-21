const standardNumber = new Intl.NumberFormat("en", { notation: "standard", maximumFractionDigits: 1 });
const abbreviatedNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function compactNumber(value: number): string {
  return (value >= 10_000 ? abbreviatedNumber : standardNumber).format(value);
}
