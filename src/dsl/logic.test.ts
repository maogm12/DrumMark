import { describe, expect, it } from "vitest";
import {
  buildVoiceEntries,
  groupVoiceEvents,
  groupingSegmentIndex,
  resolveFallbackTrack,
  visualDurationForEvent,
  voiceForTrack,
  type Fraction,
} from "./logic";
import type { NormalizedEvent, NormalizedScore } from "./types";

function makeScore(grouping: number[]): NormalizedScore {
  return {
    version: "1.0.0",
    header: {
      tempo: 120,
      timeSignature: { beats: 7, beatUnit: 8 },
      divisions: 14,
      grouping,
      noteValue: 16,
    },
    tracks: [],
    ast: {
      headers: {
        tempo: { field: "tempo", value: 120, line: 1 },
        time: { field: "time", beats: 7, beatUnit: 8, line: 2 },
        divisions: { field: "divisions", value: 14, line: 3 },
        grouping: { field: "grouping", values: grouping, line: 4 },
      },
      paragraphs: [],
      repeatSpans: [],
      errors: [],
    },
    measures: [],
    errors: [],
  };
}

function makeEvent(start: Fraction, duration: Fraction): NormalizedEvent {
  return {
    track: "HH",
    paragraphIndex: 0,
    measureIndex: 0,
    measureInParagraph: 0,
    start,
    duration,
    kind: "hit",
    glyph: "x",
    modifiers: [],
    voice: 1,
    beam: "none",
  };
}

describe("dsl logic helpers", () => {
  it("routes lower-voice tracks through the shared voice helper", () => {
    expect(voiceForTrack("HH")).toBe(1);
    expect(voiceForTrack("BD")).toBe(2);
    expect(voiceForTrack("BD2")).toBe(2);
    expect(voiceForTrack("HF")).toBe(2);
  });

  it("resolves expanded fallback summon tokens", () => {
    expect(resolveFallbackTrack("b2")).toBe("BD2");
    expect(resolveFallbackTrack("r2")).toBe("RC2");
    expect(resolveFallbackTrack("c2")).toBe("C2");
    expect(resolveFallbackTrack("t4")).toBe("T4");
    expect(resolveFallbackTrack("spl")).toBe("SPL");
    expect(resolveFallbackTrack("chn")).toBe("CHN");
    expect(resolveFallbackTrack("cb")).toBe("CB");
    expect(resolveFallbackTrack("wb")).toBe("WB");
    expect(resolveFallbackTrack("cl")).toBe("CL");
  });

  it("segments grouping boundaries from canonical header fractions", () => {
    const score = makeScore([3, 2, 2]);

    expect(groupingSegmentIndex(score, { numerator: 0, denominator: 1 })).toBe(0);
    expect(groupingSegmentIndex(score, { numerator: 1, denominator: 4 })).toBe(0);
    expect(groupingSegmentIndex(score, { numerator: 3, denominator: 8 })).toBe(1);
    expect(groupingSegmentIndex(score, { numerator: 5, denominator: 8 })).toBe(2);
    expect(groupingSegmentIndex(score, { numerator: 3, denominator: 4 })).toBe(2);
  });

  it("derives visual durations for tuplets from canonical event metadata", () => {
    const duration = { numerator: 1, denominator: 12 };

    expect(
      visualDurationForEvent(
        {
          ...makeEvent({ numerator: 0, denominator: 1 }, duration),
          tuplet: { actual: 3, normal: 2 },
        },
        duration,
      ),
    ).toEqual({ numerator: 1, denominator: 8 });

    expect(
      visualDurationForEvent(
        {
          ...makeEvent({ numerator: 0, denominator: 1 }, duration),
          tuplet: { actual: 4, normal: 2 },
        },
        duration,
      ),
    ).toEqual(duration);
  });

  it("groups simultaneous events and fills measure gaps with rests", () => {
    const quarter = { numerator: 1, denominator: 4 };
    const groups = groupVoiceEvents([
      makeEvent({ numerator: 1, denominator: 4 }, quarter),
      makeEvent({ numerator: 0, denominator: 1 }, quarter),
      { ...makeEvent({ numerator: 0, denominator: 1 }, quarter), track: "RC" },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.events).toHaveLength(2);

    const entries = buildVoiceEntries(groups, { numerator: 0, denominator: 1 }, { numerator: 1, denominator: 1 });
    expect(entries.map((entry) => entry.kind)).toEqual(["notes", "notes", "rest"]);
    expect(entries[2]?.duration).toEqual({ numerator: 1, denominator: 2 });
  });

  it("handles identical relative event patterns across different measure starts", () => {
    // This replicates the reported bug where the second measure rendered incorrectly.
    // Input: SD | - - d - - - [2:dddd] |
    // divisions 8, grouping 1+1+1+1
    // "d" is at index 2 (1/4 into measure).
    // [2:dddd] starts at index 6 (3/4 into measure).
    
    const time = { beats: 4, beatUnit: 4 };
    const grouping = [1, 1, 1, 1];
    const measureDuration = { numerator: 1, denominator: 1 };
    
    const relativeEvents = [
      makeEvent({ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 8 }),
      makeEvent({ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 16 }),
      makeEvent({ numerator: 13, denominator: 16 }, { numerator: 1, denominator: 16 }),
      makeEvent({ numerator: 7, denominator: 8 }, { numerator: 1, denominator: 16 }),
      makeEvent({ numerator: 15, denominator: 16 }, { numerator: 1, denominator: 16 }),
    ];
    
    const groups = groupVoiceEvents(relativeEvents);
    
    // Measure 1 (start 0/1)
    const entries1 = buildVoiceEntries(groups, { numerator: 0, denominator: 1 }, measureDuration, grouping, time);
    
    // Measure 2 (start 1/1)
    const entries2 = buildVoiceEntries(groups, { numerator: 1, denominator: 1 }, measureDuration, grouping, time);
    
    // Both measures should have the same structure
    expect(entries1.map(e => e.kind)).toEqual(entries2.map(e => e.kind));
    expect(entries1.map(e => e.duration)).toEqual(entries2.map(e => e.duration));
    
    // Specifically, Measure 2 should NOT start with notes if it has leading rests
    expect(entries2[0].kind).toBe("rest");
    expect(entries2[0].duration).toEqual({ numerator: 1, denominator: 4 });
  });
});
