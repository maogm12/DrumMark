import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const watchDirs = [
  resolve(repoRoot, "crates/drummark-core/src"),
  resolve(repoRoot, "crates/drummark-layout/src"),
];

let running = false;
let pending = false;
const debounceMs = 300;

function rebuild() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  pending = false;
  console.log("\n[wasm:watch] Rebuilding WASM...");
  const child = spawn("node", [resolve(repoRoot, "scripts/build_wasm.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  child.on("close", (code) => {
    running = false;
    if (code !== 0) {
      console.log(`[wasm:watch] Build failed (exit ${code})`);
    } else {
      console.log("[wasm:watch] Build OK");
    }
    if (pending) {
      setTimeout(rebuild, debounceMs);
    }
  });
}

for (const dir of watchDirs) {
  watch(dir, { recursive: true }, (_event, _filename) => {
    setTimeout(rebuild, debounceMs);
  });
}

console.log("[wasm:watch] Watching for Rust changes...");
rebuild();
