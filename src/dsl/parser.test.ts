import { describe, expect, it } from "vitest";
import { parseDocumentSkeleton } from "./parser";

describe("parseDocumentSkeleton", () => {
  it("parses headers and paragraphs including anonymous lines", () => {
    const doc = parseDocumentSkeleton(`tempo 96
time 4/4
divisions 16

| x - s - |
SD | d - d - |
| b - - - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs).toHaveLength(1);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["ANONYMOUS", "SD", "ANONYMOUS"]);
    
    // Check anonymous line tokens
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "x", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "-", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "s", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "-", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
    ]);
  });

  it("parses braced scopes and track summoning", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| HH{x x} SD:d RC{d d:bell} |`);

    expect(doc.errors).toEqual([]);
    const tokens = doc.paragraphs[0].lines[0].measures[0].tokens;
    
    // HH{x x}
    expect(tokens[0]).toEqual({
      kind: "braced",
      track: "HH",
      items: [
        { kind: "basic", value: "x", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "x", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
      ]
    });

    // SD:d
    expect(tokens[1]).toEqual({
      kind: "basic",
      value: "d",
      dots: 0,
      halves: 0,
      modifiers: [],
      trackOverride: "SD"
    });

    // RC:{d d:bell}
    expect(tokens[2]).toEqual({
      kind: "braced",
      track: "RC",
      items: [
        { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: ["bell"], trackOverride: undefined },
      ]
    });
  });

  it("parses multiple modifiers in a chain", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| s:rim:ghost:flam |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens[0]).toEqual({
      kind: "basic",
      value: "s",
      dots: 0,
      halves: 0,
      modifiers: ["rim", "ghost", "flam"],
      trackOverride: undefined
    });
  });

  it("parses combined hits with summoning", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| x+s b+SD:d:rim |`);

    expect(doc.errors).toEqual([]);
    const tokens = doc.paragraphs[0].lines[0].measures[0].tokens;
    
    expect(tokens[0]).toEqual({
      kind: "combined",
      items: [
        { kind: "basic", value: "x", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "s", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
      ]
    });

    expect(tokens[1]).toEqual({
      kind: "combined",
      items: [
        { kind: "basic", value: "b", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: ["rim"], trackOverride: "SD" },
      ]
    });
  });

  it("parses repeat boundaries from anonymous lines", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
|: x s :|`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].repeatStart).toBe(true);
    expect(doc.paragraphs[0].lines[0].measures[0].repeatEnd).toBe(true);
  });

  it("reports unterminated braced scopes", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| HH{ x x |`);

    expect(doc.errors).toContainEqual({
      line: 3,
      column: 6,
      message: "Unterminated braced scope"
    });
  });

  it("parses whitespace-equivalent measure syntax", () => {
    const spaced = parseDocumentSkeleton(`time 4/4\ndivisions 4\n\n| x - x - |`);
    const compact = parseDocumentSkeleton(`time 4/4\ndivisions 4\n\n|x-x-|`);

    expect(spaced.errors).toEqual([]);
    expect(compact.errors).toEqual([]);
    expect(compact.paragraphs[0].lines[0].measures[0].tokens).toEqual(
      spaced.paragraphs[0].lines[0].measures[0].tokens,
    );
  });
});
