import { describe, expect, it } from "vitest";
import { parseDocumentSkeleton } from "./parser";

describe("parseDocumentSkeleton", () => {
  it("parses headers and paragraphs", () => {
    const doc = parseDocumentSkeleton(`title Funk Study No. 1
subtitle Verse groove
composer G. Mao
tempo 96
time 4/4
divisions 16

HH | x - x - |
SD | - - d - |

HH | x - X - |
BD | p - - - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.title?.value).toBe("Funk Study No. 1");
    expect(doc.headers.subtitle?.value).toBe("Verse groove");
    expect(doc.headers.composer?.value).toBe("G. Mao");
    expect(doc.headers.tempo.value).toBe(96);
    expect(doc.headers.time).toMatchObject({ beats: 4, beatUnit: 4 });
    expect(doc.headers.divisions.value).toBe(16);
    expect(doc.headers.grouping.values).toEqual([2, 2]);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0]).toMatchObject({
      startLine: 8,
    });
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["HH", "SD"]);
    expect(doc.paragraphs[0].lines[0].measures).toEqual([
      {
        content: "x - x -",
        tokens: [
          { kind: "basic", value: "x", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
          { kind: "basic", value: "x", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
        ],
        repeatStart: false,
        repeatEnd: false,
      },
    ]);
    expect(doc.paragraphs[1].lines.map((line) => line.track)).toEqual(["HH", "BD"]);
  });

  it("defaults tempo and reports missing required headers", () => {
    const doc = parseDocumentSkeleton(`HH | x - x - |`);

    expect(doc.headers.tempo.value).toBe(120);
    expect(doc.errors).toEqual([
      { line: 1, column: 1, message: "Missing required header `time`" },
      { line: 1, column: 1, message: "Missing required header `divisions`" },
    ]);
  });

  it("reports malformed headers and headers after body content", () => {
    const doc = parseDocumentSkeleton(`tempo fast
time 4/4
HH | x - x - |
divisions 16`);

    expect(doc.errors).toEqual([
      { line: 1, column: 7, message: "Tempo must be a positive integer" },
      { line: 4, column: 1, message: "Headers must appear before track content" },
      { line: 1, column: 1, message: "Missing required header `divisions`" },
    ]);
  });

  it("reports unsupported beat units", () => {
    const doc = parseDocumentSkeleton(`time 4/3
divisions 16

HH | x - x - |`);

    expect(doc.errors).toEqual([
      { line: 1, column: 6, message: "Beat unit must be one of 2, 4, 8, or 16" },
      { line: 1, column: 1, message: "Missing required header `time`" },
    ]);
  });

  it("reports duplicate and empty metadata headers", () => {
    const doc = parseDocumentSkeleton(`title
title First
title Second
subtitle
composer
time 4/4
divisions 4

HH | x - x - |`);

    expect(doc.errors).toEqual([
      { line: 1, column: 1, message: "Header `title` expects non-empty text" },
      { line: 3, column: 1, message: "Duplicate header `title`" },
      { line: 4, column: 1, message: "Header `subtitle` expects non-empty text" },
      { line: 5, column: 1, message: "Header `composer` expects non-empty text" },
    ]);
  });

  it("reports unknown headers and missing explicit grouping for unstable meters", () => {
    const doc = parseDocumentSkeleton(`swing 8
time 7/8
divisions 14

HH | x - x - x - x |`);

    expect(doc.errors).toEqual([
      { line: 1, column: 1, message: "Unknown header `swing`" },
      { line: 2, column: 1, message: "Missing required header `grouping` for time 7/8" },
    ]);
  });

  it("parses repeat boundaries from track lines", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH |: x - x - | x - X - :|x3`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toEqual([
      {
        content: "x - x -",
        tokens: [
          { kind: "basic", value: "x", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
          { kind: "basic", value: "x", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
        ],
        repeatStart: true,
        repeatEnd: false,
      },
      {
        content: "x - X -",
        tokens: [
          { kind: "basic", value: "x", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
          { kind: "basic", value: "X", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
        ],
        repeatStart: false,
        repeatEnd: true,
        repeatTimes: 3,
      },
    ]);
  });

  it("reports repeat counts below two", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH |: x - x - :|x1`);

    expect(doc.errors).toContainEqual({
      line: 4,
      column: 15,
      message: "Repeat count must be at least 2",
    });
  });

  it("parses modifiers, HH open sugar, and groups into tokens", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH | x o x:close [2: x o X] |
SD | d d D:rim [2: d d:flam D] |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "x", dots: 0, halves: 0 },
      { kind: "modified", value: "x", modifier: "open", dots: 0, halves: 0 },
      { kind: "modified", value: "x", modifier: "close", dots: 0, halves: 0 },
      {
        kind: "group",
        count: 3,
        span: 2,
        items: [
          { kind: "basic", value: "x", dots: 0, halves: 0 },
          { kind: "modified", value: "x", modifier: "open", dots: 0, halves: 0 },
          { kind: "basic", value: "X", dots: 0, halves: 0 },
        ],
      },
    ]);
    expect(doc.paragraphs[0].lines[1].measures[0].tokens).toEqual([
      { kind: "basic", value: "d", dots: 0, halves: 0 },
      { kind: "basic", value: "d", dots: 0, halves: 0 },
      { kind: "modified", value: "D", modifier: "rim", dots: 0, halves: 0 },
      {
        kind: "group",
        count: 3,
        span: 2,
        items: [
          { kind: "basic", value: "d", dots: 0, halves: 0 },
          { kind: "modified", value: "d", modifier: "flam", dots: 0, halves: 0 },
          { kind: "basic", value: "D", dots: 0, halves: 0 },
        ],
      },
    ]);
  });

  it("parses accented sugar tokens (O, C, P)", () => {
    const doc = parseDocumentSkeleton(`time 4/4\ndivisions 4\n\nHH | O C - - |\nBD | P - - - |`);
    expect(doc.errors).toEqual([]);
    
    const hhMeasures = doc.paragraphs[0].lines[0].measures;
    expect(hhMeasures[0].tokens).toEqual([
      { kind: "modified", value: "X", modifier: "open", dots: 0, halves: 0 },
      { kind: "basic", value: "C", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
    ]);

    const bdMeasures = doc.paragraphs[0].lines[1].measures;
    expect(bdMeasures[0].tokens[0]).toEqual({ kind: "basic", value: "P", dots: 0, halves: 0 });
  });

  it("parses dotted notes and modified notes", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 8
HH | x. o. x:open. x:close.. |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "x", dots: 1, halves: 0 },
      { kind: "modified", value: "x", modifier: "open", dots: 1, halves: 0 },
      { kind: "modified", value: "x", modifier: "open", dots: 1, halves: 0 },
      { kind: "modified", value: "x", modifier: "close", dots: 2, halves: 0 },
    ]);
  });

  it("rejects `g` ghost sugar on all tracks", () => {
    const doc = parseDocumentSkeleton(`time 4/4\ndivisions 4\n\nHH | g |\nSD | g |\nHF | g |\nBD | g |`);

    expect(doc.errors).toEqual([
      { line: 4, column: 6, message: "Unknown token `g` on track HH" },
      { line: 5, column: 6, message: "Unknown token `g` on track SD" },
      { line: 6, column: 6, message: "Unknown token `g` on track HF" },
      { line: 7, column: 6, message: "Unknown token `g` on track BD" },
    ]);
  });

  it("parses accented tom tokens in DR track", () => {
    const doc = parseDocumentSkeleton(`time 4/4\ndivisions 4\n\nDR | T1 T2 T3 S |`);
    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "T1", dots: 0, halves: 0 },
      { kind: "basic", value: "T2", dots: 0, halves: 0 },
      { kind: "basic", value: "T3", dots: 0, halves: 0 },
      { kind: "basic", value: "S", dots: 0, halves: 0 },
    ]);
  });

  it("parses DR tokens and allows empty measures", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 8

DR | s - [2: t1 s t2] - | |
HH | x - c:choke - x - x - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].track).toBe("DR");
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "s", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      {
        kind: "group",
        count: 3,
        span: 2,
        items: [
          { kind: "basic", value: "t1", dots: 0, halves: 0 },
          { kind: "basic", value: "s", dots: 0, halves: 0 },
          { kind: "basic", value: "t2", dots: 0, halves: 0 },
        ],
      },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
    ]);
    expect(doc.paragraphs[0].lines[0].measures[1].tokens).toEqual([]);
    expect(doc.paragraphs[0].lines[1].measures[0].tokens[2]).toEqual({
      kind: "modified",
      value: "c",
      modifier: "choke",
      dots: 0,
      halves: 0,
    });
  });

  it("reports DR modifiers as invalid", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

DR | s:rim - t1 - |`);

    expect(doc.errors).toContainEqual({
      line: 4,
      column: 6,
      message: "Track `DR` does not support modifiers",
    });
  });

  it("parses whitespace-equivalent measure syntax", () => {
    const spaced = parseDocumentSkeleton(`time 4/4
divisions 4

HH | x - x - |`);
    const compact = parseDocumentSkeleton(`time 4/4
divisions 4

HH |x-x-|`);

    expect(spaced.errors).toEqual([]);
    expect(compact.errors).toEqual([]);
    expect(compact.paragraphs[0].lines[0].measures[0].tokens).toEqual(
      spaced.paragraphs[0].lines[0].measures[0].tokens,
    );
  });

  it("reports invalid tokens and group mistakes", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH | d x:bell [2: x] |
SD | d:open |`);

    expect(doc.errors).toEqual([
      { line: 4, column: 6, message: "Token `d` is invalid on track HH" },
      { line: 4, column: 8, message: "Token `x:bell` is invalid on track HH" },
      { line: 5, column: 6, message: "Token `d:open` is invalid on track SD" },
    ]);
  });

  it("blocks :open and shorthand sugar on tracks other than HH", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
C  | x:open |
RC | o |
RC | c |`);

    expect(doc.errors).toEqual([
      { line: 3, column: 6, message: "Token `x:open` is invalid on track C" },
      { line: 4, column: 6, message: "Token `o` is invalid on track RC" },
      { line: 5, column: 6, message: "Token `c` is invalid on track RC" },
    ]);
  });
});
