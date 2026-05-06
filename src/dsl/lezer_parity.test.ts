import { describe, it, expect } from "vitest";
import { parseDocumentSkeleton } from "./parser";
import { parseDocumentSkeletonFromLezer } from "./lezer_skeleton";
import { buildScoreAst } from "./ast";
import type { DocumentSkeleton } from "./types";

// Comparison helper: strip fields that legitimately differ between parsers
// (line numbers, raw source offsets, etc.)
function normalize(skeleton: DocumentSkeleton) {
  return JSON.parse(
    JSON.stringify(skeleton, (key, value) => {
      if (
        key === "line" ||
        key === "lineNumber" ||
        key === "startLine" ||
        key === "source" ||
        key === "raw" ||
        key === "startOffset"
      ) {
        return undefined;
      }
      return value;
    }),
  );
}

function compareHeaders(regex: DocumentSkeleton, lezer: DocumentSkeleton) {
  expect(lezer.headers.title?.value).toBe(regex.headers.title?.value);
  expect(lezer.headers.subtitle?.value).toBe(regex.headers.subtitle?.value);
  expect(lezer.headers.composer?.value).toBe(regex.headers.composer?.value);
  expect(lezer.headers.tempo.value).toBe(regex.headers.tempo.value);
  expect(lezer.headers.time.beats).toBe(regex.headers.time.beats);
  expect(lezer.headers.time.beatUnit).toBe(regex.headers.time.beatUnit);
  if (regex.headers.grouping) {
    expect(lezer.headers.grouping?.values).toEqual(regex.headers.grouping.values);
  }
  if (regex.headers.note) {
    expect(lezer.headers.note?.value).toBe(regex.headers.note.value);
  }
}

function compareParagraphs(regex: DocumentSkeleton, lezer: DocumentSkeleton) {
  expect(lezer.paragraphs.length).toBe(regex.paragraphs.length);
  for (let pi = 0; pi < regex.paragraphs.length; pi++) {
    const rp = regex.paragraphs[pi];
    const lp = lezer.paragraphs[pi];
    expect(lp.lines.length, `paragraph ${pi} line count`).toBe(rp.lines.length);
    for (let li = 0; li < rp.lines.length; li++) {
      const rl = rp.lines[li];
      const ll = lp.lines[li];
      expect(ll.track, `para ${pi} line ${li} track`).toBe(rl.track);
      expect(ll.measures.length, `para ${pi} line ${li} measure count`).toBe(
        rl.measures.length,
      );
      for (let mi = 0; mi < rl.measures.length; mi++) {
        const rm = rl.measures[mi];
        const lm = ll.measures[mi];
        expect(lm.tokens.length, `para ${pi} line ${li} measure ${mi} token count`).toBe(
          rm.tokens.length,
        );
        for (let ti = 0; ti < rm.tokens.length; ti++) {
          const rt = rm.tokens[ti];
          const lt = lm.tokens[ti];
          // Normalize token comparison — strip trackOverride undefined for clean diff
          const rn = stripUndefined(rt);
          const ln = stripUndefined(lt);
          expect(ln, `para ${pi} line ${li} measure ${mi} token ${ti}`).toEqual(rn);
        }
      }
    }
  }
}

