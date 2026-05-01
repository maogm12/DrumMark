import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C11: repeat barlines", () => {
  it("distinguishes regular, repeat-start, repeat-end, and final barlines in parser output", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

|: x | s :| b |.`);

    expect(doc.errors).toEqual([]);
    const measures = doc.paragraphs[0].lines[0].measures;

    expect(measures).toHaveLength(3);
    expect(measures[0]).toMatchObject({
      content: "x",
      repeatStart: true,
      repeatEnd: false,
      voltaTerminator: undefined,
    });
    expect(measures[1]).toMatchObject({
      content: "s",
      repeatStart: false,
      repeatEnd: true,
      repeatTimes: 2,
      voltaTerminator: undefined,
    });
    expect(measures[2]).toMatchObject({
      content: "b",
      repeatStart: false,
      repeatEnd: false,
      barline: undefined,
      voltaTerminator: true,
    });
  });

  it("treats `|.` as a volta terminator without forcing a final barline", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|1. x - - - |. x - - - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(2);
    expect(score.measures[0]).toMatchObject({
      barline: "regular",
      volta: { indices: [1] },
    });
    expect(score.measures[1]).toMatchObject({
      barline: "final",
    });
    expect(score.measures[1]?.volta).toBeUndefined();
  });

  it("infers a repeat-end barline when a volta is followed by a different next volta", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

|: x - - - |1. x - - - |2. o - - - |3. c - - - |`);

    expect(doc.errors).toEqual([]);
    const measures = doc.paragraphs[0].lines[0].measures;

    expect(measures[1]).toMatchObject({
      repeatStart: false,
      repeatEnd: true,
      repeatTimes: 2,
      voltaIndices: [1],
    });
    expect(measures[2]).toMatchObject({
      repeatStart: false,
      repeatEnd: true,
      repeatTimes: 2,
      voltaIndices: [2],
    });
    expect(measures[3]).toMatchObject({
      repeatEnd: false,
      repeatTimes: undefined,
      voltaIndices: [3],
    });
  });

  it("treats `|: :|` as a single repeat-both empty measure", () => {
    const ast = buildScoreAst(`time 4/4
divisions 4

|: :|`);

    expect(ast.errors).toEqual([]);
    expect(ast.repeatSpans).toEqual([{ startBar: 0, endBar: 0, times: 2 }]);

    const measure = ast.paragraphs[0].tracks[0].measures[0];
    expect(measure).toMatchObject({
      repeatStart: true,
      repeatEnd: true,
      generated: true,
      barline: "repeat-both",
    });
    expect(measure.tokens).toHaveLength(4);
  });

  it("treats `||` as a double barline with no empty measure between", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| x || s |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(2);
    expect(score.measures[0]).toMatchObject({
      barline: "double",
      generated: false,
    });
    expect(score.measures[1]).toMatchObject({
      barline: "final",
      generated: false,
    });
  });

  it("treats `|  |` as an empty generated measure between two regular barlines", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| x |  | s |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(3);
    expect(score.measures[0]).toMatchObject({
      barline: "regular",
      generated: false,
    });
    expect(score.measures[1]).toMatchObject({
      barline: "regular",
      generated: true,
    });
    expect(score.measures[1].events).toEqual([]);
    expect(score.measures[2]).toMatchObject({
      barline: "final",
      generated: false,
    });
  });
});
