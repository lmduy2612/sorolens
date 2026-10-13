import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { viewport } from "@/app/layout";

function parseHex(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "").trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(color1: string, color2: string): number {
  const [r1, g1, b1] = parseHex(color1);
  const [r2, g2, b2] = parseHex(color2);
  const lum1 = luminance(r1, g1, b1);
  const lum2 = luminance(r2, g2, b2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe("Design tokens and contrast audit (#609)", () => {
  const cssPath = path.resolve(__dirname, "../app/globals.css");
  const cssContent = readFileSync(cssPath, "utf-8");

  it("defines all required semantic tokens in globals.css", () => {
    const requiredTokens = [
      "--color-warning",
      "--color-danger",
      "--color-safe",
      "--color-bg",
      "--color-bg-card",
      "--color-bg-page",
      "--color-bg-hover",
      "--color-surface",
      "--color-border",
      "--color-border-hover",
      "--color-text-primary",
      "--color-text-secondary",
      "--color-accent",
      "--color-accent-fg",
    ];

    for (const token of requiredTokens) {
      expect(cssContent).toContain(token);
    }
  });

  it("defines tokens for both light and dark theme selectors", () => {
    expect(cssContent).toMatch(/:root\[data-theme="light"\],\s*:root\s*\{/);
    expect(cssContent).toMatch(/:root\[data-theme="dark"\]\s*\{/);
  });

  describe("WCAG AA contrast audit in light theme", () => {
    const lightTokens = {
      bgPage: "#f8fafc",
      bgCard: "#ffffff",
      textPrimary: "#0f172a",
      textSecondary: "#475569",
      accent: "#2563eb",
      accentFg: "#ffffff",
      danger: "#e11d48",
      safe: "#15803d",
      warning: "#b45309",
    };

    it("primary text meets WCAG AAA (>= 7.0:1) on page and card backgrounds", () => {
      expect(contrastRatio(lightTokens.textPrimary, lightTokens.bgPage)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(lightTokens.textPrimary, lightTokens.bgCard)).toBeGreaterThanOrEqual(7.0);
    });

    it("secondary text meets WCAG AA (>= 4.5:1) on page and card backgrounds", () => {
      expect(contrastRatio(lightTokens.textSecondary, lightTokens.bgPage)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightTokens.textSecondary, lightTokens.bgCard)).toBeGreaterThanOrEqual(4.5);
    });

    it("accent button text meets WCAG AA (>= 4.5:1)", () => {
      expect(contrastRatio(lightTokens.accentFg, lightTokens.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it("status colors meet WCAG AA (>= 4.5:1) on card background", () => {
      expect(contrastRatio(lightTokens.danger, lightTokens.bgCard)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightTokens.safe, lightTokens.bgCard)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightTokens.warning, lightTokens.bgCard)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("WCAG AA contrast audit in dark theme", () => {
    const darkTokens = {
      bgPage: "#11111b",
      bgCard: "#1e1e2e",
      textPrimary: "#cdd6f4",
      textSecondary: "#a6adc8",
      accent: "#89b4fa",
      accentFg: "#11111b",
      danger: "#ef4444",
      safe: "#22c55e",
      warning: "#f59e0b",
    };

    it("primary text meets WCAG AAA (>= 7.0:1) on page and card backgrounds", () => {
      expect(contrastRatio(darkTokens.textPrimary, darkTokens.bgPage)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(darkTokens.textPrimary, darkTokens.bgCard)).toBeGreaterThanOrEqual(7.0);
    });

    it("secondary text meets WCAG AA (>= 4.5:1) on page and card backgrounds", () => {
      expect(contrastRatio(darkTokens.textSecondary, darkTokens.bgPage)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkTokens.textSecondary, darkTokens.bgCard)).toBeGreaterThanOrEqual(4.5);
    });

    it("accent button text meets WCAG AAA (>= 7.0:1)", () => {
      expect(contrastRatio(darkTokens.accentFg, darkTokens.accent)).toBeGreaterThanOrEqual(7.0);
    });

    it("status colors meet WCAG AA (>= 4.5:1) on page background", () => {
      expect(contrastRatio(darkTokens.danger, darkTokens.bgPage)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkTokens.safe, darkTokens.bgPage)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(darkTokens.warning, darkTokens.bgPage)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("viewport.themeColor", () => {
    it("declares themeColor for both light and dark preferences", () => {
      expect(Array.isArray(viewport.themeColor)).toBe(true);
      const themeColors = viewport.themeColor as Array<{ media: string; color: string }>;
      
      const lightEntry = themeColors.find((c) => c.media.includes("light"));
      const darkEntry = themeColors.find((c) => c.media.includes("dark"));

      expect(lightEntry).toBeDefined();
      expect(lightEntry?.color).toBe("#f8fafc");

      expect(darkEntry).toBeDefined();
      expect(darkEntry?.color).toBe("#11111b");
    });
  });
});
