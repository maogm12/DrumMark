import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "../dsl/types";
import {
  annotationTextForEvent,
  graceNoteSlash,
  modifierIsGrace,
  tremoloMarksForEvent,
} from "./articulations";
import { getVexNotehead, instrumentForTrack } from "./notes";

function makeEvent(modifiers: NormalizedEvent["modifiers"]): NormalizedEvent {
  return {
    track: "HH",
    paragraphIndex: 0,
    measureIndex: 0,
    measureInParagraph: 0,
    start: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 4 },
    kind: "hit",
    glyph: "x",
    modifiers,
    voice: 1,
    beam: "none",
  };
}

describe("vexflow articulation helpers", () => {
  it("provides a text annotation for half-open hi-hat", () => {
    expect(annotationTextForEvent(makeEvent(["half-open"]))).toBe("half-open");
  });

  it("provides tremolo marks for roll modifiers", () => {
    expect(tremoloMarksForEvent(makeEvent(["roll"]))).toBe(3);
  });

  it("keeps flam and drag on the grace-note path", () => {
    expect(modifierIsGrace(makeEvent(["flam"]))).toBe(true);
    expect(graceNoteSlash(makeEvent(["flam"]))).toBe(true);
    expect(modifierIsGrace(makeEvent(["drag"]))).toBe(true);
    expect(graceNoteSlash(makeEvent(["drag"]))).toBe(false);
  });

  it("uses x noteheads for dead strokes", () => {
    const event = { ...makeEvent(["dead"]), track: "SD" as const, glyph: "d" as const };
    expect(getVexNotehead(event, instrumentForTrack("SD"))).toBe("X");
  });
});
