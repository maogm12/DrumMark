import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C13: measure-repeat shorthand", () => {
  it("parses `%` and `%%` as standalone measure-repeat intent with no note tokens", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| d d d d | % | %% |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[1]).toMatchObject({
      tokens: [],
      measureRepeatSlashes: 1,
    });
    expect(doc.paragraphs[0].lines[0].measures[2]).toMatchObject({
      tokens: [],
      measureRepeatSlashes: 2,
    });
  });

  it("rejects `%` shorthand when mixed with ordinary note content in the same measure", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| d % - - |`);

    expect(doc.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Measure repeat shorthand must occupy the entire measure",
    });
  });

  it("allows chained measure-repeat references in AST validation", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| d d d d | % | %% |`);

    expect(score.errors).toEqual([]);
  });

  it("rejects measure-repeat bars that do not have enough preceding source measures", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| d d d d | %% |`);

    expect(score.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Measure repeat at bar 2 does not have 2 preceding measure(s)",
    });
  });

  it("preserves canonical measure-repeat intent when declared on a non-leading track and other tracks leave the bar empty", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | x - - - | |
SD | - - - - | - - - - | %% |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(3);
    expect(score.measures[2]).toMatchObject({
      measureRepeat: { slashes: 2 },
      events: [],
      barline: "final",
    });
  });

  it("rejects a measure-repeat bar when another track provides ordinary content on the same global bar", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | x - - - | x - - - | x - - - |
SD | - - - - | - - - - | %% |`);

    expect(score.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Measure repeat at bar 3 cannot coexist with ordinary content on another track",
    });
  });
});
