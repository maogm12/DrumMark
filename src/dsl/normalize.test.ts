import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";

describe("buildNormalizedScore", () => {
  it("validates slot totals against divisions", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - x |`);

    expect(score.errors).toEqual([
      {
        line: 4,
        column: 1,
        message: "Track `HH` measure 1 has invalid duration: used 3 slots, expected 4",
      },
    ]);
  });

  it("reports notes crossing grouping boundaries", () => {
    const score = buildNormalizedScore(`time 4/4
grouping 2+2
divisions 4

HH | x x. x |`);

    expect(score.errors).toEqual([
      {
        line: 5,
        column: 1,
        message: "Token `x` crosses grouping boundary at 2 in track HH",
      },
      {
        line: 5,
        column: 1,
        message: "Track `HH` measure 1 has invalid duration: used 3.5 slots, expected 4",
      },
    ]);
  });

  it("allows dotted notes that fit within boundaries", () => {
    const score = buildNormalizedScore(`time 4/4
grouping 2+2
divisions 4

HH | x. -/ x x |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0].events[0].duration).toEqual({ numerator: 3, denominator: 8 }); // 1.5 * 1/4 = 3/8
  });

  it("normalizes events with measure-relative timing and tuplets", () => {
    const score = buildNormalizedScore(`time 4/4
grouping 4
divisions 4

HH | x [2: x o X] - |
SD | d - D - |
HF | - p:close - - |
ST | [2: R L R] - - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(1);
    expect(score.measures[0].events).toEqual([
      {
        track: "HH",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        kind: "hit",
        glyph: "x",
        modifier: undefined,
      },
      {
        track: "SD",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        kind: "hit",
        glyph: "d",
        modifier: undefined,
      },
      {
        track: "ST",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 6 },
        kind: "sticking",
        glyph: "R",
        modifier: undefined,
        tuplet: { actual: 3, normal: 2 },
      },
      {
        track: "ST",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 1, denominator: 6 },
        duration: { numerator: 1, denominator: 6 },
        kind: "sticking",
        glyph: "L",
        modifier: undefined,
        tuplet: { actual: 3, normal: 2 },
      },
      {
        track: "HH",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 1, denominator: 4 },
        duration: { numerator: 1, denominator: 6 },
        kind: "hit",
        glyph: "x",
        modifier: undefined,
        tuplet: { actual: 3, normal: 2 },
      },
      {
        track: "HF",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 1, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        kind: "pedal",
        glyph: "p",
        modifier: "close",
      },
      {
        track: "ST",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 1, denominator: 3 },
        duration: { numerator: 1, denominator: 6 },
        kind: "sticking",
        glyph: "R",
        modifier: undefined,
        tuplet: { actual: 3, normal: 2 },
      },
      {
        track: "HH",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 5, denominator: 12 },
        duration: { numerator: 1, denominator: 6 },
        kind: "hit",
        glyph: "x",
        modifier: "open",
        tuplet: { actual: 3, normal: 2 },
      },
      {
        track: "SD",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 1, denominator: 2 },
        duration: { numerator: 1, denominator: 4 },
        kind: "accent",
        glyph: "D",
        modifier: undefined,
      },
      {
        track: "HH",
        paragraphIndex: 0,
        measureIndex: 0,
        measureInParagraph: 0,
        start: { numerator: 7, denominator: 12 },
        duration: { numerator: 1, denominator: 6 },
        kind: "accent",
        glyph: "X",
        modifier: undefined,
        tuplet: { actual: 3, normal: 2 },
      },
    ]);
  });
});
