// The only URL-scheme check. Publish, render, and origin gates call these
// functions. A second `url.protocol` read is the #106/#107 mistake.

function parsed(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasCredentials(url) {
  return Boolean(url.username || url.password);
}

export function isHttpProtocol(url) {
  return url.protocol === "http:";
}

export function isHttpsProtocol(url) {
  return url.protocol === "https:";
}

export function allowsWebProtocol(url) {
  return (isHttpProtocol(url) || isHttpsProtocol(url)) && !hasCredentials(url);
}

export function allowsHttpsProtocol(url) {
  return isHttpsProtocol(url) && !hasCredentials(url);
}

/** https, or http when the caller has already decided loopback HTTP is allowed. */
export function allowsOriginProtocol(url, allowHttp) {
  if (hasCredentials(url)) return false;
  if (isHttpsProtocol(url)) return true;
  return Boolean(allowHttp) && isHttpProtocol(url);
}

/** http or https, no embedded credentials. Never throws. */
export function isHttpUrl(value) {
  const url = parsed(value);
  return url !== null && allowsWebProtocol(url);
}

/** https only, no embedded credentials. Never throws. */
export function isHttpsUrl(value) {
  const url = parsed(value);
  return url !== null && allowsHttpsProtocol(url);
}

/**
 * Accept a bare host by assuming https. A value that already has a scheme
 * must be http(s) without credentials. Same rule as catalog and destination
 * parsing (#90, #106).
 */
export function parseLooseHttpUrl(value) {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withScheme);
    if (!allowsWebProtocol(url)) return null;
    return url;
  } catch {
    return null;
  }
}

export function httpsUrlHref(value) {
  const url = parsed(value);
  if (!url || !allowsHttpsProtocol(url)) return undefined;
  return url.href;
}

/** CSP reports name the blocked origin, or the scheme when the origin is opaque. */
export function blockedReportOrigin(value) {
  const url = new URL(value);
  return url.origin === "null" ? url.protocol.replace(/:$/, "") : url.origin;
}
