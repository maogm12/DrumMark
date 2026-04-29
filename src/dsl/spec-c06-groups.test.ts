import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C06 groups", () => {
  it("parses shorthand groups and explicit span groups into stable group tokens", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | [ d x ] [3: d p g] |`);

    expect(doc.errors).toEqual([]);
    const tokens = doc.paragraphs[0]?.lines[0]?.measures[0]?.tokens;

    expect(tokens).toEqual([
      {
        kind: "group",
        span: 1,
        count: 2,
        items: [
          { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
          { kind: "basic", value: "x", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        ],
      },
      {
        kind: "group",
        span: 3,
        count: 3,
        items: [
          { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
          { kind: "basic", value: "p", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
          { kind: "basic", value: "g", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        ],
      },
    ]);
  });

  it("keeps stretched dotted-note groups exportable without inventing tuplet metadata", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 4

HH | [3: d d] - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.events.map((event) => ({
      start: event.start,
      duration: event.duration,
      tuplet: event.tuplet ?? null,
    }))).toEqual([
      {
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 3, denominator: 8 },
        tuplet: null,
      },
      {
        start: { numerator: 3, denominator: 8 },
        duration: { numerator: 3, denominator: 8 },
        tuplet: null,
      },
    ]);
  });

  it("normalizes compressed subdivision ratios like 4 in 2 without tuplet metadata", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 4

HH | [2: d d d d] - - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.events.map((event) => ({
      start: event.start,
      duration: event.duration,
      tuplet: event.tuplet ?? null,
    }))).toEqual([
      {
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 8 },
        tuplet: null,
      },
      {
        start: { numerator: 1, denominator: 8 },
        duration: { numerator: 1, denominator: 8 },
        tuplet: null,
      },
      {
        start: { numerator: 1, denominator: 4 },
        duration: { numerator: 1, denominator: 8 },
        tuplet: null,
      },
      {
        start: { numerator: 3, denominator: 8 },
        duration: { numerator: 1, denominator: 8 },
        tuplet: null,
      },
    ]);
  });

  it("marks tuplet-compatible compressed groups with shared actual:normal metadata", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 4

HH | [2: d d d] - - |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0]?.events.map((event) => ({
      start: event.start,
      duration: event.duration,
      tuplet: event.tuplet ?? null,
    }))).toEqual([
      {
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 6 },
        tuplet: { actual: 3, normal: 2 },
      },
      {
        start: { numerator: 1, denominator: 6 },
        duration: { numerator: 1, denominator: 6 },
        tuplet: { actual: 3, normal: 2 },
      },
      {
        start: { numerator: 1, denominator: 3 },
        duration: { numerator: 1, denominator: 6 },
        tuplet: { actual: 3, normal: 2 },
      },
    ]);
  });

  it("rejects stretched groups that would require tie splitting", () => {
    const ast = buildScoreAst(`time 4/4
divisions 4

HH | [5: d d] |`);

    expect(ast.errors).toContainEqual(expect.objectContaining({
      message: "Stretched group items must map to a supported single note value without tie splitting",
    }));
  });

  it("rejects zero-span, empty explicit-span, and nested groups as hard parser errors", () => {
    const zeroSpan = parseDocumentSkeleton(`time 4/4
divisions 4

HH | [0: d] |`);
    const emptyExplicit = parseDocumentSkeleton(`time 4/4
divisions 4

HH | [2:] |`);
    const nested = parseDocumentSkeleton(`time 4/4
divisions 4

HH | [1: [ d d ]] |`);

    expect(zeroSpan.errors).toContainEqual(expect.objectContaining({
      message: "Group span must be at least 1",
    }));
    expect(emptyExplicit.errors).toContainEqual(expect.objectContaining({
      message: "Empty group",
    }));
    expect(nested.errors).toContainEqual(expect.objectContaining({
      message: "Nested groups are not allowed",
    }));
  });
});
