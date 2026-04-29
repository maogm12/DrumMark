import { describe, expect, it } from "vitest";
import { Glyphs, VoltaType } from "vexflow";
import type { NormalizedScore } from "../dsl/types";
import { jumpText, markerText, measureRepeatGlyph, voltaTypeForMeasure } from "./renderer";

function makeScore(): NormalizedScore {
  return {
    version: "1.0.0",
    header: {
      tempo: 120,
      timeSignature: { beats: 4, beatUnit: 4 },
      divisions: 4,
      grouping: [2, 2],
    },
    tracks: [],
    ast: {
      headers: {
        tempo: { field: "tempo", value: 120, line: 1 },
        time: { field: "time", beats: 4, beatUnit: 4, line: 2 },
        divisions: { field: "divisions", value: 4, line: 3 },
        grouping: { field: "grouping", values: [2, 2], line: 4 },
      },
      paragraphs: [],
      repeatSpans: [],
      errors: [],
    },
    measures: [
      {
        index: 0,
        globalIndex: 0,
        paragraphIndex: 0,
        measureInParagraph: 0,
        sourceLine: 1,
        events: [],
        volta: { indices: [1] },
      },
      {
        index: 1,
        globalIndex: 1,
        paragraphIndex: 0,
        measureInParagraph: 1,
        sourceLine: 1,
        events: [],
        volta: { indices: [1] },
      },
      {
        index: 2,
        globalIndex: 2,
        paragraphIndex: 0,
        measureInParagraph: 2,
        sourceLine: 1,
        events: [],
      },
    ],
    errors: [],
  };
}

describe("vexflow structural helpers", () => {
  it("maps navigation metadata to stave text labels", () => {
    expect(markerText("segno")).toBe("Segno");
    expect(markerText("coda")).toBe("Coda");
    expect(markerText("fine")).toBe("Fine");
    expect(jumpText("to-coda")).toBe("To Coda");
    expect(jumpText("dc-al-fine")).toBe("D.C. al Fine");
  });

  it("maps measure-repeat intent to VexFlow repeat glyphs", () => {
    expect(measureRepeatGlyph(1)).toBe(Glyphs.repeat1Bar);
    expect(measureRepeatGlyph(2)).toBe(Glyphs.repeat2Bars);
  });

  it("derives volta shapes from canonical neighboring measures", () => {
    const score = makeScore();

    expect(voltaTypeForMeasure(score, score.measures[0]!)).toBe(VoltaType.BEGIN);
    expect(voltaTypeForMeasure(score, score.measures[1]!)).toBe(VoltaType.END);
    expect(voltaTypeForMeasure(score, score.measures[2]!)).toBeNull();
  });
});
