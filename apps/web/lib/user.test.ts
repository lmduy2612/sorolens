import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { USER_STORAGE_KEY, getUserId, ensureUserId, useUserId } from "./user";

describe("user identity module", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("getUserId", () => {
    it("returns empty string by default if no user id exists in localStorage", () => {
      expect(getUserId()).toBe("");
      expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    });

    it("returns the stored user id if present", () => {
      window.localStorage.setItem(USER_STORAGE_KEY, "test-user-123");
      expect(getUserId()).toBe("test-user-123");
    });

    it("generates and persists a user id if create is true and none exists", () => {
      const id = getUserId(true);
      expect(id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe(id);
    });

    it("does not overwrite an existing user id when create is true", () => {
      window.localStorage.setItem(USER_STORAGE_KEY, "pre-existing-id");
      expect(getUserId(true)).toBe("pre-existing-id");
      expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe(
        "pre-existing-id"
      );
    });
  });

  describe("ensureUserId", () => {
    it("creates and returns a user id", () => {
      const id = ensureUserId();
      expect(id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe(id);
    });
  });

  describe("useUserId", () => {
    it("returns empty string by default when localStorage is empty", () => {
      const { result } = renderHook(() => useUserId());
      expect(result.current).toBe("");
    });

    it("returns existing user id when localStorage has one", () => {
      window.localStorage.setItem(USER_STORAGE_KEY, "stored-user-456");
      const { result } = renderHook(() => useUserId());
      expect(result.current).toBe("stored-user-456");
    });

    it("generates and stores user id when create=true", () => {
      const { result } = renderHook(() => useUserId(true));
      expect(result.current).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(window.localStorage.getItem(USER_STORAGE_KEY)).toBe(
        result.current
      );
    });
  });
});
