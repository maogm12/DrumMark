import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C16: inline repeat count", () => {
  it("treats `*1` as a single total measure and keeps measure metadata on that same bar", () => {
    const source = `time 4/4
divisions 4

|1. @segno d - - - @ds-al-coda *1 |.`;

    const doc = parseDocumentSkeleton(source);
    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(1);
    expect(doc.paragraphs[0].lines[0].measures[0]).toMatchObject({
      content: "d - - -",
      startNav: { kind: "segno", anchor: "left-edge" },
      endNav: { kind: "ds-al-coda", anchor: "right-edge" },
      voltaIndices: [1],
      barline: undefined,
    });

    const score = buildNormalizedScore(source);
    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(1);
    expect(score.measures[0]).toMatchObject({
      startNav: { kind: "segno", anchor: "left-edge" },
      endNav: { kind: "ds-al-coda", anchor: "right-edge" },
      volta: { indices: [1] },
      barline: "double",
    });
  });

  it("expands `*N` to a total run and splits measure-level metadata across first and last expanded bars", () => {
    const source = `time 4/4
divisions 4

|2. @segno d - - - @ds-al-coda *3 |.`;

    const doc = parseDocumentSkeleton(source);
    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(3);
    expect(doc.paragraphs[0].lines[0].measures.map((measure) => ({
      content: measure.content,
      startNav: measure.startNav,
      endNav: measure.endNav,
      voltaIndices: measure.voltaIndices,
      barline: measure.barline,
    }))).toEqual([
      {
        content: "d - - -",
        startNav: { kind: "segno", anchor: "left-edge" },
        endNav: undefined,
        voltaIndices: [2],
        barline: undefined,
      },
      {
        content: "d - - -",
        startNav: undefined,
        endNav: undefined,
        voltaIndices: undefined,
        barline: undefined,
      },
      {
        content: "d - - -",
        startNav: undefined,
        endNav: { kind: "ds-al-coda", anchor: "right-edge" },
        voltaIndices: undefined,
        barline: undefined,
      },
    ]);

    const ast = buildScoreAst(source);
    expect(ast.errors).toEqual([]);
    expect(ast.paragraphs[0].tracks[0].measures).toHaveLength(3);
    expect(ast.paragraphs[0].tracks[0].measures.map((measure) => ({
      startNav: measure.startNav,
      endNav: measure.endNav,
      volta: measure.volta,
      barline: measure.barline,
    }))).toEqual([
      {
        startNav: { kind: "segno", anchor: "left-edge" },
        endNav: undefined,
        volta: { indices: [2] },
        barline: "regular",
      },
      {
        startNav: undefined,
        endNav: undefined,
        volta: undefined,
        barline: "regular",
      },
      {
        startNav: undefined,
        endNav: { kind: "ds-al-coda", anchor: "right-edge" },
        volta: undefined,
        barline: "regular",
      },
    ]);
  });

  it("preserves inline-repeat expansion and merged trailing metadata when declared on a non-leading track", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | x - - - | x - - - |
SD | @segno d - - - *3 |.`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(3);
    expect(score.measures.map((measure) => ({
      startNav: measure.startNav,
      barline: measure.barline,
    }))).toEqual([
      { startNav: { kind: "segno", anchor: "left-edge" }, barline: "regular" },
      { startNav: undefined, barline: "regular" },
      { startNav: undefined, barline: "final" },
    ]);
  });

  it("rejects non-positive inline repeat counts with a stable parser error", () => {
    const zero = parseDocumentSkeleton(`time 4/4
divisions 4

| d - - - *0 |`);

    expect(zero.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Repeat count must be at least 1",
    });

    const negative = parseDocumentSkeleton(`time 4/4
divisions 4

| d - - - *-1 |`);

    expect(negative.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Repeat count must be at least 1",
    });
  });
});
