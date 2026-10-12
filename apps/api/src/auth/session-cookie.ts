export const SESSION_COOKIE_NAME = 'sid';

export function readSessionToken(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;

    const raw = pair.slice(separator + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
