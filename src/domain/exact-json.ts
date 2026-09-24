/** Numeric tokens are kept outside JavaScript's binary-number representation. */
export class ExactJsonNumber {
  readonly lexeme: string;
  constructor(lexeme: string) { this.lexeme = lexeme; }
}
export type ExactJson = null | boolean | string | ExactJsonNumber | ExactJson[] | { [key: string]: ExactJson };

/** Deliberately bounded decoder; duplicate decoded keys reject before assignment. */
export function parseExactJson(text: string): ExactJson {
  const invalid = () => new Error("Invalid exact JSON.");
  try {
    if (typeof text !== "string" || text.length > 256_000 || new TextEncoder().encode(text).length > 256_000) throw invalid();
    let offset = 0, nodes = 0;
    const space = () => { while (/^[\x20\t\r\n]$/.test(text[offset] ?? "")) offset++; };
    const string = () => {
      const start = offset++;
      while (offset < text.length) {
        const ch = text[offset++];
        if (ch === "\\") { offset++; continue; }
        if (ch === '"') {
          const value: string = JSON.parse(text.slice(start, offset));
          if (value.length > 8192 || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw invalid();
          return value;
        }
      }
      throw invalid();
    };
    const value = (depth: number): ExactJson => {
      if (++nodes > 30_000 || depth > 24) throw invalid();
      space();
      const ch = text[offset];
      if (ch === '"') return string();
      if (ch === "{" || ch === "[") {
        offset++; space();
        const object: { [key: string]: ExactJson } = Object.create(null);
        const array: ExactJson[] = [];
        const end = ch === "{" ? "}" : "]";
        if (text[offset] === end) { offset++; return ch === "{" ? object : array; }
        let size = 0;
        while (true) {
          if (++size > 4096) throw invalid();
          if (ch === "{") {
            if (text[offset] !== '"') throw invalid();
            const key = string(); space();
            if (Object.hasOwn(object, key) || text[offset++] !== ":") throw invalid();
            object[key] = value(depth + 1);
          } else array.push(value(depth + 1));
          space();
          if (text[offset] === end) { offset++; return ch === "{" ? object : array; }
          if (text[offset++] !== ",") throw invalid();
          space();
        }
      }
      for (const [literal, result] of [["true", true], ["false", false], ["null", null]] as const) {
        if (text.startsWith(literal, offset)) { offset += literal.length; return result; }
      }
      const numeric = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(offset));
      if (!numeric || numeric[0].length > 160) throw invalid();
      offset += numeric[0].length;
      return new ExactJsonNumber(numeric[0]);
    };
    const result = value(0); space();
    if (offset !== text.length) throw invalid();
    return result;
  } catch { throw invalid(); }
}
