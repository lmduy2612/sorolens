/**
 * Browser-side user identity.
 *
 * RBAC: registering a contract and mutating the watchlist require a user that
 * has been granted at least the contributor role in the API's users table.
 * Until a real auth flow exists, the dashboard identifies itself with a
 * localStorage value forwarded to the API as `X-User-ID`. It must map to a
 * user with at least the contributor role.
 */

import { useEffect, useState } from "react";

/** localStorage key holding the browser identity. */
export const USER_STORAGE_KEY = "sorolens_user_id";

/**
 * Reads the current user id, or `""` when there is none.
 *
 * When `create` is true, generates and stores a new user id if none exists.
 * localStorage can be unavailable (private mode, some test runners), in which
 * case this returns an empty string. Callers tolerate that because anonymous
 * reads remain open; only writes need the identity.
 */
export function getUserId(create = false): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(USER_STORAGE_KEY) || "";
    if (!id && create) {
      id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(USER_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Ensures a user ID exists in localStorage, creating and storing one if needed.
 */
export function ensureUserId(): string {
  return getUserId(true);
}

/**
 * Shared React hook to retrieve the persistent browser user ID.
 * If `create` is true, generates an ID when none exists.
 */
export function useUserId(create = false): string {
  const [userId, setUserId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return getUserId(create);
    }
    return "";
  });

  useEffect(() => {
    const id = getUserId(create);
    if (id && id !== userId) {
      setUserId(id);
    }
  }, [create, userId]);

  return userId;
}
