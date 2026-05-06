import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

describe("spec C19 hard errors", () => {
  it("reports stable parser errors for unknown headers, tracks, and modifiers", () => {
    const unknownHeader = parseDocumentSkeleton(`swing 8ths
time 4/4
divisions 4

HH | x - x - |`);

    expect(unknownHeader.errors).toContainEqual({
      line: 1,
      column: 1,
      message: "Unknown header `swing`",
    });

    const unknownTrack = parseDocumentSkeleton(`time 4/4
divisions 4

XX | d - - - |`);

    expect(unknownTrack.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Unknown track `XX`",
    });

    const unknownModifier = parseDocumentSkeleton(`time 4/4
divisions 4

HH | d:sizzle - - - |`);

    expect(unknownModifier.errors).toContainEqual({
      line: 4,
      column: 8,
      message: "Unknown modifier `sizzle`",
    });
  });

  it("reports malformed groups with stable source locations", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | [x x - - |`);

    expect(doc.errors).toContainEqual({
      line: 4,
      column: 7,
      message: "Unterminated group",
    });
  });

  it("reports invalid non-matching numeric multi-rest text and non-positive inline repeat counts", () => {
    const multiRest = parseDocumentSkeleton(`time 4/4
divisions 4

HH | --1-- |`);

    expect(multiRest.errors.length).toBeGreaterThan(0);

    const inlineRepeat = parseDocumentSkeleton(`time 4/4
divisions 4

HH | d - - - *0 |`);

    expect(inlineRepeat.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Repeat count must be at least 1",
    });
  });

  it("reports paragraph and repeat-structure hard errors in the AST layer", () => {
    const paragraphMismatch = buildScoreAst(`time 4/4
divisions 4

HH | x - x - |
SD | d - d - | d - d - |`);

    expect(paragraphMismatch.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "All track lines in a paragraph must have the same measure count",
    });

    const repeatMismatch = buildScoreAst(`time 4/4
divisions 4

HH | x x x x :|`);

    expect(repeatMismatch.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Repeat end at bar 1 has no matching start",
    });
  });

  it("reports measure slot mismatches in the normalized score", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x. x x |`);

    expect(score.errors).toContainEqual({
      line: 4,
      column: 1,
      message: "Track `HH` measure 1 has invalid duration: used 7/2 slots, expected 4",
    });
  });
});
