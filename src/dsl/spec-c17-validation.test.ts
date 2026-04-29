import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";

describe("spec C17 measure validation", () => {
  it("reports fractional total-duration mismatches that cannot be repaired by integer rest autofill", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 4

HH | x. x/ x/ x |`);

    expect(score.errors).toContainEqual({
      line: 5,
      column: 1,
      message: "Track `HH` measure 1 has invalid duration: used 7/2 slots, expected 4",
    });
  });

  it("reports a stable hard error when a token overlaps a grouping boundary", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 2+2

HH | x x. x/ |`);

    expect(score.errors).toContainEqual({
      line: 5,
      column: 1,
      message: "Token `x` crosses grouping boundary at 2 in track HH",
    });
  });

  it("rejects otherwise-valid groups that cross a grouping boundary", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 2+2

HH | [3: d d d] x |`);

    expect(score.errors).toContainEqual({
      line: 5,
      column: 1,
      message: "Token `group` crosses grouping boundary at 2 in track HH",
    });
  });
});
