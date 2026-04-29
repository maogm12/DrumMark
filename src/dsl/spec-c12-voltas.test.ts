import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";

describe("spec C12: repeat rules and voltas", () => {
  it("treats repeat boundaries on any track as global across paragraphs", () => {
    const source = `time 4/4
divisions 4

HH |: x - - - | x - - - |

SD | - - - - | d - - - :|`;

    const ast = buildScoreAst(source);
    expect(ast.errors).toEqual([]);
    expect(ast.repeatSpans).toEqual([{ startBar: 0, endBar: 3, times: 2 }]);

    const score = buildNormalizedScore(source);
    expect(score.errors).toEqual([]);
    expect(score.measures.map((measure) => measure.barline)).toEqual([
      "repeat-start",
      "regular",
      "regular",
      "repeat-end",
    ]);
  });

  it("preserves volta metadata and repeat-end semantics when declared on non-leading tracks", () => {
    const source = `time 4/4
divisions 4

HH |: x - - - | x - - - |

SD |1. d - - - :|

BD |2. b - - - |.`;

    const ast = buildScoreAst(source);
    expect(ast.errors).toEqual([]);
    expect(ast.repeatSpans).toEqual([{ startBar: 0, endBar: 2, times: 2 }]);

    const score = buildNormalizedScore(source);
    expect(score.errors).toEqual([]);
    expect(score.measures[0]).toMatchObject({ barline: "repeat-start" });
    expect(score.measures[2]).toMatchObject({
      barline: "repeat-end",
      volta: { indices: [1] },
    });
    expect(score.measures[3]).toMatchObject({
      barline: "final",
      volta: { indices: [2] },
    });
  });

  it("keeps shared volta indices from `|1,2.` in canonical measure metadata", () => {
    const source = `time 4/4
divisions 4

HH | x - - - |
SD |1,2. d - - - |`;

    const ast = buildScoreAst(source);
    expect(ast.errors).toEqual([]);
    expect(ast.paragraphs[0].tracks.find((track) => track.track === "SD")?.measures[0]).toMatchObject({
      volta: { indices: [1, 2] },
    });

    const score = buildNormalizedScore(source);
    expect(score.errors).toEqual([]);
    expect(score.measures[0]).toMatchObject({
      volta: { indices: [1, 2] },
    });
  });

  it("rejects nested repeat starts even when the boundaries are split across tracks", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH |: x - - - | x - - - :|
SD | - - - - |: d - - - |`);

    expect(score.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Nested repeat start at bar 2 is not supported",
    });
  });

  it("rejects conflicting volta indices on the same global bar", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH |1. x - - - |
SD |2. d - - - |`);

    expect(score.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Conflicting volta declarations at bar 1",
    });
  });
});
