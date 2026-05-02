import { describe, it, expect } from "vitest";
import { buildNormalizedScore } from "./normalize";

describe("note 1/N grid resolution", () => {
  it("should use global note header", () => {
    const source = `
time 4/4
note 1/8
HH | d d d d d d d d |
`;
    const score = buildNormalizedScore(source);
    expect(score.errors).toHaveLength(0);
    expect(score.header.noteValue).toBe(8);
    expect(score.measures[0]!.events).toHaveLength(8);
    // 4/4 with 1/8 note grid should have 8 slots.
  });

  it("should support paragraph-level overrides", () => {
    const source = `
time 4/4
note 1/16

HH | d d d d d d d d d d d d d d d d |

note 1/8
SD | d d d d d d d d |
`;
    const score = buildNormalizedScore(source);
    expect(score.errors).toHaveLength(0);
    expect(score.measures[0]!.noteValue).toBe(16);
    expect(score.measures[1]!.noteValue).toBe(8);
    expect(score.measures[0]!.events).toHaveLength(16);
    expect(score.measures[1]!.events).toHaveLength(8);
  });

  it("should calculate correct slots for non-4/4 time signatures", () => {
    const source = `
time 6/8
note 1/16
HH | d d d d d d d d d d d d |
`;
    const score = buildNormalizedScore(source);
    expect(score.errors).toHaveLength(0);
    // 6/8 is 3/4 duration. 3/4 / (1/16) = 12 slots.
    expect(score.measures[0]!.events).toHaveLength(12);
  });

  it("should reject non-power-of-2 note values", () => {
    const source = `
time 4/4
note 1/3
HH | d d d |
`;
    const score = buildNormalizedScore(source);
    expect(score.errors.some(e => e.message.includes("power of 2"))).toBe(true);
  });

  it("should error if note resolution is incompatible with time signature (non-integer slots)", () => {
    const source = `
time 3/4
note 1/1
HH | d |
`;
    // 3/4 / 1/1 = 0.75 slots. Error.
    const score = buildNormalizedScore(source);
    expect(score.errors.some(e => e.message.includes("not compatible"))).toBe(true);
  });

  it("should handle deprecated divisions header", () => {
    const source = `
time 4/4
divisions 16
HH | d d d d d d d d d d d d d d d d |
`;
    const score = buildNormalizedScore(source);
    expect(score.errors).toHaveLength(0);
    expect(score.header.noteValue).toBe(16);
  });
});
