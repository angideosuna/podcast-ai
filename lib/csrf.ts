// CSRF protection: validates Origin header on mutating API requests

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Checks if the Origin header matches the request's host.
 * Returns true (allowed) when:
 *  - No Origin header (non-browser client: curl, server-to-server)
 *  - Origin host matches request host (same-origin)
 * Returns false (blocked) when:
 *  - Origin host differs from request host (cross-origin)
 *  - Origin header is malformed
 */
export function isAllowedOrigin(requestHost: string, originHeader: string | null): boolean {
  if (!originHeader) return true;
  try {
    const origin = new URL(originHeader);
    return origin.host === requestHost;
  } catch {
    return false;
  }
}

/**
 * Determines if a request should be blocked by CSRF protection.
 * Only mutating methods (POST/PUT/PATCH/DELETE) to /api/* are checked.
 */
export function shouldBlockRequest(
  pathname: string,
  method: string,
  requestHost: string,
  originHeader: string | null
): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (!MUTATING_METHODS.has(method)) return false;
  return !isAllowedOrigin(requestHost, originHeader);
}
