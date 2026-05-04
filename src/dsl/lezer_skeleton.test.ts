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
});
