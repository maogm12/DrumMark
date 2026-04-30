import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C14: positional navigation", () => {
  it("parses supported start-side and end-side navigation spellings into canonical measure metadata", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| @segno d - - - | @coda d - - - | d - - - @fine | d - - - @to-coda | d - - - @dc |
| d - - - @ds | d - - - @dc-al-fine | d - - - @dc-al-coda | d - - - @ds-al-fine | d - - - @ds-al-coda |`);

    expect(doc.errors).toEqual([]);
    const measures = doc.paragraphs[0].lines.flatMap((line) => line.measures);

    expect(measures).toHaveLength(10);
    expect(measures.map((measure) => ({
      startNav: measure.startNav,
      endNav: measure.endNav,
    }))).toEqual([
      { startNav: { kind: "segno", anchor: "left-edge" }, endNav: undefined },
      { startNav: { kind: "coda", anchor: "left-edge" }, endNav: undefined },
      { startNav: undefined, endNav: { kind: "fine", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "to-coda", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "dc", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "ds", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "dc-al-fine", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "dc-al-coda", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "ds-al-fine", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "ds-al-coda", anchor: "right-edge" } },
    ]);
  });

  it("anchors interior segno to the following event and interior to-coda to the preceding event", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| d @segno - @to-coda d - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]).toMatchObject({
      startNav: { kind: "segno", anchor: { eventAfter: { numerator: 1, denominator: 4 } } },
      endNav: { kind: "to-coda", anchor: { eventBefore: { numerator: 1, denominator: 4 } } },
    });
  });

  it("treats pure navigation measures as default start-edge or end-edge anchors", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| @segno |
| @coda |
| @fine |
| @to-coda |
| @dc |
| @ds |`);

    expect(doc.errors).toEqual([]);
    const measures = doc.paragraphs[0].lines.flatMap((line) => line.measures);
    expect(measures.map((measure) => ({
      startNav: measure.startNav,
      endNav: measure.endNav,
    }))).toEqual([
      { startNav: { kind: "segno", anchor: "left-edge" }, endNav: undefined },
      { startNav: { kind: "coda", anchor: "left-edge" }, endNav: undefined },
      { startNav: undefined, endNav: { kind: "fine", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "to-coda", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "dc", anchor: "right-edge" } },
      { startNav: undefined, endNav: { kind: "ds", anchor: "right-edge" } },
    ]);
  });

  it("merges compatible start-side and end-side navigation across tracks", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | @segno x - - - |
SD | d - - - @to-coda |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]).toMatchObject({
      startNav: { kind: "segno", anchor: "left-edge" },
      endNav: { kind: "to-coda", anchor: "right-edge" },
    });
  });

  it("forces final and double barlines from end-side navigation", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| d - - - @fine | d - - - @dc | d - - - @ds |`);

    expect(score.errors).toEqual([]);
    expect(score.measures.map((measure) => ({
      endNav: measure.endNav?.kind,
      barline: measure.barline,
    }))).toEqual([
      { endNav: "fine", barline: "final" },
      { endNav: "dc", barline: "double" },
      { endNav: "ds", barline: "double" },
    ]);
  });

  it("rejects deprecated da-capo and dal-segno spellings", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| @da-capo |
| @dal-segno |`);

    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "Use `@dc` instead of `@da-capo`",
    }));
    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "Use `@ds` instead of `@dal-segno`",
    }));
  });

  it("rejects incompatible start-side or end-side navigation on one bar", () => {
    const startConflict = parseDocumentSkeleton(`time 4/4
divisions 4

| @segno @coda x - - - |`);

    expect(startConflict.errors).toContainEqual(expect.objectContaining({
      message: "Measure contains multiple start-side navigation markers",
    }));

    const endConflict = parseDocumentSkeleton(`time 4/4
divisions 4

| x - - - @fine @to-coda |`);

    expect(endConflict.errors).toContainEqual(expect.objectContaining({
      message: "Measure contains multiple end-side navigation instructions",
    }));
  });

  it("rejects forbidden placements and repeat-ending conflicts", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| x x x @segno |
| x @coda x x |
| @to-coda x x x |
|: x x x x @fine :| |`);

    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "`@segno` may not appear at the end of a measure",
    }));
    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "`@coda` may appear only at the beginning of a measure",
    }));
    expect(doc.errors).toContainEqual(expect.objectContaining({
      message: "`@to-coda` may not appear at the beginning of a measure",
    }));

    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x @fine :| |`);

    expect(score.errors).toContainEqual(expect.objectContaining({
      message: "End-side navigation `fine` cannot appear on a repeat-ending bar 1",
    }));
  });
});
