"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface UseUrlFiltersOptions<T extends Record<string, unknown>> {
  /** Default filter values when parameter is missing or empty. */
  defaultValues: T;
  /** Custom parser from URLSearchParams. Return partial or full filters. */
  parse?: (params: URLSearchParams) => Partial<T>;
  /** Custom serializer to URLSearchParams key-value object. */
  serialize?: (
    filters: T
  ) => Record<string, string | number | boolean | null | undefined>;
  /** Navigation mode: 'push' (adds browser history entry) or 'replace'. Defaults to 'push'. */
  mode?: "push" | "replace";
  /** Whether to preserve existing URL search parameters not handled by this hook. Defaults to true. */
  preserveOtherParams?: boolean;
}

export interface SetFiltersOptions {
  /** Override navigation mode for this update ('push' or 'replace'). */
  mode?: "push" | "replace";
}

export interface UseUrlFiltersReturn<T extends Record<string, unknown>> {
  filters: T;
  setFilters: (
    updater: T | ((prev: T) => T),
    options?: SetFiltersOptions
  ) => void;
  updateFilters: (
    partial: Partial<T> | ((prev: T) => Partial<T>),
    options?: SetFiltersOptions
  ) => void;
  resetFilters: (options?: SetFiltersOptions) => void;
  createUrl: (overrides?: Partial<T>) => string;
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Shared hook to synchronize filter and pagination state to URL search parameters.
 * Supports deep-linking on reload and browser back/forward navigation.
 */
export function useUrlFilters<T extends Record<string, unknown>>(
  options: UseUrlFiltersOptions<T>
): UseUrlFiltersReturn<T> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  let router: {
    push: (url: string, opts?: { scroll?: boolean }) => void;
    replace: (url: string, opts?: { scroll?: boolean }) => void;
  } | null = null;
  let searchParams: URLSearchParams | null = null;
  let pathname: string | null = null;

  try {
    router = useRouter();
  } catch {
    // Outside App Router context
  }

  try {
    searchParams = useSearchParams();
  } catch {
    // Outside App Router context
  }

  try {
    pathname = usePathname();
  } catch {
    // Outside App Router context
  }

  // Graceful fallback for test or non-Next environments
  if (!router && typeof window !== "undefined") {
    router = {
      push: (url: string) => {
        window.history.pushState({}, "", url);
      },
      replace: (url: string) => {
        window.history.replaceState({}, "", url);
      },
    };
  }

  if (!searchParams && typeof window !== "undefined") {
    searchParams = new URLSearchParams(window.location.search);
  }

  const parseParams = useCallback((params: URLSearchParams | null): T => {
    const opts = optionsRef.current;
    if (!params) return { ...opts.defaultValues };
    if (opts.parse) {
      return { ...opts.defaultValues, ...opts.parse(params) };
    }
    const result = { ...opts.defaultValues };
    for (const key of Object.keys(opts.defaultValues)) {
      const val = params.get(key);
      if (val !== null) {
        (result as Record<string, unknown>)[key] = val;
      }
    }
    return result;
  }, []);

  const [filters, setFiltersState] = useState<T>(() =>
    parseParams(searchParams)
  );

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const serializeParams = useCallback(
    (newFilters: T): URLSearchParams => {
      const opts = optionsRef.current;
      const raw = opts.serialize
        ? opts.serialize(newFilters)
        : (newFilters as Record<string, unknown>);

      const params = new URLSearchParams(
        opts.preserveOtherParams !== false && searchParams
          ? searchParams.toString()
          : ""
      );

      const managedKeys = new Set([
        ...Object.keys(opts.defaultValues),
        ...Object.keys(raw),
      ]);

      for (const key of managedKeys) {
        const val = raw[key];
        const defaultVal = opts.defaultValues[key];

        if (
          val === undefined ||
          val === null ||
          val === "" ||
          val === defaultVal
        ) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      }

      return params;
    },
    [searchParams]
  );

  const prevSearchParamsStr = useRef(searchParams?.toString() ?? "");

  const syncUrl = useCallback(
    (newFilters: T, navMode?: "push" | "replace") => {
      if (!router) return;
      const targetMode = navMode ?? optionsRef.current.mode ?? "push";
      const params = serializeParams(newFilters);
      const qs = params.toString();
      const url = qs ? `?${qs}` : (pathname ?? "");

      const currentQs = searchParams?.toString() ?? "";
      if (qs === currentQs) return;

      prevSearchParamsStr.current = qs;
      if (targetMode === "replace") {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [router, serializeParams, pathname, searchParams]
  );

  // React to URL changes (e.g. Next.js router navigation or Back/Forward)
  useEffect(() => {
    const currentStr = searchParams?.toString() ?? "";
    if (currentStr !== prevSearchParamsStr.current) {
      prevSearchParamsStr.current = currentStr;
      const fromUrl = parseParams(searchParams);
      if (!shallowEqual(filtersRef.current, fromUrl)) {
        filtersRef.current = fromUrl;
        setFiltersState(fromUrl);
      }
    }
  }, [searchParams, parseParams]);

  // Handle window popstate for browser back/forward in tests and edge environments
  useEffect(() => {
    const onPopState = () => {
      const sp =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : searchParams;
      if (!sp) return;
      const currentStr = sp.toString();
      prevSearchParamsStr.current = currentStr;
      const fromUrl = parseParams(sp);
      if (!shallowEqual(filtersRef.current, fromUrl)) {
        filtersRef.current = fromUrl;
        setFiltersState(fromUrl);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [searchParams, parseParams]);

  const setFilters = useCallback(
    (updater: T | ((prev: T) => T), opts?: SetFiltersOptions) => {
      const next =
        typeof updater === "function" ? updater(filtersRef.current) : updater;
      if (shallowEqual(filtersRef.current, next)) return;
      filtersRef.current = next;
      setFiltersState(next);
      syncUrl(next, opts?.mode);
    },
    [syncUrl]
  );

  const updateFilters = useCallback(
    (
      partial: Partial<T> | ((prev: T) => Partial<T>),
      opts?: SetFiltersOptions
    ) => {
      setFilters((prev) => {
        const p = typeof partial === "function" ? partial(prev) : partial;
        return { ...prev, ...p };
      }, opts);
    },
    [setFilters]
  );

  const resetFilters = useCallback(
    (opts?: SetFiltersOptions) => {
      setFilters(optionsRef.current.defaultValues, opts);
    },
    [setFilters]
  );

  const createUrl = useCallback(
    (overrides?: Partial<T>): string => {
      const targetFilters = overrides
        ? { ...filtersRef.current, ...overrides }
        : filtersRef.current;
      const params = serializeParams(targetFilters);
      const qs = params.toString();
      return qs ? `?${qs}` : (pathname ?? "");
    },
    [serializeParams, pathname]
  );

  return {
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    createUrl,
  };
}
