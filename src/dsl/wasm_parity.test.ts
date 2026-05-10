import { describe, it, expect, beforeAll } from "vitest";
import { initWasm, parse as wasmRawParse } from "../wasm/drummark_wasm";
import { parseDocumentSkeletonFromWasmSync } from "../wasm/skeleton";

beforeAll(async () => {
  await initWasm();
});

describe("WASM parser sanity", () => {
  it("two headers", () => {
    const raw = wasmRawParse("time 4/4\nnote 1/8\nHH | x |\n") as any;
    console.log("Two-header raw:", JSON.stringify(raw));
    const line = raw?.paragraphs?.[0]?.lines?.[0];
    expect(line?.track).toBe("HH");
  });

  it("grouping header", () => {
    const raw = wasmRawParse("time 4/4\ngrouping 2+2\nHH | x |\n") as any;
    console.log("Grouping-header raw:", JSON.stringify(raw));
    const line = raw?.paragraphs?.[0]?.lines?.[0];
    expect(line?.track).toBe("HH");
  });
});

beforeAll(async () => {
  await initWasm();
});

// ── Test inputs ──────────────────────────────────────────────────

const FIXTURES: Record<string, string> = {
  headers: `title My Score
subtitle Verse
composer G. Mao
tempo 120
time 4/4
grouping 2+2
note 1/8
divisions 16
`,
  simple: `time 4/4
note 1/8
grouping 2+2
HH | x - x - |
`,
  trackAnonymous: `time 4/4
note 1/8
grouping 2+2
| x - x - |
| --d- |
`,
  combinedHit: `time 4/4
note 1/8
grouping 2+2
SD | x+d+b |
`,
  group: `time 4/4
note 1/8
grouping 2+2
SD | [x d b] |
`,
  suffixChain: `time 4/4
note 1/8
grouping 2+2
SD | x. / * :accent |
`,
  navigation: `time 4/4
note 1/8
grouping 2+2
HH | @segno x |
HH | @dc |
`,
  measureRepeat: `time 4/4
note 1/8
grouping 2+2
HH | x | % |
`,
  multiRest: `time 4/4
note 1/8
grouping 2+2
HH | x | --2-- |
`,
  hairpins: `time 4/4
note 1/8
grouping 2+2
HH | x < d > ! |
`,
};

// ── Helpers ──────────────────────────────────────────────────────

function normalizeForCompare(skeleton: DocumentSkeleton) {
  return JSON.parse(
    JSON.stringify(skeleton, (_, v) => (v === undefined ? null : v)),
  );
}

// ── Tests ────────────────────────────────────────────────────────

function stripLines(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripLines);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "line" || k === "lineNumber" || k === "startLine" ||
        k === "startOffset" || k === "raw" || k === "content" ||
        k === "source" || k === "globalIndex") {
      continue;
    }
    result[k] = stripLines(v);
  }
  return result;
}

describe("WASM vs Lezer parser parity", () => {
  for (const [name, source] of Object.entries(FIXTURES)) {
    it(`parity: ${name}`, () => {
      const wasm = parseDocumentSkeletonFromWasmSync(source);
      const lezer = parseDocumentSkeletonFromLezer(source);

      const w = stripLines(normalizeForCompare(wasm));
      const l = stripLines(normalizeForCompare(lezer));

      try {
        expect(w).toEqual(l);
      } catch (e) {
        // Print details for debugging
        console.error(`Parity failure "${name}":`);
        console.error("  WASM:", JSON.stringify(w));
        console.error("  Lezer:", JSON.stringify(l));
        throw e;
      }
    });
  }
});
