import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { buildScoreAst } from "./ast";
import { parseDocumentSkeleton } from "./parser";

describe("spec C14: markers and jumps", () => {
  it("parses all marker and jump spellings into canonical measure metadata", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| @segno d - - - | @coda d - - - | @fine d - - - | @to-coda d - - - | @da-capo d - - - |
| @dal-segno d - - - | @dc-al-fine d - - - | @dc-al-coda d - - - | @ds-al-fine d - - - | @ds-al-coda d - - - |`);

    expect(doc.errors).toEqual([]);
    const measures = doc.paragraphs[0].lines.flatMap((line) => line.measures);

    expect(measures).toHaveLength(10);
    expect(measures.map((measure) => measure.marker ?? measure.jump)).toEqual([
      "segno",
      "coda",
      "fine",
      "to-coda",
      "da-capo",
      "dal-segno",
      "dc-al-fine",
      "dc-al-coda",
      "ds-al-fine",
      "ds-al-coda",
    ]);
    expect(measures.every((measure) => measure.content === "d - - -")).toBe(true);
  });

  it("allows one marker and one jump anywhere inside a measure without disturbing note parsing", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| d @segno - @to-coda d - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0]).toMatchObject({
      marker: "segno",
      jump: "to-coda",
      content: "d - d -",
    });
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toMatchObject([
      { kind: "basic", value: "d" },
      { kind: "basic", value: "-" },
      { kind: "basic", value: "d" },
      { kind: "basic", value: "-" },
    ]);
  });

  it("treats navigation declared on any track as global measure metadata across paragraphs", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - |
SD | @coda d - - - |

HH | x - - - |
BD | - - @ds-al-fine b - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(2);
    expect(score.measures[0]).toMatchObject({
      marker: "coda",
      jump: undefined,
      barline: "regular",
    });
    expect(score.measures[1]).toMatchObject({
      marker: undefined,
      jump: "ds-al-fine",
      barline: "regular",
    });
  });

  it("keeps marker and jump together when both are declared on the same global bar", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - |
SD | @segno d - - @to-coda |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]).toMatchObject({
      marker: "segno",
      jump: "to-coda",
    });
  });

  it("rejects conflicting jump declarations on the same global bar", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | @da-capo x - - - |
SD | @ds-al-coda d - - - |`);

    expect(score.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Conflicting jumps at bar 1",
    });
  });

  it("rejects multiple markers or jumps inside a single measure on one track", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | @segno @coda x - - - |
SD | @da-capo @to-coda d - - - |`);

    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "Measure contains multiple markers",
    }));
    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "Measure contains multiple jumps",
    }));
  });
});
