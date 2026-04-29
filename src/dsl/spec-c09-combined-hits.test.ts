import { describe, expect, it } from "vitest";

import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";

function parseSingleMeasureTokens(source: string) {
  const doc = parseDocumentSkeleton(source);
  expect(doc.errors).toEqual([]);
  return doc.paragraphs[0]?.lines[0]?.measures[0]?.tokens ?? [];
}

function normalizeSingleMeasureEvents(source: string) {
  const score = buildNormalizedScore(source);
  expect(score.errors).toEqual([]);
  return score.measures[0]?.events ?? [];
}

describe("DRUMMARK_SPEC C09 combined hits", () => {
  it("parses compact and whitespace-separated plus syntax as the same combined-hit shape", () => {
    const compact = parseSingleMeasureTokens(`time 4/4
divisions 4

| x+s HH:d+SD:d:rim |`);

    const spaced = parseSingleMeasureTokens(`time 4/4
divisions 4

| x + s HH:d + SD:d:rim |`);

    expect(spaced).toEqual(compact);
    expect(spaced).toEqual([
      {
        kind: "combined",
        items: [
          { kind: "basic", value: "x", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
          { kind: "basic", value: "s", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
        ],
      },
      {
        kind: "combined",
        items: [
          { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: [], trackOverride: "HH" },
          { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: ["rim"], trackOverride: "SD" },
        ],
      },
    ]);
  });

  it("parses each combined-hit item with its own summon and modifier chain", () => {
    const tokens = parseSingleMeasureTokens(`time 4/4
divisions 4

| b+SD:d:cross:accent+RC:d:bell:drag |`);

    expect(tokens).toEqual([
      {
        kind: "combined",
        items: [
          { kind: "basic", value: "b", dots: 0, halves: 0, modifiers: [], trackOverride: undefined },
          { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: ["cross", "accent"], trackOverride: "SD" },
          { kind: "basic", value: "d", dots: 0, halves: 0, modifiers: ["bell", "drag"], trackOverride: "RC" },
        ],
      },
    ]);
  });

  it("normalizes every event in a combined hit to the same start and duration", () => {
    const events = normalizeSingleMeasureEvents(`time 4/4
divisions 4

| x+s+b |`);

    expect(events.map((event) => ({
      track: event.track,
      start: event.start,
      duration: event.duration,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      {
        track: "HH",
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "x",
        modifiers: [],
      },
      {
        track: "SD",
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "d",
        modifiers: [],
      },
      {
        track: "BD",
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "d",
        modifiers: [],
      },
    ]);
  });

  it("keeps successive combined hits on distinct slots while preserving per-slot simultaneity", () => {
    const events = normalizeSingleMeasureEvents(`time 4/4
divisions 4

| HH:d:open + SD:d:rim + b x+RC:d:bell |`);

    expect(events.map((event) => ({
      track: event.track,
      start: event.start,
      duration: event.duration,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      {
        track: "HH",
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "x",
        modifiers: ["open"],
      },
      {
        track: "SD",
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "d",
        modifiers: ["rim"],
      },
      {
        track: "BD",
        start: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "d",
        modifiers: [],
      },
      {
        track: "HH",
        start: { numerator: 1, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "x",
        modifiers: [],
      },
      {
        track: "RC",
        start: { numerator: 1, denominator: 4 },
        duration: { numerator: 1, denominator: 4 },
        glyph: "x",
        modifiers: ["bell"],
      },
    ]);
  });
});
