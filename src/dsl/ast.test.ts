import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";

describe("buildScoreAst", () => {
  it("auto-fills missing known tracks inside later paragraphs", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | x - x - |
SD | d - D - |

C  | X - - - |`);

    expect(score.errors).toEqual([]);
    expect(score.paragraphs).toHaveLength(2);
    expect(score.paragraphs[1].tracks.map((track) => track.track)).toEqual(["HH", "SD", "C"]);
    expect(score.paragraphs[1].tracks[0]).toMatchObject({
      track: "HH",
      generated: true,
    });
    expect(score.paragraphs[1].tracks[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "-" },
      { kind: "basic", value: "-" },
      { kind: "basic", value: "-" },
      { kind: "basic", value: "-" },
    ]);
  });

  it("reports paragraph measure-count mismatches", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | x - x - |
SD | d - D - | d - d - |`);

    expect(score.errors).toEqual([
      {
        line: 4,
        column: 1,
        message: "All explicit track lines in a paragraph must have the same measure count",
      },
    ]);
  });

  it("builds repeat spans and reports repeat conflicts", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH |: x - x - | x - x - :|
SD |  d - D - | d - d -   |

HH |: x - x - :|x3
SD |  d - d - :|x2`);

    expect(score.repeatSpans).toEqual([
      { startBar: 0, endBar: 1, times: 2 },
      { startBar: 2, endBar: 2, times: 3 },
    ]);
    expect(score.errors).toEqual([
      {
        line: 7,
        column: 1,
        message: "Conflicting repeat count at bar 3",
      },
    ]);
  });

  it("reports unmatched repeat boundaries", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH |: x - x - |
SD |  d - d - |`);

    expect(score.repeatSpans).toEqual([]);
    expect(score.errors).toEqual([
      {
        line: 4,
        column: 1,
        message: "Repeat starting at bar 1 is missing an end",
      },
    ]);
  });
});
