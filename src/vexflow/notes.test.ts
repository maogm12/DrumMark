import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "../dsl/types";
import { durationCode, getVexNotehead, instrumentForTrack, makeNoteKey } from "./notes";

function makeEvent(track: NormalizedEvent["track"], modifiers: NormalizedEvent["modifiers"] = []): NormalizedEvent {
  return {
    track,
    paragraphIndex: 0,
    measureIndex: 0,
    measureInParagraph: 0,
    start: { numerator: 0, denominator: 1 },
    duration: { numerator: 1, denominator: 4 },
    kind: "hit",
    glyph: "d",
    modifiers,
    voice: track === "BD" || track === "BD2" || track === "HF" ? 2 : 1,
    beam: "none",
  };
}

describe("vexflow note helpers", () => {
  it("maps fractions to VexFlow duration codes and dots", () => {
    expect(durationCode({ numerator: 1, denominator: 4 })).toEqual({ code: "q", dots: 0 });
    expect(durationCode({ numerator: 3, denominator: 8 })).toEqual({ code: "q", dots: 1 });
    expect(durationCode({ numerator: 7, denominator: 16 })).toEqual({ code: "q", dots: 2 });
    expect(durationCode({ numerator: 1, denominator: 8 })).toEqual({ code: "8", dots: 0 });
    expect(durationCode({ numerator: 3, denominator: 16 })).toEqual({ code: "8", dots: 1 });
  });

  it("maps the expanded track registry to stave positions", () => {
    expect(instrumentForTrack("BD2")).toMatchObject({ displayStep: "E", displayOctave: 4 });
    expect(instrumentForTrack("T4")).toMatchObject({ displayStep: "G", displayOctave: 4 });
    expect(instrumentForTrack("RC2")).toMatchObject({ displayStep: "E", displayOctave: 5, notehead: "x" });
    expect(instrumentForTrack("C2")).toMatchObject({ displayStep: "B", displayOctave: 5, notehead: "x" });
    expect(instrumentForTrack("SPL")).toMatchObject({ displayStep: "D", displayOctave: 6, notehead: "x" });
    expect(instrumentForTrack("CHN")).toMatchObject({ displayStep: "C", displayOctave: 6, notehead: "x" });
    expect(instrumentForTrack("CB")).toMatchObject({ displayStep: "B", displayOctave: 4 });
    expect(instrumentForTrack("WB")).toMatchObject({ displayStep: "A", displayOctave: 3 });
    expect(instrumentForTrack("CL")).toMatchObject({ displayStep: "G", displayOctave: 4 });
  });

  it("treats the expanded cymbal family as x-notehead instruments", () => {
    expect(getVexNotehead(makeEvent("RC2"), instrumentForTrack("RC2"))).toBe("X");
    expect(getVexNotehead(makeEvent("C2"), instrumentForTrack("C2"))).toBe("X");
    expect(getVexNotehead(makeEvent("SPL"), instrumentForTrack("SPL"))).toBe("X");
    expect(getVexNotehead(makeEvent("CHN"), instrumentForTrack("CHN"))).toBe("X");
    expect(getVexNotehead(makeEvent("RC2", ["bell"]), instrumentForTrack("RC2"))).toBe("D2");
  });

  it("does not retain hi-hat-local crash sugar in VexFlow mapping", () => {
    const hhKey = makeNoteKey(
      { ...makeEvent("HH"), glyph: "c" },
      instrumentForTrack("HH", "c"),
    );

    expect(hhKey).toBe("G/5/X");
  });
});
