/**
 * Browser-side user identity.
 *
 * RBAC: registering a contract and mutating the watchlist require a user that
 * has been granted at least the contributor role in the API's users table.
 * Until a real auth flow exists, the dashboard identifies itself with a
 * localStorage value forwarded to the API as `X-User-ID`. It must map to a
 * user with at least the contributor role.
 */

/** localStorage key holding the browser identity. */
export const USER_STORAGE_KEY = "sorolens_user_id";

/**
 * Reads the current user id, or `""` when there is none.
 *
 * localStorage can be unavailable (private mode, some test runners), in which
 * case this returns an empty string. Callers tolerate that because anonymous
 * reads remain open; only writes need the identity.
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(USER_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/** Sets or overrides the browser's persistent user identity. */
export function setUserId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(USER_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failure
  }
}

/**
 * Returns existing user ID, or creates and stores a stable anonymous identity.
 */
export function ensureUserId(): string {
  const existing = getUserId();
  if (existing) return existing;

  let newId = "";
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    newId = `usr_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  } else {
    newId = `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  }

  setUserId(newId);
  return newId;
}
