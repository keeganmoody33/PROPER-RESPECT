const REPORT_ADDRESS = "33@lecturesfrom.com";

/** A report by email, with the subject naming what is reported. The operator handles it by hand. */
export function reportHref(subject: string): string {
  return `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(subject)}`;
}
