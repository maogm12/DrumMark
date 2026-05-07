import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";

describe("spec-c22 hairpins", () => {
  it("normalizes a simple explicit-end crescendo into measure hairpins", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | d < d d ! |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.hairpins).toEqual([
      {
        type: "crescendo",
        start: { numerator: 1, denominator: 4 },
        startMeasureIndex: 0,
        end: { numerator: 3, denominator: 4 },
        endMeasureIndex: 0,
      },
    ]);
  });

  it("keeps an unterminated hairpin as one logical cross-measure span", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | < d d d d | d d d d |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.hairpins).toEqual([
      {
        type: "crescendo",
        start: { numerator: 0, denominator: 1 },
        startMeasureIndex: 0,
        end: { numerator: 4, denominator: 4 },
        endMeasureIndex: 1,
      },
    ]);
    expect(score.measures[1]?.hairpins).toBeUndefined();
  });

  it("extracts hairpins from rhythmic groups using absolute measure positions", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

SD | [2: < d d d !] d d |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.hairpins).toEqual([
      {
        type: "crescendo",
        start: { numerator: 0, denominator: 1 },
        startMeasureIndex: 0,
        end: { numerator: 1, denominator: 2 },
        endMeasureIndex: 0,
      },
    ]);
  });

  it("allows a carry-forward hairpin to close at the start of a later paragraph", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | < d d d d |

| ! d d d d |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.hairpins).toEqual([
      {
        type: "crescendo",
        start: { numerator: 0, denominator: 1 },
        startMeasureIndex: 0,
        end: { numerator: 0, denominator: 1 },
        endMeasureIndex: 1,
      },
    ]);
  });

  it("rejects hairpin-only rhythmic groups", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

SD | [2: < !] d d |`);

    expect(score.errors).toContainEqual(
      expect.objectContaining({
        message: "Group must contain at least one duration-consuming item",
      }),
    );
  });
});
