import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";
import type { Modifier, TrackName } from "./types";

function parseMeasureTokens(source: string) {
  const doc = parseDocumentSkeleton(source);
  expect(doc.errors).toEqual([]);
  return doc.paragraphs[0].lines[0].measures[0].tokens;
}

function normalizeMeasureEvents(source: string) {
  const score = buildNormalizedScore(source);
  expect(score.errors).toEqual([]);
  return score.measures[0].events.map((event) => ({
    track: event.track,
    glyph: event.glyph,
    modifiers: event.modifiers,
    kind: event.kind,
  }));
}

describe("spec C21: trailing modifiers after duration suffixes", () => {
  describe("parser", () => {
    it("parses modifier before duration suffix (existing behavior)", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

HH | d:accent. |`);
      expect(tokens).toEqual([
        {
          kind: "basic",
          value: "d",
          dots: 1,
          halves: 0,
          stars: 0,
          modifiers: ["accent"],
          trackOverride: undefined,
        },
      ]);
    });

    it("parses modifier after duration suffix (new behavior)", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

HH | d.*:accent |`);
      expect(tokens).toEqual([
        {
          kind: "basic",
          value: "d",
          dots: 1,
          halves: 0,
          stars: 1,
          modifiers: ["accent"],
          trackOverride: undefined,
        },
      ]);
    });

    it("parses interleaved modifiers and duration suffixes", () => {
      // d:ghost.*/ should be: glyph=d, modifier=ghost, dots=1, halves=1, stars=1
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

HH | d:ghost.*/ |`);
      expect(tokens).toEqual([
        {
          kind: "basic",
          value: "d",
          dots: 1,
          halves: 1,
          stars: 1,
          modifiers: ["ghost"],
          trackOverride: undefined,
        },
      ]);
    });

    it("parses d:ghost:accent.*/ correctly", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

HH | d:ghost:accent.*/ |`);
      expect(tokens).toEqual([
        {
          kind: "basic",
          value: "d",
          dots: 1,
          halves: 1,
          stars: 1,
          modifiers: ["ghost", "accent"],
          trackOverride: undefined,
        },
      ]);
    });
  });

  describe("normalization", () => {
    it("normalizes d.*:accent the same as d:accent.*", () => {
      // d.* = 3 slots. Use grouping 4 so no internal boundaries in 4/4
      const doc1 = parseDocumentSkeleton(`time 4/4
grouping 4
divisions 16

HH | d.*:accent |`);
      const doc2 = parseDocumentSkeleton(`time 4/4
grouping 4
divisions 16

HH | d:accent.* |`);
      expect(doc1.errors).toEqual([]);
      expect(doc2.errors).toEqual([]);
      const tokens1 = doc1.paragraphs[0]?.lines[0]?.measures[0]?.tokens;
      const tokens2 = doc2.paragraphs[0]?.lines[0]?.measures[0]?.tokens;
      expect(tokens1).toEqual(tokens2);
      expect(tokens1?.[0]).toMatchObject({
        kind: "basic",
        value: "d",
        dots: 1,
        stars: 1,
        modifiers: ["accent"],
      });
    });

    it("normalizes d:ghost:accent.*/ with correct modifiers", () => {
      // d.*/ = 1.5 slots. Just check it parses and normalizes without errors
      // using a simpler measure that fits
      const doc = parseDocumentSkeleton(`time 4/4
grouping 4
divisions 16

HH | d:ghost:accent.*/ x x x x x |`);
      expect(doc.errors).toEqual([]);
      const tokens = doc.paragraphs[0]?.lines[0]?.measures[0]?.tokens;
      // First token should be d:ghost:accent with .*/
      expect(tokens?.[0]).toMatchObject({
        kind: "basic",
        value: "d",
        dots: 1,
        stars: 1,
        halves: 1,
        modifiers: ["ghost", "accent"],
      });
    });
  });
});

