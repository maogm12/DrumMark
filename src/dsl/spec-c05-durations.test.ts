import { describe, expect, it } from "vitest";
import { calculateTokenWeightAsFraction, gcd } from "./logic";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";
import type { TokenGlyph } from "./types";

function basicToken(value: Extract<TokenGlyph, { kind: "basic" }>["value"], dots: number, halves: number): TokenGlyph {
  return {
    kind: "basic",
    value,
    dots,
    halves,
    modifiers: [],
  };
}

describe("spec C05 duration modifiers and rhythmic math", () => {
  it("parses repeated dots, repeated slashes, and mixed dot-slash suffixes into stable counts", () => {
    const skeleton = parseDocumentSkeleton(`time 4/4
divisions 4

HH | x... x//// x../ x./// |`);

    expect(skeleton.errors).toEqual([]);
    const tokens = skeleton.paragraphs[0]?.lines[0]?.measures[0]?.tokens;

    expect(tokens).toEqual([
      { kind: "basic", value: "x", dots: 3, halves: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "x", dots: 0, halves: 4, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "x", dots: 2, halves: 1, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "x", dots: 1, halves: 3, modifiers: [], trackOverride: undefined },
    ]);
  });

  it("computes exact reduced weights for repeated and mixed duration modifiers", () => {
    expect(calculateTokenWeightAsFraction(basicToken("x", 3, 0))).toEqual({ numerator: 15, denominator: 8 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 0, 4))).toEqual({ numerator: 1, denominator: 16 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 2, 1))).toEqual({ numerator: 7, denominator: 8 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 1, 3))).toEqual({ numerator: 3, denominator: 16 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 3, 2))).toEqual({ numerator: 15, denominator: 32 });
  });

  it("applies the same rhythmic math to rests as to hits", () => {
    expect(calculateTokenWeightAsFraction(basicToken("-", 2, 1))).toEqual(
      calculateTokenWeightAsFraction(basicToken("d", 2, 1)),
    );
    expect(calculateTokenWeightAsFraction(basicToken("-", 3, 2))).toEqual({ numerator: 15, denominator: 32 });
  });

  it("normalizes mixed rational durations with reduced starts and exact whole-measure summation", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 4

HH | x... x../ x./// x//// x |`);

    expect(score.errors).toEqual([]);
    const events = score.measures[0]?.events ?? [];

    expect(events.map((event) => ({
      start: event.start,
      duration: event.duration,
    }))).toEqual([
      {
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 15, denominator: 32 },
      },
      {
        start: { numerator: 15, denominator: 32 },
        duration: { numerator: 7, denominator: 32 },
      },
      {
        start: { numerator: 11, denominator: 16 },
        duration: { numerator: 3, denominator: 64 },
      },
      {
        start: { numerator: 47, denominator: 64 },
        duration: { numerator: 1, denominator: 64 },
      },
      {
        start: { numerator: 3, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
      },
    ]);

    for (const event of events) {
      expect(gcd(event.start.numerator, event.start.denominator)).toBe(1);
      expect(gcd(event.duration.numerator, event.duration.denominator)).toBe(1);
    }
  });
});
