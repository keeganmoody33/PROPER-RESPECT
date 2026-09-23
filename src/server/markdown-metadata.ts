export type MarkdownMetadata = Readonly<{
  title: string;
  description?: string;
  canonical: URL;
}>;

function yamlString(value: string): string {
  return JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/g, character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function markdownWithMetadata(body: string, metadata: MarkdownMetadata): string {
  return [
    "---",
    `title: ${yamlString(metadata.title)}`,
    ...(metadata.description === undefined ? [] : [`description: ${yamlString(metadata.description)}`]),
    `canonical: ${yamlString(metadata.canonical.href)}`,
    "---",
    "",
    body,
  ].join("\n");
}