function stripUndefined(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================
// Test inputs covering all feature categories
// ============================================================

const BASIC = `title "Test"
time 4/4
note 1/16

HH | x - x - |
SD | d - d - |
BD | b - b - |`;

const TEMPO_TIME = `title "Tempo Test"
tempo 96
time 3/4
note 1/8

HH | x - x - |`;

const GROUPING = `title "Grouping Test"
time 4/4
note 1/16
grouping 2+2

HH | x - x - |
SD | d - d - |`;

const ALL_TRACKS = `title "All Tracks"
time 4/4
note 1/16
grouping 4

HH | d - - - |
HF | d - - - |
SD | d - - - |
BD | d - - - |
T1 | d - - - |
T2 | d - - - |
T3 | d - - - |
T4 | d - - - |
RC | d - - - |
RC2 | d - - - |
C | d - - - |
C2 | d - - - |
SPL | d - - - |
CHN | d - - - |
CB | d - - - |
WB | d - - - |
CL | d - - - |
ST | R - - - |
BD2 | d - - - |`;

const ALL_TOKENS = `title "All Tokens"
time 4/4
note 1/16

HH | d D x X s S b B b2 B2 r R r2 R2 |
HH | c C c2 C2 t1 t2 t3 t4 o O spl SPL |
HH | chn CHN cb CB wb WB cl CL p P g G - |
ST | R L |`;

const MODIFIERS = `title "Modifiers"
time 4/4
note 1/16
grouping 1+1+1+1

| HH:d:accent SD:d:rim:ghost RC:d:bell:accent HH:d:flam |`;

const CHAINED_MODIFIERS = `title "Chained Modifiers"
time 4/4
note 1/16

| HH:d:open:accent SD:d:rim:ghost b+SD:d:cross:accent+HH:d:close |`;

const COMBINED_HITS = `title "Combined Hits"
time 4/4
note 1/16

| x+s HH:d+SD:d:rim |
| b+SD:d:cross:accent+RC:d:bell:drag |
| x+s+b |`;

const DURATIONS = `title "Durations"
time 4/4
note 1/16
grouping 4

HH | x... x//// x../ x./// x* x x |`;

const REPEAT_BARLINES = `title "Repeats"
time 4/4
note 1/16

|: x x x x :| x x x x |
| x || s |`;

const VOLTAS = `title "Voltas"
time 4/4
note 1/16

HH |: x - - - |1. x - - o :|2. x x/x/ x |
| x/x/ x x x/x/ | 3. o o o o |`;

const GROUPS = `title "Groups"
time 4/4
note 1/16

HH | [ d x ] [3: d p g] |
SD | [xxxx] xxx |`;

const GROUPS_WITH_TRACKS = `time 4/4
note 1/16

HH | [ SD:d HH:x ] |
| [ BD:b RC:r ] |`;

const GROUP_SPANS = `title "Group Spans"
time 4/4
note 1/8
grouping 4

HH | [3: d d] - |
HH | [2: d d d d] - - |
HH | [2: d d d] - - |`;

const MEASURE_REPEAT = `title "Measure Repeat"
time 4/4
note 1/16

HH | x x x x | % | %% | x x x x |`;

const MEASURE_REPEAT_MIXED = `title "Mixed Repeat"
time 4/4
note 1/16

HH | x % x x |`;

const NAVIGATION = `title "Navigation"
time 4/4
note 1/16

HH | @segno x - - - | x x @to-coda x | @coda x - - - | x x @fine |`;

const NAV_SEGNO_ANCHOR = `title "Segno Anchor"
time 4/4
note 1/16

HH | x @segno x x x |`;

const NAV_ONLY = `title "Nav Only Measure"
time 4/4
note 1/16

HH | x x x x | @dc |`;

const NAV_MULTI_START = `title "Multi Start Nav"
time 4/4
note 1/16

HH | @segno @coda x x |`;

const NAV_TOCODA_START = `title "ToCoda at Start"
time 4/4
note 1/16

HH | @to-coda x x x |`;

const NAV_SEGNO_END = `title "Segno at End"
time 4/4
note 1/16

HH | x x x @segno |`;

type TestCase = { name: string; dsl: string };

const ALL_CASES: TestCase[] = [
  { name: "basic", dsl: BASIC },
  { name: "tempo/time", dsl: TEMPO_TIME },
  { name: "grouping", dsl: GROUPING },
  { name: "all tracks", dsl: ALL_TRACKS },
  { name: "all tokens", dsl: ALL_TOKENS },
  { name: "modifiers", dsl: MODIFIERS },
  { name: "chained modifiers", dsl: CHAINED_MODIFIERS },
  { name: "combined hits", dsl: COMBINED_HITS },
  { name: "durations", dsl: DURATIONS },
  { name: "repeat barlines", dsl: REPEAT_BARLINES },
  { name: "voltas", dsl: VOLTAS },
  { name: "groups", dsl: GROUPS },
  { name: "groups with tracks", dsl: GROUPS_WITH_TRACKS },
  { name: "group spans", dsl: GROUP_SPANS },
  { name: "navigation", dsl: NAVIGATION },
  { name: "segno anchor", dsl: NAV_SEGNO_ANCHOR },
  { name: "nav only measure", dsl: NAV_ONLY },
  { name: "measure repeat", dsl: MEASURE_REPEAT },
];

// ============================================================
// Tests
// ============================================================

describe("lezer parity — skeleton", () => {
  for (const { name, dsl } of ALL_CASES) {
    it(`matches regex parser for ${name}`, () => {
      const regex = parseDocumentSkeleton(dsl);
      const lezer = parseDocumentSkeletonFromLezer(dsl);

      // Header parity
      compareHeaders(regex, lezer);

      // Error parity
      expect(lezer.errors.length, "lezer should produce no errors").toBe(0);
      expect(regex.errors.length, "regex should produce no errors").toBe(0);

      // Full structural parity (ignoring source metadata)
      const rn = normalize(regex);
      const ln = normalize(lezer);
      expect(ln).toEqual(rn);
    });
  }
});

describe("lezer parity — navigation errors", () => {
  it("reports error for multiple start nav markers", () => {
    const regex = parseDocumentSkeleton(NAV_MULTI_START);
    const lezer = parseDocumentSkeletonFromLezer(NAV_MULTI_START);
    expect(regex.errors.length).toBeGreaterThan(0);
    expect(lezer.errors.length).toBe(regex.errors.length);
    expect(lezer.errors[0].message).toContain("multiple start-side navigation");
  });

  it("reports error for @to-coda at measure start", () => {
    const regex = parseDocumentSkeleton(NAV_TOCODA_START);
    const lezer = parseDocumentSkeletonFromLezer(NAV_TOCODA_START);
    expect(regex.errors.length).toBeGreaterThan(0);
    expect(lezer.errors.length).toBe(regex.errors.length);
    expect(lezer.errors[0].message).toContain("may not appear at the beginning");
  });

  it("reports error for @segno at measure end", () => {
    const regex = parseDocumentSkeleton(NAV_SEGNO_END);
    const lezer = parseDocumentSkeletonFromLezer(NAV_SEGNO_END);
    expect(regex.errors.length).toBeGreaterThan(0);
    expect(lezer.errors.length).toBe(regex.errors.length);
    expect(lezer.errors[0].message).toContain("may not appear at the end");
  });
});
