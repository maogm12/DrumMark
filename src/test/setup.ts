import { beforeAll } from "vitest";
import { initWasm } from "../wasm/drummark_wasm";

beforeAll(async () => {
  await initWasm();
});
