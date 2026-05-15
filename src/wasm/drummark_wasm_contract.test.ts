import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WRAPPER_PATH = join(process.cwd(), "src", "wasm", "drummark_wasm.ts");

describe("drummark_wasm wrapper contract", () => {
  it("passes an explicit wasm module URL to browser init", () => {
    const source = readFileSync(WRAPPER_PATH, "utf8");

    expect(source).toContain('new URL("./pkg/drummark_core_bg.wasm", import.meta.url)');
    expect(source).toContain("await init({ module_or_path: wasmUrl });");
  });

  it("passes the non-deprecated object form to node initSync", () => {
    const source = readFileSync(WRAPPER_PATH, "utf8");

    expect(source).toContain("initSync({ module: bytes });");
  });
});
