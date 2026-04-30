import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";

describe("buildScoreAst", () => {
  it("auto-fills missing known tracks inside later paragraphs", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | x - x - |
SD | - d - d |

C | d - - - |`);

    expect(score.errors).toEqual([]);
    expect(score.paragraphs).toHaveLength(2);
    
    // Paragraph 1 should have HH and SD (explicit) and C (auto-filled because it appears later)
    expect(score.paragraphs[0].tracks.map(t => t.track)).toEqual(["HH", "SD", "C"]);
    expect(score.paragraphs[0].tracks[2].generated).toBe(true); // C is auto-filled here

    // Paragraph 2 should have C (explicit) and HH, SD (auto-filled)
    expect(score.paragraphs[1].tracks.map(t => t.track)).toEqual(["HH", "SD", "C"]);
    expect(score.paragraphs[1].tracks[0].generated).toBe(true); // HH is auto-filled
  });

  it("reports paragraph measure-count mismatches", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | x - x - |
SD | d - d - | d - d - |`);

    expect(score.errors).toEqual([
      {
        line: 4,
        column: 1,
        message: "All track lines in a paragraph must have the same measure count",
      },
    ]);
  });

  it("discovers tracks from anonymous lines and summoning scopes", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| x - s - |
| RC{d d} SD:d |`);

    expect(score.errors).toEqual([]);
    // Discoveries: HH (from x), SD (from s and SD:d), RC (from RC{})
    // Note: globalTracks order depends on discovery order.
    // collection in collectTracksInLine: x->HH, s->SD, RC{}, SD:d->SD
    expect(new Set(score.paragraphs[0].tracks.map(t => t.track))).toContain("HH");
    expect(new Set(score.paragraphs[0].tracks.map(t => t.track))).toContain("SD");
    expect(new Set(score.paragraphs[0].tracks.map(t => t.track))).toContain("RC");
  });

  it("preserves global first-appearance order for named tracks", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| RC{d - - -} b2 - - - |

HH | x - - - |`);

    expect(score.errors).toEqual([]);
    expect(score.paragraphs[0].tracks.map((track) => track.track)).toEqual(["ANONYMOUS", "RC", "BD2", "HH"]);
    expect(score.paragraphs[1].tracks.map((track) => track.track)).toEqual(["RC", "BD2", "HH"]);
    expect(score.paragraphs[1].tracks[0].generated).toBe(true);
    expect(score.paragraphs[1].tracks[1].generated).toBe(true);
    expect(score.paragraphs[1].tracks[2].generated).toBe(false);
  });

  it("builds repeat spans", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH |: x x x x :|`);

    expect(score.repeatSpans).toEqual([
      { startBar: 0, endBar: 0, times: 2 },
    ]);
  });

  it("carries structured measure metadata for downstream consumers", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

|: x x x x :| @segno % |1. x - - - | @to-coda --2-- |.`);

    expect(score.errors).toEqual([]);
    const measures = score.paragraphs[0].tracks[0].measures;
    expect(measures[0]).toMatchObject({
      barline: "repeat-both",
    });
    expect(measures[1]).toMatchObject({
      marker: "segno",
      measureRepeat: { slashes: 1 },
    });
    expect(measures[2]).toMatchObject({
      volta: { indices: [1] },
    });
    expect(measures[3]).toMatchObject({
      jump: "to-coda",
      multiRest: { count: 2 },
      voltaTerminator: true,
    });
  });

  it("reports non-exportable group forms", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | [2: x x x x x] |`); // 5 in 2 is not supported

    expect(score.errors).toContainEqual(expect.objectContaining({
      message: "Unsupported compressed group ratio 5 in 2",
    }));
  });

  it("rejects group item durations below 64th notes", () => {
    const score = buildScoreAst(`time 4/4
divisions 16

HH | [1: x x x x x x x x x] |`); // 9 items in 1 slot = too small

    expect(score.errors).toContainEqual(expect.objectContaining({
      message: "Group item durations below 64th notes are not supported in v0",
    }));
  });

  it("accepts chained measure-repeat shorthand", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| d d d d | % | %% |`);

    expect(score.errors).toEqual([]);
  });

  it("rejects conflicting navigation declarations on the same bar", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

HH | @segno d - - - |
SD | @coda d - - - |`);

    expect(score.errors).toContainEqual(expect.objectContaining({
      message: "Conflicting markers at bar 1",
    }));
  });
});
