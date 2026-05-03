import { describe, expect, it } from "vitest";
import { calculateTokenWeightAsFraction, gcd } from "./logic";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";
import type { TokenGlyph } from "./types";

function basicToken(value: Extract<TokenGlyph, { kind: "basic" }>["value"], dots: number, halves: number, stars: number = 0): TokenGlyph {
  return {
    kind: "basic",
    value,
    dots,
    halves,
    stars,
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
      { kind: "basic", value: "x", dots: 3, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "x", dots: 0, halves: 4, stars: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "x", dots: 2, halves: 1, stars: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "x", dots: 1, halves: 3, stars: 0, modifiers: [], trackOverride: undefined },
    ]);
  });

  it("computes exact reduced weights for repeated and mixed duration modifiers", () => {
    expect(calculateTokenWeightAsFraction(basicToken("x", 3, 0))).toEqual({ numerator: 15, denominator: 8 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 0, 4))).toEqual({ numerator: 1, denominator: 16 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 2, 1))).toEqual({ numerator: 7, denominator: 8 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 1, 3))).toEqual({ numerator: 3, denominator: 16 });
    expect(calculateTokenWeightAsFraction(basicToken("x", 3, 2))).toEqual({ numerator: 15, denominator: 32 });
  });

  it("computes exact weights for star (doubling) modifier", () => {
    // d* = 2 slots, d** = 4 slots, d*** = 8 slots (weight relative to base slot)
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 0, 1))).toEqual({ numerator: 2, denominator: 1 });
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 0, 2))).toEqual({ numerator: 4, denominator: 1 });
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 0, 3))).toEqual({ numerator: 8, denominator: 1 });
    expect(calculateTokenWeightAsFraction(basicToken("-", 0, 0, 1))).toEqual({ numerator: 2, denominator: 1 });
  });

  it("combines dots and stars commutatively", () => {
    // d.* = 3 slots, d*. = 3 slots, order independent
    expect(calculateTokenWeightAsFraction(basicToken("d", 1, 0, 1))).toEqual({ numerator: 3, denominator: 1 });
  });

  it("normalizes measure with star modifier as doubling", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x* x x |`);

    expect(score.errors).toEqual([]);
    const events = score.measures[0]?.events ?? [];
    // x* takes 2 slots, x takes 1, x takes 1 → total 4 slots (valid)
    expect(events.map((e) => ({ track: e.track, start: e.start, duration: e.duration }))).toEqual([
      { track: "HH", start: { numerator: 0, denominator: 1 }, duration: { numerator: 1, denominator: 2 } },
      { track: "HH", start: { numerator: 1, denominator: 2 }, duration: { numerator: 1, denominator: 4 } },
      { track: "HH", start: { numerator: 3, denominator: 4 }, duration: { numerator: 1, denominator: 4 } },
    ]);
  });

  it("parses d*3 as doubled note + inline repeat ×3 (star is consumed by inline repeat)", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| d*3 |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(3);
    // Each measure has a single d token with no stars (the *3 is inline repeat)
    for (const measure of doc.paragraphs[0].lines[0].measures) {
      expect(measure.tokens).toEqual([
        { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      ]);
    }
  });

  it("parses - *3 as rest with inline repeat (no star on rest token)", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| -*3 |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(3);
    for (const measure of doc.paragraphs[0].lines[0].measures) {
      expect(measure.tokens).toEqual([
        { kind: "basic", value: "-", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      ]);
    }
  });

  it("parses d .* 3 as dotted note + inline repeat ×3 (star consumed by inline repeat)", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| d.*3 |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(3);
    // d.*3: d. has dots=1 (star consumed by inline repeat *3)
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "d", dots: 1, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
    ]);
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
