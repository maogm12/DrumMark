import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C15: multi-measure rest", () => {
  it("parses compact, spaced, and asymmetric multi-rest forms when the count is at least 2", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | --2-- | -- 4 -- | ---2-- |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(3);
    expect(doc.paragraphs[0].lines[0].measures[0]).toMatchObject({
      content: "--2--",
      tokens: [],
      multiRestCount: 2,
    });
    expect(doc.paragraphs[0].lines[0].measures[1]).toMatchObject({
      content: "-- 4 --",
      tokens: [],
      multiRestCount: 4,
    });
    expect(doc.paragraphs[0].lines[0].measures[2]).toMatchObject({
      content: "---2--",
      tokens: [],
      multiRestCount: 2,
    });
  });

  it("treats non-matching numeric forms as non-multi-rest input", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | --1-- |`);

    expect(doc.errors.length).toBeGreaterThan(0);
    expect(doc.paragraphs[0].lines[0].measures[0]?.multiRestCount).toBeUndefined();
  });

  it("treats malformed forms as ordinary measure content instead of multi-rest intent", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | --x-- |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0]).toMatchObject({
      content: "--x--",
      multiRestCount: undefined,
    });
    expect(doc.paragraphs[0].lines[0].measures[0].tokens.map((token) => token.kind === "basic" ? token.value : token.kind)).toEqual([
      "-",
      "-",
      "x",
      "-",
      "-",
    ]);
  });

  it("preserves canonical multi-rest intent in AST measures without auto-filled rest tokens", () => {
    const ast = buildScoreAst(`time 4/4
divisions 4

| --8-- |`);

    expect(ast.errors).toEqual([]);
    const measure = ast.paragraphs[0].tracks[0].measures[0];
    expect(measure).toMatchObject({
      generated: false,
      barline: "regular",
      multiRest: { count: 8 },
    });
    expect(measure.tokens).toEqual([]);
  });

  it("preserves canonical multi-rest intent in normalized measures even from a non-leading track", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | |
SD | --4-- |`);

    expect(score.errors).toEqual([]);
    expect(score.measures).toHaveLength(1);
    expect(score.measures[0]).toMatchObject({
      generated: false,
      barline: "final",
      multiRest: { count: 4 },
      multiRestCount: 4,
      events: [],
    });
  });
});
