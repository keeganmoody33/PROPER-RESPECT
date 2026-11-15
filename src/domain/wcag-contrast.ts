/** WCAG relative luminance and contrast of six-digit hex colours. */
const LINEAR_KNEE = 0.03928, LINEAR_DIVISOR = 12.92, GAMMA_OFFSET = 0.055, GAMMA_DIVISOR = 1.055, GAMMA = 2.4;
const LUMA = [0.2126, 0.7152, 0.0722] as const;
const CONTRAST_PAD = 0.05, CHANNEL_MAX = 255, HEX_RADIX = 16;
const CHANNEL_STARTS = [1, 3, 5] as const, CHANNEL_DIGITS = 2;

export const channels = (hex: string) => CHANNEL_STARTS.map(start => parseInt(hex.slice(start, start + CHANNEL_DIGITS), HEX_RADIX));

function luminance(hex: string) {
  return channels(hex).reduce((sum, value, index) => {
    const unit = value / CHANNEL_MAX;
    return sum + LUMA[index] * (unit <= LINEAR_KNEE ? unit / LINEAR_DIVISOR : ((unit + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA);
  }, 0);
}

export function contrast(first: string, second: string) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + CONTRAST_PAD) / (low + CONTRAST_PAD);
}
