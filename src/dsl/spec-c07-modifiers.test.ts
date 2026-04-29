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
    modifier: event.modifier,
    kind: event.kind,
  }));
}

describe("DRUMMARK_SPEC C07 modifiers", () => {
  it.each([
    ["SD", "d:accent", ["accent"]],
    ["HH", "d:open", ["open"]],
    ["HH", "d:half-open", ["half-open"]],
    ["HH", "d:close", ["close"]],
    ["C", "d:choke", ["choke"]],
    ["RC", "d:bell", ["bell"]],
    ["SD", "d:rim", ["rim"]],
    ["SD", "d:cross", ["cross"]],
    ["SD", "d:flam", ["flam"]],
    ["HH", "d:ghost", ["ghost"]],
    ["RC", "d:drag", ["drag"]],
    ["BD", "d:roll", ["roll"]],
    ["BD", "d:dead", ["dead"]],
  ] satisfies [TrackName, string, Modifier[]][])(
    "parses supported modifier syntax for %s %s",
    (track, token, modifiers) => {
      const tokens = parseMeasureTokens(`time 4/4
divisions 4

${track} | ${token} |`);

      expect(tokens).toEqual([
        {
          kind: "basic",
          value: "d",
          dots: 0,
          halves: 0,
          modifiers,
          trackOverride: undefined,
        },
      ]);
    },
  );

  it("parses chained modifiers and summon-plus-modifier syntax with stable token shape", () => {
    const tokens = parseMeasureTokens(`time 4/4
divisions 4

| HH:d:open:accent SD:d:rim:ghost RC:d:bell:accent b+SD:d:cross:accent+HH:d:close |`);

    expect(tokens).toEqual([
      {
        kind: "basic",
        value: "d",
        dots: 0,
        halves: 0,
        modifiers: ["open", "accent"],
        trackOverride: "HH",
      },
      {
        kind: "basic",
        value: "d",
        dots: 0,
        halves: 0,
        modifiers: ["rim", "ghost"],
        trackOverride: "SD",
      },
      {
        kind: "basic",
        value: "d",
        dots: 0,
        halves: 0,
        modifiers: ["bell", "accent"],
        trackOverride: "RC",
      },
      {
        kind: "combined",
        items: [
          {
            kind: "basic",
            value: "b",
            dots: 0,
            halves: 0,
            modifiers: [],
            trackOverride: undefined,
          },
          {
            kind: "basic",
            value: "d",
            dots: 0,
            halves: 0,
            modifiers: ["cross", "accent"],
            trackOverride: "SD",
          },
          {
            kind: "basic",
            value: "d",
            dots: 0,
            halves: 0,
            modifiers: ["close"],
            trackOverride: "HH",
          },
        ],
      },
    ]);
  });

  it("normalizes supported modifiers to stable track, glyph, and primary modifier shape", () => {
    const events = normalizeMeasureEvents(`time 13/4
divisions 13
grouping 1+1+1+1+1+1+1+1+1+1+1+1+1

| SD:d:accent HH:d:open HH:d:half-open HF:d:close C:d:choke RC:d:bell SD:d:rim SD:d:cross SD:d:flam HH:d:ghost RC:d:drag BD:d:roll BD:d:dead |`);

    expect(events).toEqual([
      { track: "SD", glyph: "d", modifiers: ["accent"], modifier: undefined, kind: "hit" },
      { track: "HH", glyph: "x", modifiers: ["open"], modifier: "open", kind: "hit" },
      { track: "HH", glyph: "x", modifiers: ["half-open"], modifier: "half-open", kind: "hit" },
      { track: "HF", glyph: "d", modifiers: ["close"], modifier: "close", kind: "hit" },
      { track: "C", glyph: "x", modifiers: ["choke"], modifier: "choke", kind: "hit" },
      { track: "RC", glyph: "x", modifiers: ["bell"], modifier: "bell", kind: "hit" },
      { track: "SD", glyph: "d", modifiers: ["rim"], modifier: "rim", kind: "hit" },
      { track: "SD", glyph: "d", modifiers: ["cross"], modifier: "cross", kind: "hit" },
      { track: "SD", glyph: "d", modifiers: ["flam"], modifier: "flam", kind: "hit" },
      { track: "HH", glyph: "x", modifiers: ["ghost"], modifier: "ghost", kind: "hit" },
      { track: "RC", glyph: "x", modifiers: ["drag"], modifier: "drag", kind: "hit" },
      { track: "BD", glyph: "d", modifiers: ["roll"], modifier: "roll", kind: "hit" },
      { track: "BD", glyph: "d", modifiers: ["dead"], modifier: "dead", kind: "hit" },
    ]);
  });

  it("normalizes chained modifiers and combined summoned hits item-by-item", () => {
    const events = normalizeMeasureEvents(`time 4/4
divisions 4

| HH:d:open:accent SD:d:rim:ghost b+SD:d:cross:accent+RC:d:bell:drag |`);

    expect(events).toEqual([
      { track: "HH", glyph: "x", modifiers: ["open", "accent"], modifier: "open", kind: "hit" },
      { track: "SD", glyph: "d", modifiers: ["rim", "ghost"], modifier: "rim", kind: "hit" },
      { track: "BD", glyph: "d", modifiers: [], modifier: undefined, kind: "hit" },
      { track: "SD", glyph: "d", modifiers: ["cross", "accent"], modifier: "cross", kind: "hit" },
      { track: "RC", glyph: "x", modifiers: ["bell", "drag"], modifier: "bell", kind: "hit" },
    ]);
  });
});
