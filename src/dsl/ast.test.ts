import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";

const rests = (count: number) => Array.from({ length: count }, () => "-").join(" ");

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
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
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

  it("builds repeat spans", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH |: x - x - | x - x - :|
SD |  d - D - | d - d -   |

HH |: x - x - | x - x - :|
SD |  d - d - | d - d -   |`);

    expect(score.repeatSpans).toEqual([
      { startBar: 0, endBar: 1, times: 2 },
      { startBar: 2, endBar: 3, times: 2 },
    ]);
    expect(score.errors).toEqual([]);
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

  it("expands DR into canonical drum tracks and treats empty measures as rests", () => {
    const score = buildScoreAst(`time 4/4
divisions 8

DR | s - [2: t1 s t2] - - - - | |
HH | x - x - x - x - | |`);

    expect(score.errors).toEqual([]);
    expect(score.paragraphs[0].tracks.map((track) => track.track)).toEqual(["HH", "SD", "T1", "T2"]);
    expect(score.paragraphs[0].tracks[1].measures[0].tokens).toEqual([
      { kind: "basic", value: "d", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      {
        kind: "group",
        count: 3,
        span: 2,
        items: [
          { kind: "basic", value: "-", dots: 0, halves: 0 },
          { kind: "basic", value: "d", dots: 0, halves: 0 },
          { kind: "basic", value: "-", dots: 0, halves: 0 },
        ],
      },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
      { kind: "basic", value: "-", dots: 0, halves: 0 },
    ]);
    expect(score.paragraphs[0].tracks[1].measures[1].tokens).toHaveLength(8);
  });

  it("expands DR sugar line into multiple tracks with accents", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

DR | s T1 T2 T3 |`);

    expect(score.errors).toEqual([]);
    const sdTrack = score.paragraphs[0].tracks.find((t) => t.track === "SD");
    const t1Track = score.paragraphs[0].tracks.find((t) => t.track === "T1");
    const t2Track = score.paragraphs[0].tracks.find((t) => t.track === "T2");
    const t3Track = score.paragraphs[0].tracks.find((t) => t.track === "T3");

    expect(sdTrack?.measures[0].tokens[0]).toEqual({ kind: "basic", value: "d", dots: 0, halves: 0 });
    expect(t1Track?.measures[0].tokens[1]).toEqual({ kind: "basic", value: "D", dots: 0, halves: 0 });
    expect(t2Track?.measures[0].tokens[2]).toEqual({ kind: "basic", value: "D", dots: 0, halves: 0 });
    expect(t3Track?.measures[0].tokens[3]).toEqual({ kind: "basic", value: "D", dots: 0, halves: 0 });
  });

  it("reports grouping compatibility and DR mixing errors", () => {
    const score = buildScoreAst(`time 7/8
divisions 16
grouping 2+2+3

DR | s - - - |
SD | d - - - |`);

    expect(score.errors).toEqual([
      {
        line: 3,
        column: 1,
        message: "Grouping boundaries must fall on integer slot positions under the current divisions",
      },
      {
        line: 5,
        column: 1,
        message: "Track `DR` cannot be mixed with explicit `SD`, `T1`, `T2`, or `T3` lines in the same paragraph",
      },
    ]);
  });

  it("reports non-exportable group forms", () => {
    const score = buildScoreAst(`time 4/4
divisions 16

HH | [2: x x x x x] ${rests(14)} |
SD | [5: d] ${rests(11)} |`);

    expect(score.errors).toEqual([
      {
        line: 4,
        column: 1,
        message: "Unsupported compressed group ratio 5 in 2",
      },
      {
        line: 5,
        column: 1,
        message: "Stretched group items must map to a supported single note value without tie splitting",
      },
    ]);
  });

  it("rejects group item durations below 64th notes", () => {
    const score = buildScoreAst(`time 4/4
divisions 64

HH | [1: x x] ${rests(63)} |`);

    expect(score.errors).toEqual([
      {
        line: 4,
        column: 1,
        message: "Group item durations below 64th notes are not supported in v0",
      },
    ]);
  });
});
