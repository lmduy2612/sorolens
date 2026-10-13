#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..");
const budgetFile = path.resolve(webDir, "performance-budget.json");
const nextDir = path.resolve(webDir, ".next");

/**
 * @param {Record<string, number> | null} [customLimits]
 */
export function runBudgetCheck(customLimits = null) {
  if (!fs.existsSync(budgetFile)) {
    throw new Error(`Budget config not found at: ${budgetFile}`);
  }
  const budgetConfig = JSON.parse(fs.readFileSync(budgetFile, "utf-8"));
  const limits = customLimits || budgetConfig.limits;

  if (!fs.existsSync(nextDir)) {
    throw new Error(
      `Next build directory (.next) not found at ${nextDir}. Run "pnpm build" first.`
    );
  }

  const staticChunksDir = path.resolve(nextDir, "static/chunks");
  if (!fs.existsSync(staticChunksDir)) {
    throw new Error(`Static chunks directory not found at ${staticChunksDir}.`);
  }

  const chunks = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const content = fs.readFileSync(fullPath);
        const gzipped = zlib.gzipSync(content);
        chunks.push({
          name: path.relative(staticChunksDir, fullPath),
          rawBytes: content.length,
          gzipBytes: gzipped.length,
          gzipKb: +(gzipped.length / 1024).toFixed(2),
        });
      }
    }
  }
  walkDir(staticChunksDir);

  const totalRawBytes = chunks.reduce((acc, c) => acc + c.rawBytes, 0);
  const totalGzipBytes = chunks.reduce((acc, c) => acc + c.gzipBytes, 0);
  const totalMb = +(totalGzipBytes / (1024 * 1024)).toFixed(2);
  const rawTotalMb = +(totalRawBytes / (1024 * 1024)).toFixed(2);

  const violations = [];

  // Check total client bundle limit (gzip)
  if (totalMb > limits.maxTotalClientBundleMb) {
    violations.push({
      rule: "maxTotalClientBundleMb",
      limit: `${limits.maxTotalClientBundleMb} MB`,
      actual: `${totalMb} MB`,
    });
  }

  // Check max individual chunk limit (gzip transfer size)
  const oversizedChunks = chunks.filter(
    (c) => c.gzipKb > limits.maxIndividualChunkKb
  );
  if (oversizedChunks.length > 0) {
    for (const c of oversizedChunks) {
      violations.push({
        rule: `maxIndividualChunkKb (${c.name})`,
        limit: `${limits.maxIndividualChunkKb} kB`,
        actual: `${c.gzipKb} kB`,
      });
    }
  }

  // Inspect app build manifest if available
  const appManifestFile = path.resolve(nextDir, "app-build-manifest.json");
  const routeStats = [];
  if (fs.existsSync(appManifestFile)) {
    const appManifest = JSON.parse(fs.readFileSync(appManifestFile, "utf-8"));
    const pages = appManifest.pages || {};
    for (const [route, files] of Object.entries(pages)) {
      let routeGzipBytes = 0;
      for (const file of files) {
        const filePath = path.resolve(nextDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          routeGzipBytes += zlib.gzipSync(content).length;
        }
      }
      const routeKb = +(routeGzipBytes / 1024).toFixed(2);
      routeStats.push({ route, sizeKb: routeKb });
      if (routeKb > limits.maxRouteFirstLoadJsKb) {
        violations.push({
          rule: `maxRouteFirstLoadJsKb (${route})`,
          limit: `${limits.maxRouteFirstLoadJsKb} kB`,
          actual: `${routeKb} kB`,
        });
      }
    }
  }

  return {
    totalChunks: chunks.length,
    totalMb,
    routeStats,
    violations,
    passed: violations.length === 0,
  };
}

if (process.argv[1] === __filename) {
  console.log("🔍 Checking performance and bundle size budgets...");
  try {
    const result = runBudgetCheck();
    console.log(
      `\n📦 Total client bundle size: ${result.totalMb} MB across ${result.totalChunks} chunks`
    );

    if (result.routeStats.length > 0) {
      console.log("\n📄 Route bundle sizes:");
      for (const r of result.routeStats) {
        console.log(
          `  - ${r.route.padEnd(30)} ${r.sizeKb.toString().padStart(8)} kB`
        );
      }
    }

    if (!result.passed) {
      console.error("\n❌ Performance budget violations detected:");
      for (const v of result.violations) {
        console.error(
          `  - [${v.rule}]: actual ${v.actual} exceeds limit ${v.limit}`
        );
      }
      process.exit(1);
    }

    console.log(
      "\n✅ All bundle size and performance budgets passed successfully!"
    );
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error running budget check: ${err.message}`);
    process.exit(1);
  }
}
