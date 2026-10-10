import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUrlFilters } from "./useUrlFilters";

const nav = vi.hoisted(() => {
  let query = new URLSearchParams("");
  const replace = vi.fn((href: string) => {
    const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    query = new URLSearchParams(q);
  });
  const push = vi.fn((href: string) => {
    const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    query = new URLSearchParams(q);
  });
  const setQuery = (q: string | URLSearchParams) => {
    query = new URLSearchParams(q);
    if (typeof window !== "undefined") {
      const qStr = query.toString();
      window.history.replaceState(null, "", qStr ? `?${qStr}` : "/test");
    }
  };
  return {
    replace,
    push,
    getQuery: () => query,
    setQuery,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.getQuery(),
  usePathname: () => "/test",
}));

describe("useUrlFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.setQuery("");
  });

  interface TestFilters extends Record<string, unknown> {
    search: string;
    category: string;
    page: string;
  }

  const defaultValues: TestFilters = {
    search: "",
    category: "all",
    page: "1",
  };

  it("initializes with default values when searchParams is empty", () => {
    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues })
    );

    expect(result.current.filters).toEqual(defaultValues);
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("restores state from searchParams on mount", () => {
    nav.setQuery("?search=soroban&category=defi&page=3");

    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues })
    );

    expect(result.current.filters).toEqual({
      search: "soroban",
      category: "defi",
      page: "3",
    });
    expect(nav.push).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("updates state and pushes new query parameters", () => {
    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues })
    );

    act(() => {
      result.current.setFilters({
        search: "tokens",
        category: "defi",
        page: "2",
      });
    });

    expect(result.current.filters).toEqual({
      search: "tokens",
      category: "defi",
      page: "2",
    });
    expect(nav.push).toHaveBeenCalledWith(
      "?search=tokens&category=defi&page=2",
      { scroll: false }
    );
  });

  it("supports replace mode", () => {
    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues, mode: "replace" })
    );

    act(() => {
      result.current.updateFilters({ search: "wallet" });
    });

    expect(result.current.filters.search).toBe("wallet");
    expect(nav.replace).toHaveBeenCalledWith("?search=wallet", {
      scroll: false,
    });
  });

  it("omits default and empty values from the URL", () => {
    nav.setQuery("?search=tokens&category=defi");
    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues })
    );

    act(() => {
      result.current.updateFilters({ category: "all", search: "" });
    });

    expect(result.current.filters).toEqual({
      search: "",
      category: "all",
      page: "1",
    });
    expect(nav.push).toHaveBeenCalledWith("/test", { scroll: false });
  });

  it("clears all filters back to default values", () => {
    nav.setQuery("?search=tokens&category=defi&page=2");
    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues })
    );

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual(defaultValues);
    expect(nav.push).toHaveBeenCalledWith("/test", { scroll: false });
  });

  it("supports custom parse and serialize functions", () => {
    interface CustomFilters extends Record<string, unknown> {
      tag: string;
      limit: number;
    }

    const { result } = renderHook(() =>
      useUrlFilters<CustomFilters>({
        defaultValues: { tag: "", limit: 10 },
        parse: (sp) => ({
          tag: sp.get("t") ?? "",
          limit: sp.has("l") ? Number(sp.get("l")) : 10,
        }),
        serialize: (f) => ({
          t: f.tag || undefined,
          l: f.limit !== 10 ? String(f.limit) : undefined,
        }),
      })
    );

    act(() => {
      result.current.setFilters({ tag: "soroban", limit: 50 });
    });

    expect(nav.push).toHaveBeenCalledWith("?t=soroban&l=50", {
      scroll: false,
    });
  });

  it("reacts to browser back/forward navigation (popstate)", () => {
    nav.setQuery("?search=first");
    const { result } = renderHook(() =>
      useUrlFilters<TestFilters>({ defaultValues })
    );

    expect(result.current.filters.search).toBe("first");

    act(() => {
      nav.setQuery("?search=second");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.filters.search).toBe("second");
  });
});
