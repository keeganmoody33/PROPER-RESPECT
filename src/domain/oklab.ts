/** OKLab (Björn Ottosson, 2020): a colour space where straight-line distance tracks how different two colours look. */
const HEX_RADIX = 16, CHANNEL_MAX = 255, CHANNEL_DIGITS = 2;
const CHANNEL_STARTS = [1, 3, 5] as const;
const LINEAR_KNEE = 0.04045, LINEAR_DIVISOR = 12.92, GAMMA_OFFSET = 0.055, GAMMA_DIVISOR = 1.055, GAMMA = 2.4;
const TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
] as const;
const TO_LAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
] as const;
// A six-digit hex colour. Accepts "#24c45c"; rejects "#24c45c80" and "green".
// https://regex101.com/?regex=%5E%23%5B0-9a-f%5D%7B6%7D%24&flags=i&testString=%2324c45c%0A%2324c45c80%0Agreen
const SOLID_HEX = /^#[0-9a-f]{6}$/i;

export type OkLab = readonly [lightness: number, a: number, b: number];

const linear = (unit: number) => (unit <= LINEAR_KNEE ? unit / LINEAR_DIVISOR : ((unit + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA);
const product = (matrix: typeof TO_LMS | typeof TO_LAB, vector: readonly number[]) =>
  matrix.map(row => row.reduce((sum, weight, index) => sum + weight * vector[index], 0));

export function oklab(hex: string): OkLab {
  if (!SOLID_HEX.test(hex)) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const rgb = CHANNEL_STARTS.map(start => linear(parseInt(hex.slice(start, start + CHANNEL_DIGITS), HEX_RADIX) / CHANNEL_MAX));
  const [lightness, a, b] = product(TO_LAB, product(TO_LMS, rgb).map(Math.cbrt));
  return [lightness, a, b];
}

/** How colourful a colour is, independent of its lightness: 0 for greys, about 0.3 for the most vivid sRGB colours. */
export function oklchChroma(hex: string): number {
  const [, a, b] = oklab(hex);
  return Math.hypot(a, b);
}

export function oklabDistance(first: string, second: string): number {
  const [x, y] = [oklab(first), oklab(second)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
