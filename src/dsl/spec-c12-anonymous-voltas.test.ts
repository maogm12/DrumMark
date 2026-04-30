import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";

describe("anonymous-track voltas", () => {
  it("parses `:|2.` and spaced `| 3.` as alternate endings on anonymous tracks", () => {
    const source = `title Repeat Structure
time 4/4
divisions 4

|: x x x x |1. x x x o :|2. x x/x/ x x |

| x/x/ x x x/x/ | 3. o o o o |`;

    const ast = buildScoreAst(source);
    expect(ast.errors).toEqual([]);
    expect(ast.repeatSpans).toEqual([{ startBar: 0, endBar: 1, times: 2 }]);

    const score = buildNormalizedScore(source);
    expect(score.errors).toEqual([]);
    expect(score.measures.map((measure) => ({
      barline: measure.barline,
      volta: measure.volta?.indices,
    }))).toEqual([
      { barline: "repeat-start", volta: undefined },
      { barline: "repeat-end", volta: [1] },
      { barline: "regular", volta: [2] },
      { barline: "regular", volta: [2] },
      { barline: "final", volta: [3] },
    ]);
  });
});
