import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import playwrightConfig from "../../playwright.config";

describe("Playwright Mobile & Accessibility Configuration", () => {
  it("configures Desktop and Mobile projects in playwright.config.ts", () => {
    const projects = playwrightConfig.projects || [];
    const projectNames = projects.map((p) => p.name);

    expect(projectNames).toContain("chromium");
    expect(projectNames).toContain("mobile-chrome");
    expect(projectNames).toContain("mobile-safari");

    const mobileChrome = projects.find((p) => p.name === "mobile-chrome");
    expect(mobileChrome?.use?.viewport).toBeDefined();
    expect(mobileChrome?.use?.isMobile).toBe(true);

    const mobileSafari = projects.find((p) => p.name === "mobile-safari");
    expect(mobileSafari?.use?.viewport).toBeDefined();
    expect(mobileSafari?.use?.isMobile).toBe(true);
  });

  it("ensures e2e workflow installs browsers with webkit support in CI", () => {
    const workflowPath = path.resolve(
      __dirname,
      "../../../../.github/workflows/e2e.yml"
    );
    expect(fs.existsSync(workflowPath)).toBe(true);

    const workflow = fs.readFileSync(workflowPath, "utf-8");
    expect(workflow).toContain("playwright install");
    expect(workflow).toContain("chromium");
    expect(workflow).toContain("webkit");
  });

  it("verifies accessibility spec exists and checks core routes", () => {
    const a11ySpecPath = path.resolve(
      __dirname,
      "../e2e/accessibility.spec.ts"
    );
    expect(fs.existsSync(a11ySpecPath)).toBe(true);

    const content = fs.readFileSync(a11ySpecPath, "utf-8");
    expect(content).toContain("checkA11y");
    expect(content).toContain("/contracts");
    expect(content).toContain("/live");
    expect(content).toContain("/settings");
    expect(content).toContain("/watchdog");
    expect(content).toContain("/integrations");
  });
});
