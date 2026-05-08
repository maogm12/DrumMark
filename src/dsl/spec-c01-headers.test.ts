import { describe, expect, it } from "vitest";
import { parseDocumentSkeleton } from "./parser";

describe("spec C01 headers", () => {
  it("parses all supported header fields with metadata text", () => {
    const doc = parseDocumentSkeleton(`title Backbeat Study
subtitle Verse groove
composer G. Mao
tempo 96
time 4/4
divisions 16
grouping 2+2

HH | x - x - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.title?.value).toBe("Backbeat Study");
    expect(doc.headers.subtitle?.value).toBe("Verse groove");
    expect(doc.headers.composer?.value).toBe("G. Mao");
    expect(doc.headers.tempo.value).toBe(96);
    expect(doc.headers.time).toMatchObject({ beats: 4, beatUnit: 4 });
    expect(doc.headers.divisions!.value).toBe(16);
    expect(doc.headers.grouping.values).toEqual([2, 2]);
  });

  it.each([
    ["2/4", [1, 1]],
    ["3/4", [1, 1, 1]],
    ["4/4", [2, 2]],
    ["2/2", [1, 1]],
    ["3/8", [1, 1, 1]],
    ["6/8", [3, 3]],
    ["9/8", [3, 3, 3]],
    ["12/8", [3, 3, 3, 3]],
  ])("infers grouping %j for time %s when omitted", (time, grouping) => {
    const doc = parseDocumentSkeleton(`time ${time}
divisions 16

HH | x - x - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.grouping.values).toEqual(grouping);
    expect(doc.headers.grouping.line).toBe(0);
  });

  it("defaults tempo to 120 when omitted", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH | x - x - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.tempo).toMatchObject({ value: 120, line: 0 });
  });

  it("supports note 1/N header", () => {
    const doc = parseDocumentSkeleton(`time 4/4
note 1/8

HH | x - x - |`);
    expect(doc.errors).toEqual([]);
    expect(doc.headers.note?.value).toBe(8);
  });

  it("reports missing required time and note headers", () => {
    const doc = parseDocumentSkeleton(`HH | x - x - |`);

    expect(doc.errors).toContainEqual({
      line: 1,
      column: 1,
      message: "Missing required header `time`",
    });
    expect(doc.errors).toContainEqual({
      line: 1,
      column: 1,
      message: "Missing required header `note` (e.g., note 1/16)",
    });
  });

  it("requires explicit grouping for irregular meters", () => {
    const doc = parseDocumentSkeleton(`time 5/8
divisions 10

HH | x - x - x - x - x - |`);

    expect(doc.errors).toContainEqual({
      line: 1,
      column: 1,
      message: "Missing required header `grouping` for time 5/8",
    });
  });

  it("rejects grouping whose sum does not equal the time numerator", () => {
    const doc = parseDocumentSkeleton(`time 7/8
divisions 14
grouping 3+3

HH | x - x - x - x - x - x - x - |`);

    expect(doc.errors).toContainEqual({
      line: 3,
      column: 1,
      message: "Grouping must sum to time numerator 7",
    });
  });

  it("reports stable parser errors for invalid header values", () => {
    const doc = parseDocumentSkeleton(`tempo fast
time 4/3
divisions zero
grouping 2+two

HH | x - x - |`);

    expect(doc.errors).toContainEqual({
      line: 1,
      column: 7,
      message: "Tempo must be a positive integer",
    });
    expect(doc.errors).toContainEqual({
      line: 2,
      column: 6,
      message: "Beat unit must be one of 2, 4, 8, or 16",
    });
    expect(doc.errors).toContainEqual({
      line: 3,
      column: 11,
      message: "Divisions must be a positive integer",
    });
    expect(doc.errors).toContainEqual({
      line: 4,
      column: 10,
      message: "Grouping must use the form n+n+...",
    });
  });

  it("rejects duplicate structural headers", () => {
    const doc = parseDocumentSkeleton(`time 4/4
time 3/4
divisions 16
divisions 12
note 1/16
note 1/8
grouping 2+2
grouping 3

HH | x - x - |`);

    expect(doc.errors).toContainEqual({
      line: 2,
      column: 1,
      message: "Duplicate header `time`",
    });
    expect(doc.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Duplicate header `divisions`",
    });
    expect(doc.errors).toContainEqual({
      line: 6,
      column: 1,
      message: "Duplicate header `note`",
    });
    expect(doc.errors).toContainEqual({
      line: 8,
      column: 1,
      message: "Duplicate header `grouping`",
    });
  });
});
