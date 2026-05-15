import init, { initSync, parse as wasmParse } from "./pkg/drummark_core";

let ready = false;
let initPromise: Promise<void> | null = null;

function isNode(): boolean {
  return typeof process !== "undefined" && process.versions?.node != null;
}

async function initForBrowser(): Promise<void> {
  const wasmUrl = new URL("./pkg/drummark_core_bg.wasm", import.meta.url);
  await init({ module_or_path: wasmUrl });
}

async function initForNode(): Promise<void> {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const wasmPath = join(currentDir, "pkg", "drummark_core_bg.wasm");
  const bytes = readFileSync(wasmPath);
  initSync({ module: bytes });
}

export async function initWasm(): Promise<void> {
  if (ready) return;
  if (!initPromise) {
    initPromise = (isNode() ? initForNode() : initForBrowser())
      .then(() => { ready = true; })
      .catch((e) => {
        initPromise = null;
        throw e;
      });
  }
  return initPromise;
}

export function isWasmReady(): boolean {
  return ready;
}

export function parse(source: string): unknown {
  if (!ready) {
    throw new Error(
      "WASM parser not initialized. Call initWasm() before parsing.",
    );
  }
  return wasmParse(source);
}
