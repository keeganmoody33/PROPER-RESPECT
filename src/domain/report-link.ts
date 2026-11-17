const REPORT_ADDRESS = "33@lecturesfrom.com";

// Mail clients decode the subject before building headers, so a line break in it could start a new header.
const HEADER_BREAKS = /[\x00-\x1f\x7f-\x9f\u{2028}\u{2029}]+/gu;

/** A report by email, with the subject naming what is reported. The operator handles it by hand. Half of a broken character pair would make the encoding throw, so it becomes the replacement character first. */
export function reportHref(subject: string): string {
  return `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(subject.toWellFormed().replace(HEADER_BREAKS, " "))}`;
}
