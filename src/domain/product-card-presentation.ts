export function getProductCardPresentation(
  productName: string,
  position: number,
): { index: string; mark: string } {
  const uppercaseCharacters = [...productName].filter((character) =>
    /[A-Z0-9]/.test(character),
  );
  const words = productName.match(/[a-z0-9]+/gi) ?? [];
  const markSource =
    uppercaseCharacters.length >= 2
      ? uppercaseCharacters
      : words.map((word) => word[0]);

  return {
    index: String(position + 1).padStart(2, "0"),
    mark: markSource.join("").slice(0, 2).toUpperCase(),
  };
}
