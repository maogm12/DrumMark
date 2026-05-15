import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const coreManifest = resolve(repoRoot, "crates/drummark-core/Cargo.toml");
const wasmOutputDir = resolve(repoRoot, "src/wasm/pkg");
const wasmArtifact = resolve(
  repoRoot,
  "target/wasm32-unknown-unknown/release/drummark_core.wasm",
);

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function resolveCargo() {
  const configured = process.env.CARGO;
  if (configured) {
    return configured;
  }

  const rustupCargo = capture("rustup", ["which", "cargo"]);
  if (rustupCargo && existsSync(rustupCargo)) {
    return rustupCargo;
  }

  return "cargo";
}

function resolveRustc(cargoPath) {
  const configured = process.env.RUSTC;
  if (configured) {
    return configured;
  }

  if (cargoPath.endsWith("/cargo")) {
    const siblingRustc = cargoPath.slice(0, -"/cargo".length) + "/rustc";
    if (existsSync(siblingRustc)) {
      return siblingRustc;
    }
  }

  const rustupRustc = capture("rustup", ["which", "rustc"]);
  if (rustupRustc && existsSync(rustupRustc)) {
    return rustupRustc;
  }

  return "rustc";
}

function resolveWasmBindgen() {
  const configured = process.env.WASM_BINDGEN;
  if (configured) {
    return configured;
  }

  const cargoHome = process.env.CARGO_HOME || (process.env.HOME ? resolve(process.env.HOME, ".cargo") : null);
  if (cargoHome) {
    const candidate = resolve(cargoHome, "bin/wasm-bindgen");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "wasm-bindgen";
}

const cargoPath = resolveCargo();
const rustcPath = resolveRustc(cargoPath);

run(cargoPath, [
  "build",
  "--manifest-path",
  coreManifest,
  "--target",
  "wasm32-unknown-unknown",
  "--release",
], {
  RUSTC: rustcPath,
});

run(resolveWasmBindgen(), [
  "--target",
  "web",
  "--out-dir",
  wasmOutputDir,
  "--omit-default-module-path",
  wasmArtifact,
]);
