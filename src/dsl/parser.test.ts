import { describe, expect, it } from "vitest";
import { parseDocumentSkeleton } from "./parser";

describe("parseDocumentSkeleton", () => {
  it("parses headers and paragraphs", () => {
    const doc = parseDocumentSkeleton(`tempo 96
time 4/4
divisions 16

HH | x - x - |
SD | - - d - |

HH | x - X - |
BD | p - - - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.tempo.value).toBe(96);
    expect(doc.headers.time).toMatchObject({ beats: 4, beatUnit: 4 });
    expect(doc.headers.divisions.value).toBe(16);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0]).toMatchObject({
      startLine: 5,
    });
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["HH", "SD"]);
    expect(doc.paragraphs[0].lines[0].measures).toEqual([
      {
        content: "x - x -",
        tokens: [
          { kind: "basic", value: "x" },
          { kind: "basic", value: "-" },
          { kind: "basic", value: "x" },
          { kind: "basic", value: "-" },
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

  it("parses repeat boundaries from track lines", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH |: x - x - | x - X - :|x3`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toEqual([
      {
        content: "x - x -",
        tokens: [
          { kind: "basic", value: "x" },
          { kind: "basic", value: "-" },
          { kind: "basic", value: "x" },
          { kind: "basic", value: "-" },
        ],
        repeatStart: true,
        repeatEnd: false,
      },
      {
        content: "x - X -",
        tokens: [
          { kind: "basic", value: "x" },
          { kind: "basic", value: "-" },
          { kind: "basic", value: "X" },
          { kind: "basic", value: "-" },
        ],
        repeatStart: false,
        repeatEnd: true,
        repeatTimes: 3,
      },
    ]);
  });

  it("parses modifiers, HH open sugar, and groups into tokens", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH | x o x:close [3/2: x o X] |
SD | d g D:rim [3/2: d d:flam D] |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "x" },
      { kind: "modified", value: "x", modifier: "open" },
      { kind: "modified", value: "x", modifier: "close" },
      {
        kind: "group",
        count: 3,
        span: 2,
        items: [
          { kind: "basic", value: "x" },
          { kind: "modified", value: "x", modifier: "open" },
          { kind: "basic", value: "X" },
        ],
      },
    ]);
    expect(doc.paragraphs[0].lines[1].measures[0].tokens).toEqual([
      { kind: "basic", value: "d" },
      { kind: "basic", value: "g" },
      { kind: "modified", value: "D", modifier: "rim" },
      {
        kind: "group",
        count: 3,
        span: 2,
        items: [
          { kind: "basic", value: "d" },
          { kind: "modified", value: "d", modifier: "flam" },
          { kind: "basic", value: "D" },
        ],
      },
    ]);
  });

  it("reports invalid tokens and group mistakes", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH | d x:bell [3/2: x] |`);

    expect(doc.errors).toEqual([
      { line: 4, column: 6, message: "Token `d` is invalid on track HH" },
      { line: 4, column: 8, message: "Token `x:bell` is invalid on track HH" },
      { line: 4, column: 15, message: "Group [3/2] expects 3 items, got 1" },
    ]);
  });
});
