import { describe, it, expect } from "vitest";
import { parseDocumentSkeleton } from "./parser";
import { parseDocumentSkeletonFromLezer } from "./lezer_skeleton";

const TEST_CASES = [
  // Simple
  `title "Test Song"
time 4/4
note 1/16

HH | x - x - |
SD | d - d - |`,

  // Medium with modifiers
  `title "Test Song"
tempo 120
time 4/4
note 1/16

HH | x:accent - s:ghost - x x |
SD | d:flam - d:flam - d d |
BD | b - b - b b |`,

  // Complex with groups and combined hits
  `title "Complex Study"
tempo 96
time 4/4
note 1/16
grouping 2+2

HH | x - x - | x - x - |
SD | [d d] - d - | d - [d d] - |
BD | b - b - [b b] - |`,

  // Full featured
  `title "Full Score"
subtitle "A Drum Notation Test"
composer "Test Author"
tempo 120
time 4/4
note 1/16
grouping 2+2

HH | x:accent - s:ghost - x x |
HF | X - X - X X |
SD | d:flam - d:flam - d d |
BD | b - b - b b |
T1 | t1 - t2 - t3 t4 |
RC | r - r - r r |

HH | x - x - | x - x - |
SD | d - d - | d - d - |
BD | b - b - | b - b - |`,

  // Anonymous lines
  `title "Anonymous Test"
time 4/4
note 1/16

| x - s - |
SD | d - d - |`,

  // Repeat barlines
  `title "Repeat Test"
time 4/4
note 1/16

HH |: x - x - :| x - x - |`,

  // Navigation markers
  `title "Nav Test"
time 4/4
note 1/16

| @segno c2 - cl - | %% | @fine |`,
];

function normalizeForCompare(skeleton: ReturnType<typeof parseDocumentSkeleton>) {
  // Strip line numbers and source references that may differ between parsers
  return JSON.stringify(skeleton, (key, value) => {
    if (key === "line" || key === "lineNumber" || key === "startLine" || key === "source" || key === "raw" || key === "startOffset") {
      return undefined;
    }
    return value;
  });
}

describe("lezer IR integration", () => {
  it("matches regex parser output for simple document", () => {
    // Value token properly terminated at newline
    const source = TEST_CASES[0];
    const regex = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    // Compare key structural parts
    expect(regex.headers.title?.value).toBe(lezer.headers.title?.value);
    expect(regex.headers.tempo.value).toBe(lezer.headers.tempo.value);
    expect(regex.headers.time.beats).toBe(lezer.headers.time.beats);
    expect(regex.headers.time.beatUnit).toBe(lezer.headers.time.beatUnit);
    expect(regex.paragraphs.length).toBe(lezer.paragraphs.length);
  });

  it("matches for medium document with modifiers", () => {
    // Value token properly terminated at newline
    const source = TEST_CASES[1];
    const regex = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(regex.paragraphs.length).toBe(lezer.paragraphs.length);
    expect(regex.headers.tempo.value).toBe(lezer.headers.tempo.value);
  });

  it("matches for complex document with groups", () => {
    // Value token properly terminated at newline
    const source = TEST_CASES[2];
    const regex = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(regex.paragraphs.length).toBe(lezer.paragraphs.length);
    expect(regex.headers.grouping.values).toEqual(lezer.headers.grouping.values);
  });

  it("matches for full featured document", () => {
    // Value token properly terminated at newline
    const source = TEST_CASES[3];
    const regex = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(regex.headers.title?.value).toBe(lezer.headers.title?.value);
    expect(regex.headers.subtitle?.value).toBe(lezer.headers.subtitle?.value);
    expect(regex.headers.composer?.value).toBe(lezer.headers.composer?.value);
    expect(regex.headers.tempo.value).toBe(lezer.headers.tempo.value);
    expect(regex.headers.time.beats).toBe(lezer.headers.time.beats);
    expect(regex.headers.time.beatUnit).toBe(lezer.headers.time.beatUnit);
    expect(regex.paragraphs.length).toBe(lezer.paragraphs.length);
  });

  it("matches for anonymous lines", () => {
    // Value token properly terminated at newline
    const source = TEST_CASES[4];
    const regex = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(regex.paragraphs.length).toBe(lezer.paragraphs.length);
  });

  it("matches for repeat barlines", () => {
    // Value token properly terminated at newline
    const source = TEST_CASES[5];
    const regex = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(regex.paragraphs.length).toBe(lezer.paragraphs.length);
  });

  it("produces zero errors for valid source", () => {
    // Value token properly terminated at newline
    for (const source of TEST_CASES) {
      const regex = parseDocumentSkeleton(source);
      const lezer = parseDocumentSkeletonFromLezer(source);

      expect(regex.errors, `regex parser errors for: ${source.slice(0, 50)}`).toEqual([]);
      expect(lezer.errors, `lezer parser errors for: ${source.slice(0, 50)}`).toEqual([]);
    }
  });

  it("handles paragraph note overrides for the first and later body paragraphs", () => {
    const source = `time 4/4
note 1/4

note 1/16
HH | d d d d d d d d d d d d d d d d |

note 1/8
HH | d d d d d d d d |`;

    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(lezer.errors).toEqual([]);
    expect(lezer.paragraphs).toHaveLength(2);
    expect(lezer.headers.note?.value).toBe(4);
    expect(lezer.paragraphs[0]?.noteValue).toBe(16);
    expect(lezer.paragraphs[1]?.noteValue).toBe(8);
  });

  it("reports header diagnostics on the lezer path", () => {
    const unknownHeader = parseDocumentSkeletonFromLezer(`swing 8ths
time 4/4
divisions 4

HH | x - x - |`);

    expect(unknownHeader.errors).toContainEqual({
      line: 1,
      column: 1,
      message: "Unknown header `swing`",
    });

    const lateHeader = parseDocumentSkeletonFromLezer(`time 4/4
divisions 4

HH | x - x - |
tempo 120`);

    expect(lateHeader.errors).toContainEqual({
      line: 5,
      column: 1,
      message: "Headers must appear before track content",
    });
  });

  it("keeps legacy bare routed blocks invalid instead of upgrading them to @TRACK semantics", () => {
    const lezer = parseDocumentSkeletonFromLezer(`time 4/4
divisions 4

| x RC { d d } |`);

    expect(lezer.errors).toContainEqual({
      line: 4,
      column: 5,
      message: "Legacy routed block syntax `RC { ... }` has been removed; use `@RC { ... }` instead.",
    });
    expect(lezer.paragraphs[0]?.lines[0]?.measures[0]?.tokens.some(
      (token) => token.kind === "braced" && token.track === "RC",
    )).toBe(false);
    expect(lezer.paragraphs[0]?.lines[0]?.measures[0]?.tokens.some(
      (token) => token.kind === "basic" && token.value === "RC",
    )).toBe(false);
  });

  it("reports non-positive inline repeat counts from structured suffix nodes", () => {
    const lezer = parseDocumentSkeletonFromLezer(`time 4/4
divisions 4

| d - - - *-1 |`);

    expect(lezer.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Repeat count must be at least 1",
    });
  });
});
