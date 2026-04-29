import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

function normalizeSingleToken(line: string, token: string) {
  const trackLine = line === "|" ? `| ${token} |` : `${line} | ${token} |`;
  const score = buildNormalizedScore(`time 1/4
divisions 1
grouping 1

${trackLine}`);

  expect(score.errors).toEqual([]);
  expect(score.measures).toHaveLength(1);
  expect(score.measures[0]?.events).toHaveLength(1);
  return score.measures[0]!.events[0]!;
}

describe("spec C03 atomic tokens", () => {
  it("parses the Appendix A token table literals plus uppercase local variants", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 16

HH | d D x X s S b B b2 B2 r R r2 R2 |
HH | c C c2 C2 t1 t2 t3 t4 o O spl SPL |
HH | chn CHN cb CB wb WB cl CL p P g G - |
ST | R L |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs[0]?.lines[0]?.measures[0]?.tokens.map((token) => token.kind === "basic" ? token.value : token.kind)).toEqual([
      "d",
      "D",
      "x",
      "X",
      "s",
      "S",
      "b",
      "B",
      "b2",
      "B2",
      "r",
      "R",
      "r2",
      "R2",
    ]);
    expect(doc.paragraphs[0]?.lines[1]?.measures[0]?.tokens.map((token) => token.kind === "basic" ? token.value : token.kind)).toEqual([
      "c",
      "C",
      "c2",
      "C2",
      "t1",
      "t2",
      "t3",
      "t4",
      "o",
      "O",
      "spl",
      "SPL",
    ]);
    expect(doc.paragraphs[0]?.lines[2]?.measures[0]?.tokens.map((token) => token.kind === "basic" ? token.value : token.kind)).toEqual([
      "chn",
      "CHN",
      "cb",
      "CB",
      "wb",
      "WB",
      "cl",
      "CL",
      "p",
      "P",
      "g",
      "G",
      "-",
    ]);
    expect(doc.paragraphs[0]?.lines[3]?.measures[0]?.tokens.map((token) => token.kind === "basic" ? token.value : token.kind)).toEqual([
      "R",
      "L",
    ]);
  });

  it.each([
    ["HH", "d", { track: "HH", kind: "hit", glyph: "x", modifiers: [] }],
    ["HH", "D", { track: "HH", kind: "hit", glyph: "x", modifiers: ["accent"] }],
    ["SD", "d", { track: "SD", kind: "hit", glyph: "d", modifiers: [] }],
    ["SD", "D", { track: "SD", kind: "hit", glyph: "d", modifiers: ["accent"] }],
    ["|", "d", { track: "HH", kind: "hit", glyph: "x", modifiers: [] }],
    ["|", "D", { track: "HH", kind: "hit", glyph: "x", modifiers: ["accent"] }],
  ])("normalizes %s token %s with the correct local/default hit semantics", (line, token, expected) => {
    const event = normalizeSingleToken(line, token);

    expect(event.track).toBe(expected.track);
    expect(event.kind).toBe(expected.kind);
    expect(event.glyph).toBe(expected.glyph);
    expect(event.modifiers).toEqual(expected.modifiers);
  });

  it.each([
    ["HH", "x", { track: "HH", glyph: "x", modifiers: [] }],
    ["HH", "X", { track: "HH", glyph: "x", modifiers: ["accent"] }],
    ["SD", "x", { track: "SD", glyph: "d", modifiers: ["cross"] }],
    ["SD", "X", { track: "SD", glyph: "d", modifiers: ["accent", "cross"] }],
    ["|", "x", { track: "HH", glyph: "x", modifiers: [] }],
    ["|", "X", { track: "HH", glyph: "x", modifiers: ["accent"] }],
  ])("normalizes %s token %s with context-sensitive x semantics", (line, token, expected) => {
    const event = normalizeSingleToken(line, token);

    expect(event.track).toBe(expected.track);
    expect(event.glyph).toBe(expected.glyph);
    expect(event.modifiers).toEqual(expected.modifiers);
  });

  it.each([
    ["HH", "p", { track: "HH", glyph: "x", modifiers: [] }],
    ["HH", "P", { track: "HH", glyph: "x", modifiers: ["accent"] }],
    ["SD", "p", { track: "SD", glyph: "d", modifiers: [] }],
    ["SD", "P", { track: "SD", glyph: "d", modifiers: ["accent"] }],
    ["|", "p", { track: "HF", glyph: "d", modifiers: [] }],
    ["|", "P", { track: "HF", glyph: "d", modifiers: ["accent"] }],
  ])("normalizes %s token %s with context-sensitive p semantics", (line, token, expected) => {
    const event = normalizeSingleToken(line, token);

    expect(event.track).toBe(expected.track);
    expect(event.glyph).toBe(expected.glyph);
    expect(event.modifiers).toEqual(expected.modifiers);
  });

  it.each([
    ["HH", "g", { track: "HH", glyph: "x", modifiers: ["ghost"] }],
    ["HH", "G", { track: "HH", glyph: "x", modifiers: ["accent", "ghost"] }],
    ["SD", "g", { track: "SD", glyph: "d", modifiers: ["ghost"] }],
    ["SD", "G", { track: "SD", glyph: "d", modifiers: ["accent", "ghost"] }],
    ["|", "g", { track: "SD", glyph: "d", modifiers: ["ghost"] }],
    ["|", "G", { track: "SD", glyph: "d", modifiers: ["accent", "ghost"] }],
  ])("normalizes %s token %s with context-sensitive g semantics", (line, token, expected) => {
    const event = normalizeSingleToken(line, token);

    expect(event.track).toBe(expected.track);
    expect(event.glyph).toBe(expected.glyph);
    expect(event.modifiers).toEqual(expected.modifiers);
  });

  it.each([
    ["s", "SD", "d", []],
    ["S", "SD", "d", ["accent"]],
    ["b", "BD", "d", []],
    ["B", "BD", "d", ["accent"]],
    ["b2", "BD2", "d", []],
    ["B2", "BD2", "d", ["accent"]],
    ["r", "RC", "x", []],
    ["R", "RC", "x", ["accent"]],
    ["r2", "RC2", "x", []],
    ["R2", "RC2", "x", ["accent"]],
    ["c", "C", "x", []],
    ["C", "C", "x", ["accent"]],
    ["c2", "C2", "x", []],
    ["C2", "C2", "x", ["accent"]],
    ["t1", "T1", "d", []],
    ["t2", "T2", "d", []],
    ["t3", "T3", "d", []],
    ["t4", "T4", "d", []],
    ["o", "HH", "x", ["open"]],
    ["O", "HH", "x", ["accent", "open"]],
    ["spl", "SPL", "x", []],
    ["SPL", "SPL", "x", ["accent"]],
    ["chn", "CHN", "x", []],
    ["CHN", "CHN", "x", ["accent"]],
    ["cb", "CB", "d", []],
    ["CB", "CB", "d", ["accent"]],
    ["wb", "WB", "d", []],
    ["WB", "WB", "d", ["accent"]],
    ["cl", "CL", "d", []],
    ["CL", "CL", "d", ["accent"]],
  ])("normalizes static token %s to %s even inside another named track", (token, track, glyph, modifiers) => {
    const event = normalizeSingleToken("HH", token);

    expect(event.track).toBe(track);
    expect(event.kind).toBe("hit");
    expect(event.glyph).toBe(glyph);
    expect(event.modifiers).toEqual(modifiers);
  });

  it("treats ST line R/L as sticking, while ST-prefixed tokens stay sticking outside ST and bare R remains ride accent", () => {
    const score = buildNormalizedScore(`time 3/4
divisions 3
grouping 1+1+1

ST | R L - |

| R ST:R ST:L |`);

    expect(score.errors).toEqual([]);

    const stMeasure = score.measures[0]!;
    expect(stMeasure.events.map((event) => ({
      track: event.track,
      kind: event.kind,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "ST", kind: "sticking", glyph: "R", modifiers: [] },
      { track: "ST", kind: "sticking", glyph: "L", modifiers: [] },
    ]);

    const mixedMeasure = score.measures[1]!;
    expect(mixedMeasure.events.map((event) => ({
      track: event.track,
      kind: event.kind,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "RC", kind: "hit", glyph: "x", modifiers: ["accent"] },
      { track: "ST", kind: "sticking", glyph: "R", modifiers: [] },
      { track: "ST", kind: "sticking", glyph: "L", modifiers: [] },
    ]);
  });
});
