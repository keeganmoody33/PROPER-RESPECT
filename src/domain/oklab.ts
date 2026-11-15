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
const product = (matrix: readonly (readonly number[])[], vector: readonly number[]) =>
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

const FROM_LAB = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
] as const;
const FROM_LMS = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
] as const;
const ENCODE_KNEE = 0.0031308, GAMUT_SLACK = 1e-6, GAMUT_STEPS = 24;
const encode = (unit: number) => (unit <= ENCODE_KNEE ? unit * LINEAR_DIVISOR : GAMMA_DIVISOR * unit ** (1 / GAMMA) - GAMMA_OFFSET);
const linearRgb = ([lightness, a, b]: OkLab) => product(FROM_LMS, product(FROM_LAB, [lightness, a, b]).map(value => value ** 3));
const inGamut = (rgb: readonly number[]) => rgb.every(value => value >= -GAMUT_SLACK && value <= 1 + GAMUT_SLACK);

/**
 * The sRGB colour at this OKLab point. One outside sRGB keeps its lightness and hue and gives up only as much chroma as
 * brings it inside, so a shifted brand colour stays the same hue.
 */
export function fromOklab([lightness, a, b]: OkLab): string {
  let [low, high] = [0, 1];
  if (!inGamut(linearRgb([lightness, a, b]))) {
    for (let step = 0; step < GAMUT_STEPS; step += 1) {
      const middle = (low + high) / 2;
      if (inGamut(linearRgb([lightness, a * middle, b * middle]))) low = middle; else high = middle;
    }
  } else low = 1;
  return `#${linearRgb([lightness, a * low, b * low]).map(value => Math.round(Math.min(1, Math.max(0, encode(value))) * CHANNEL_MAX).toString(HEX_RADIX).padStart(CHANNEL_DIGITS, "0")).join("")}`;
}
