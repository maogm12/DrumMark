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
      { kind: "basic", value: "x", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "-", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "s", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      { kind: "basic", value: "-", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
    ]);
  });

  it("parses braced scopes and track summoning", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| @HH{x x} SD:d @RC{d d:bell} |`);

    expect(doc.errors).toEqual([]);
    const tokens = doc.paragraphs[0].lines[0].measures[0].tokens;
    
    // @HH{x x}
    expect(tokens[0]).toEqual({
      kind: "braced",
      track: "HH",
      items: [
        { kind: "basic", value: "x", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "x", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      ]
    });

    // SD:d
    expect(tokens[1]).toEqual({
      kind: "basic",
      value: "d",
      dots: 0,
      halves: 0,
      stars: 0,
      modifiers: [],
      trackOverride: "SD"
    });

    // @RC{d d:bell}
    expect(tokens[2]).toEqual({
      kind: "braced",
      track: "RC",
      items: [
        { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: ["bell"], trackOverride: undefined },
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
      stars: 0,
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
        { kind: "basic", value: "x", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "s", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
      ]
    });

    expect(tokens[1]).toEqual({
      kind: "combined",
      items: [
        { kind: "basic", value: "b", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
        { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: ["rim"], trackOverride: "SD" },
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

  it("parses the expanded track registry and multi-character summon tokens", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

BD2 | b2 - - - |
T4  | t4 - - - |
RC2 | r2 - - - |
C2  | c2 - - - |
SPL | spl - - - |
CHN | chn - - - |
CB  | cb - - - |
WB  | wb - - - |
CL  | cl - - - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual([
      "BD2",
      "T4",
      "RC2",
      "C2",
      "SPL",
      "CHN",
      "CB",
      "WB",
      "CL",
    ]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens[0]).toMatchObject({ kind: "basic", value: "b2" });
    expect(doc.paragraphs[0].lines[4].measures[0].tokens[0]).toMatchObject({ kind: "basic", value: "spl" });
  });

  it("parses newly supported modifiers including hyphenated names", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| d:half-open d:roll d:dead d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].tokens).toEqual([
      { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: ["half-open"], trackOverride: undefined },
      { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: ["roll"], trackOverride: undefined },
      { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: ["dead"], trackOverride: undefined },
      { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
    ]);
  });

  it("rejects the removed DR track", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
DR | d - d - |`);

    expect(doc.errors).toContainEqual({
      line: 3,
      column: 1,
      message: "Unknown track `DR`",
    });
  });

  it("treats % and %% as standalone measure-repeat measures", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| d d d d | % | %% |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[1]).toMatchObject({
      tokens: [],
      measureRepeatSlashes: 1,
    });
    expect(doc.paragraphs[0].lines[0].measures[2]).toMatchObject({
      tokens: [],
      measureRepeatSlashes: 2,
    });
  });

  it("parses multi-rest measures with N >= 2", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
HH | --2-- | -- 4 -- | ---2-- |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0].multiRestCount).toBe(2);
    expect(doc.paragraphs[0].lines[0].measures[1].multiRestCount).toBe(4);
    expect(doc.paragraphs[0].lines[0].measures[2].multiRestCount).toBe(2);
  });

  it("treats *N as total run length, including *1", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| d - - - *1 | d - - - *3 |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures).toHaveLength(4);
    expect(doc.paragraphs[0].lines[0].measures[0].content).toBe("d - - -");
    expect(doc.paragraphs[0].lines[0].measures[1].content).toBe("d - - -");
    expect(doc.paragraphs[0].lines[0].measures[2].content).toBe("d - - -");
    expect(doc.paragraphs[0].lines[0].measures[3].content).toBe("d - - -");
  });

  it("extracts navigation markers and jumps as measure metadata", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| @segno d - - - |
| d - - - @ds-al-coda |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0]).toMatchObject({
      startNav: { kind: "segno", anchor: "left-edge" },
      endNav: undefined,
    });
    expect(doc.paragraphs[0].lines[1].measures[0]).toMatchObject({
      startNav: undefined,
      endNav: { kind: "ds-al-coda", anchor: "right-edge" },
    });
    expect(doc.paragraphs[0].lines[0].measures[0].tokens[0]).toMatchObject({ kind: "basic", value: "d" });
  });

  it("allows navigation metadata on shorthand measures", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
| @fine |
| @to-coda |
| @dc |
| @ds |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0].lines[0].measures[0]).toMatchObject({
      endNav: { kind: "fine", anchor: "right-edge" },
    });
    expect(doc.paragraphs[0].lines[1].measures[0]).toMatchObject({
      endNav: { kind: "to-coda", anchor: "right-edge" },
    });
    expect(doc.paragraphs[0].lines[2].measures[0]).toMatchObject({
      endNav: { kind: "dc", anchor: "right-edge" },
    });
    expect(doc.paragraphs[0].lines[3].measures[0]).toMatchObject({
      endNav: { kind: "ds", anchor: "right-edge" },
    });
  });

  it("permits optional spaces in the grouping header", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4
grouping 1 + 1 + 1 + 1

| d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.grouping.values).toEqual([1, 1, 1, 1]);
  });

  it("permits optional spaces in the time header", () => {
    const doc = parseDocumentSkeleton(`time 4 / 4
divisions 4

| d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.time).toMatchObject({ beats: 4, beatUnit: 4 });
  });

  it("parses the 'note 1/N' header and paragraph overrides", () => {
    const doc = parseDocumentSkeleton(`time 4/4
note 1/8

HH | x - x - |

note 1/16
HH | x - x - x - x - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.note?.value).toBe(8);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0].noteValue).toBeUndefined(); // Uses global
    expect(doc.paragraphs[1].noteValue).toBe(16); // Overridden
  });
});
