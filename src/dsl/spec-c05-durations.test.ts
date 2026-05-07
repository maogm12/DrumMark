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
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 0, 4))).toEqual({ numerator: 16, denominator: 1 });
    expect(calculateTokenWeightAsFraction(basicToken("-", 0, 0, 1))).toEqual({ numerator: 2, denominator: 1 });
  });

  it("preserves large star-slash cancellation exactly", () => {
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 60, 60))).toEqual({ numerator: 1, denominator: 1 });
  });

  it("preserves exact power-of-two weights beyond 52-bit safe integers", () => {
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 0, 60))).toEqual({
      numerator: Math.pow(2, 60),
      denominator: 1,
    });
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

  it("allows more than three stars when the resulting measure weight is still valid", () => {
    const score = buildNormalizedScore(`time 4/4
note 1/16
grouping 4

HH | x**** |`);

    expect(score.errors).toEqual([]);
    const events = score.measures[0]?.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      track: "HH",
      start: { numerator: 0, denominator: 1 },
      duration: { numerator: 1, denominator: 1 },
    });
  });

  it("does not hang on truly overflowing star runs and reports an explicit overflow diagnostic", () => {
    const score = buildNormalizedScore(`time 4/4
note 1/16
grouping 4

HH | x${"*".repeat(1100)} |`);

    expect(
      score.errors.some((error) =>
        error.message.includes("exceeds the exact duration range under current modifier counts"),
      ),
    ).toBe(true);
    expect(score.measures[0]?.events ?? []).toEqual([]);
  });

  it("pins the binary exponent boundary at 1023/1024", () => {
    expect(calculateTokenWeightAsFraction(basicToken("d", 0, 0, 1023))).toEqual({
      numerator: Math.pow(2, 1023),
      denominator: 1,
    });

    const score = buildNormalizedScore(`time 4/4
note 1/16
grouping 4

HH | x${"*".repeat(1024)} |`);

    expect(
      score.errors.some((error) =>
        error.message.includes("exceeds the exact duration range under current modifier counts"),
      ),
    ).toBe(true);
  });

  it("reports overflow for combined dot-plus-star exponents that exceed exact range", () => {
    const combined = `${".".repeat(52)}${"*".repeat(972)}`;
    const score = buildNormalizedScore(`time 4/4
note 1/16
grouping 4

HH | x${combined} |`);

    expect(
      score.errors.some((error) =>
        error.message.includes("exceeds the exact duration range under current modifier counts"),
      ),
    ).toBe(true);
    expect(score.measures[0]?.events ?? []).toEqual([]);
  });

  it("keeps large star-slash cancellation valid on the authoritative normalization path", () => {
    const balanced = `${"*".repeat(60)}${"/".repeat(60)}`;
    const rests = Array.from({ length: 15 }, () => "-").join(" ");
    const score = buildNormalizedScore(`time 4/4
note 1/16
grouping 4

HH | x${balanced} ${rests} |`);

    expect(score.errors).toEqual([]);
    const events = score.measures[0]?.events ?? [];
    expect(events[0]).toMatchObject({
      track: "HH",
      start: { numerator: 0, denominator: 1 },
      duration: { numerator: 1, denominator: 16 },
    });
  });

  it("drops the whole overflowing measure contribution instead of emitting misaligned later events", () => {
    const score = buildNormalizedScore(`time 4/4
note 1/16
grouping 4

HH | x${"*".repeat(1100)} x x x |`);

    expect(
      score.errors.some((error) =>
        error.message.includes("exceeds the exact duration range under current modifier counts"),
      ),
    ).toBe(true);
    expect(score.measures[0]?.events ?? []).toEqual([]);
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
