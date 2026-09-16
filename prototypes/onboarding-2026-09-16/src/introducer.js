// 2026-09-16: Interpret only what was entered. Never resolve or verify an identity.
const knownHosts = new Map([
  ['github.com', 'GitHub'], ['x.com', 'X'], ['twitter.com', 'X'],
  ['linkedin.com', 'LinkedIn'], ['youtube.com', 'YouTube'], ['youtu.be', 'YouTube'],
  ['instagram.com', 'Instagram'], ['bsky.app', 'Bluesky'],
  ['tiktok.com', 'TikTok'], ['threads.net', 'Threads'], ['threads.com', 'Threads'],
]);
export const platforms = ['GitHub', 'LinkedIn', 'X', 'YouTube', 'Instagram', 'Bluesky', 'TikTok', 'Threads', 'Mastodon', 'Website', 'Other'];

export function interpretIntroducer(raw = '') {
  const value = raw.trim();
  const plain = { kind: value ? 'text' : 'empty', platform: '', url: '', host: '' };
  if (/^@[^\s/]+$/u.test(value)) return { ...plain, kind: 'handle' };
  // Arbitrary text and email addresses stay text. Only explicit web URLs or bare domains become links.
  const domain = /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}(?::\d+)?(?:[/?#][^\s]*)?$/i;
  const explicitWeb = /^https?:\/\//i.test(value);
  if (/\s/.test(value) || (!explicitWeb && !domain.test(value))) return plain;
  try {
    const url = new URL(explicitWeb ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return plain;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return { kind: 'link', platform: knownHosts.get(host) || 'Website', url: url.href, host };
  } catch { return plain; }
}

export function creditPlatform(raw, override) {
  return override === 'unspecified' ? '' : override || interpretIntroducer(raw).platform;
}
