/**
 * Offline smoke / validation for routerai-image.
 * Imports compiled modules from dist/ (run `npm run build` first or via this script).
 *
 * Live RouterAI call runs only when ROUTERAI_API_KEY is already set in the
 * process environment before this script starts; otherwise it is skipped.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

/** Snapshot of whether a live key was present at process start (before we unset it). */
const hadLiveApiKey = Boolean(process.env.ROUTERAI_API_KEY?.trim());
const liveApiKey = hadLiveApiKey ? process.env.ROUTERAI_API_KEY : undefined;

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function failFast(name, detail) {
  record(name, false, detail);
  printSummaryAndExit(1);
}

async function main() {
  // 4. npm run build (clean compile)
  console.log("\n== build ==");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: pkgRoot,
    encoding: "utf8",
    shell: true,
  });
  if (build.status !== 0) {
    failFast(
      "npm run build",
      (build.stderr || build.stdout || `exit ${build.status}`).trim().slice(0, 400),
    );
  }
  record("npm run build", true);

  const distPaths = pathToFileURL(path.join(pkgRoot, "dist", "paths.js")).href;
  const distGenerate = pathToFileURL(
    path.join(pkgRoot, "dist", "generate.js"),
  ).href;
  const { resolveSafePath, assertCanWrite } = await import(distPaths);
  const { generateImage } = await import(distGenerate);

  const workspace = mkdtempSync(path.join(tmpdir(), "routerai-smoke-"));

  try {
    // 1. path rejection for `..` escape → message starts with validation:
    console.log("\n== path escape ==");
    try {
      resolveSafePath("../escape.png", workspace);
      failFast(
        "path rejection (.. escape)",
        "expected throw, but resolveSafePath succeeded",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const ok = msg.startsWith("validation:");
      record(
        "path rejection (.. escape)",
        ok,
        ok ? msg : `expected validation: prefix, got: ${msg}`,
      );
      if (!ok) printSummaryAndExit(1);
    }

    // 2. overwrite=false when file exists → fs:exists
    console.log("\n== overwrite guard ==");
    const existing = path.join(workspace, "already-there.png");
    writeFileSync(existing, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    try {
      await assertCanWrite(existing, false);
      failFast(
        "overwrite=false when file exists",
        "expected throw, but assertCanWrite succeeded",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const ok = msg === "fs:exists" || msg.startsWith("fs:exists");
      record(
        "overwrite=false when file exists",
        ok,
        ok ? msg : `expected fs:exists, got: ${msg}`,
      );
      if (!ok) printSummaryAndExit(1);
    }

    // 3. missing API key → auth: (unset env; isolate workspace so .env is not loaded)
    console.log("\n== missing API key ==");
    const savedKey = process.env.ROUTERAI_API_KEY;
    const savedRoot = process.env.ROUTERAI_WORKSPACE_ROOT;
    delete process.env.ROUTERAI_API_KEY;
    process.env.ROUTERAI_WORKSPACE_ROOT = workspace; // no .env here
    try {
      await generateImage({ prompt: "smoke test — should not call provider" });
      failFast(
        "missing API key → auth:",
        "expected throw, but generateImage succeeded",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const ok = msg.startsWith("auth:");
      record(
        "missing API key → auth:",
        ok,
        ok ? msg : `expected auth: prefix, got: ${msg}`,
      );
      if (!ok) printSummaryAndExit(1);
    } finally {
      if (savedKey !== undefined) process.env.ROUTERAI_API_KEY = savedKey;
      else delete process.env.ROUTERAI_API_KEY;
      if (savedRoot !== undefined) process.env.ROUTERAI_WORKSPACE_ROOT = savedRoot;
      else delete process.env.ROUTERAI_WORKSPACE_ROOT;
    }

    // Optional live call — only if key was set at process start
    console.log("\n== live RouterAI (optional) ==");
    if (!hadLiveApiKey) {
      record(
        "live RouterAI generateImage",
        true,
        "SKIPPED (ROUTERAI_API_KEY not set in environment)",
      );
    } else {
      process.env.ROUTERAI_API_KEY = liveApiKey;
      try {
        const result = await generateImage({
          prompt: "tiny solid blue square, minimal smoke test",
          output_format: "png",
          size: "256x256",
        });
        const ok =
          Buffer.isBuffer(result.bytes) &&
          result.bytes.length > 0 &&
          typeof result.mimeType === "string";
        record(
          "live RouterAI generateImage",
          ok,
          ok
            ? `bytes=${result.bytes.length} mime=${result.mimeType} model=${result.model}`
            : "empty or invalid result",
        );
        if (!ok) printSummaryAndExit(1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failFast("live RouterAI generateImage", msg);
      }
    }
  } finally {
    try {
      rmSync(workspace, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  }

  printSummaryAndExit(results.every((r) => r.ok) ? 0 : 1);
}

function printSummaryAndExit(code) {
  console.log("\n== summary ==");
  for (const r of results) {
    console.log(
      `  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`,
    );
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed === 0
      ? `\nAll ${results.length} checks passed.`
      : `\n${failed} of ${results.length} checks failed.`,
  );
  process.exit(code);
}

main().catch((err) => {
  console.error("smoke-validate fatal:", err);
  process.exit(1);
});
