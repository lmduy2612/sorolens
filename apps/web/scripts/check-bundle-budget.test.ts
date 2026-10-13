import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runBudgetCheck } from "./check-bundle-budget.mjs";

describe("Performance & Bundle Budget", () => {
  const budgetFilePath = path.resolve(__dirname, "../performance-budget.json");

  it("loads and validates performance-budget.json configuration", () => {
    expect(fs.existsSync(budgetFilePath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(budgetFilePath, "utf-8"));

    expect(config.limits).toBeDefined();
    expect(config.limits.maxTotalClientBundleMb).toBeGreaterThan(0);
    expect(config.limits.maxIndividualChunkKb).toBeGreaterThan(0);
    expect(config.limits.maxRouteFirstLoadJsKb).toBeGreaterThan(0);

    expect(Array.isArray(config.lighthouseBudgets)).toBe(true);
    expect(config.lighthouseBudgets.length).toBeGreaterThan(0);
  });

  it("passes budget check against production build artifacts", () => {
    const nextDir = path.resolve(__dirname, "../.next");
    if (!fs.existsSync(nextDir)) {
      // In fresh test runners without a prior build, verify function handles missing directory
      expect(() => runBudgetCheck()).toThrow();
      return;
    }

    const result = runBudgetCheck();
    expect(result.totalChunks).toBeGreaterThan(0);
    expect(result.totalMb).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("detects violations when limits are exceeded", () => {
    const nextDir = path.resolve(__dirname, "../.next");
    if (!fs.existsSync(nextDir)) return;

    // Artificially low threshold to ensure violation detection works
    const result = runBudgetCheck({
      maxSharedFirstLoadJsKb: 10,
      maxRouteFirstLoadJsKb: 10,
      maxTotalClientBundleMb: 0.01,
      maxIndividualChunkKb: 5,
    });

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