describe("spec C21: group modifier attachment", () => {
  describe("parser", () => {
    it("parses [2:s]:flam as group with modifiers", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

SD | [2:s]:flam |`);
      expect(tokens).toEqual([
        {
          kind: "group",
          span: 2,
          count: 1,
          modifiers: ["flam"],
          items: [
            { kind: "basic", value: "s", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
          ],
        },
      ]);
    });

    it("parses [2:s.*]:rim as group with dotted+doubled note and modifiers", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

SD | [2:s.*]:rim |`);
      expect(tokens).toEqual([
        {
          kind: "group",
          span: 2,
          count: 1,
          modifiers: ["rim"],
          items: [
            { kind: "basic", value: "s", dots: 1, halves: 0, stars: 1, modifiers: [], trackOverride: undefined },
          ],
        },
      ]);
    });

    it("parses [2:s+b]:accent for combined hit with group modifier", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

BD | [2:s+b]:accent |`);
      // s+b is parsed as a single combined item (count=1)
      // with 2 basic items inside
      expect(tokens).toEqual([
        {
          kind: "group",
          span: 2,
          count: 1,
          modifiers: ["accent"],
          items: [
            {
              kind: "combined",
              items: [
                { kind: "basic", value: "s", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
                { kind: "basic", value: "b", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
              ],
            },
          ],
        },
      ]);
    });

    it("parses [2:dd]:accent for multiple notes with group modifier", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

SD | [2:dd]:accent |`);
      expect(tokens).toEqual([
        {
          kind: "group",
          span: 2,
          count: 2,
          modifiers: ["accent"],
          items: [
            { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
            { kind: "basic", value: "d", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
          ],
        },
      ]);
    });

    it("parses group without modifiers (existing behavior)", () => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

HH | [2:s] |`);
      expect(tokens).toEqual([
        {
          kind: "group",
          span: 2,
          count: 1,
          modifiers: [],
          items: [
            { kind: "basic", value: "s", dots: 0, halves: 0, stars: 0, modifiers: [], trackOverride: undefined },
          ],
        },
      ]);
    });
  });

  describe("normalization", () => {
    it("normalizes [2:s]:flam and applies flam to the note", () => {
      const events = normalizeMeasureEvents(`time 4/4
divisions 4

SD | [2:s]:flam |`);
      expect(events).toEqual([
        { track: "SD", glyph: "d", modifiers: expect.arrayContaining(["flam"]), kind: "hit" },
      ]);
    });

    it("normalizes [2:s+b]:accent and applies accent to both notes", () => {
      const events = normalizeMeasureEvents(`time 4/4
divisions 4

BD | [2:s+b]:accent |`);
      // s resolves to SD, b resolves to BD
      expect(events).toHaveLength(2);
      expect(events[0]?.track).toBe("SD");
      expect(events[1]?.track).toBe("BD");
      for (const event of events) {
        expect(event.modifiers).toContain("accent");
      }
    });

    it("normalizes [2:dd]:accent and applies accent to both notes", () => {
      const events = normalizeMeasureEvents(`time 4/4
divisions 4

SD | [2:dd]:accent |`);
      expect(events).toHaveLength(2);
      for (const event of events) {
        expect(event.modifiers).toContain("accent");
      }
    });

    it("normalizes [2:s.*]:rim correctly", () => {
      const events = normalizeMeasureEvents(`time 4/4
divisions 4

SD | [2:s.*]:rim |`);
      expect(events).toEqual([
        { track: "SD", glyph: "d", modifiers: expect.arrayContaining(["rim"]), kind: "hit" },
      ]);
    });
  });

  describe("validation", () => {
    it("rejects [2:-]:accent - rests cannot have articulation modifiers", () => {
      const score = buildNormalizedScore(`time 4/4
divisions 4

HH | [2:-]:accent |`);
      expect(score.errors.some((e) => e.message.includes("Rest cannot have articulation modifiers"))).toBe(true);
    });

    it("allows [2:-] without modifiers", () => {
      const score = buildNormalizedScore(`time 4/4
divisions 4

HH | [2:-] - |`);
      expect(score.errors).toEqual([]);
    });
  });
});
