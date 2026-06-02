/** Absolute origin (scheme + host) for the incoming request. */
export function requestOrigin(requestUrl: string): string {
  return new URL(requestUrl).origin;
}

/** Join origin with a path (e.g. `/vaults`). */
export function absoluteUrl(requestUrl: string, path: string): string {
  return new URL(path, requestOrigin(requestUrl)).href;
}
