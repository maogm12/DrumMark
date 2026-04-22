import { describe, expect, it } from "vitest";
import { buildNormalizedScore, buildMusicXml } from "./index";

describe("DR group parsing", () => {
  it("expands [ss] to two 16th notes with time-modification", () => {
    // time 4/4, divisions=8:
    // - Each slot = 1/8 (eighth note)
    // - [ss] occupies span=1 slot = 1/8 total
    // - 2 items in 1/8 space => each item = 1/16 (16th note)
    // So [ss] should produce two 16th notes with tuplet 2:1
    const score = buildNormalizedScore(`time 4/4
divisions 8

DR | ss [ss] |`);

    const sdEvents = score.measures[0].events.filter(e => e.track === "SD");

    // [ss] has span=1, count=2
    // Each item: duration = (1/8 * 1) / 2 = 1/16
    // tuplet: { actual: 2, normal: 1 } = 2 in 1
    const tupletEvents = sdEvents.filter(e => e.tuplet);
    expect(tupletEvents).toHaveLength(2);
    for (const event of tupletEvents) {
      expect(event.duration).toEqual({ numerator: 1, denominator: 16 });
      expect(event.tuplet).toEqual({ actual: 2, normal: 1 });
    }
  });

  it("renders [ss] as 16th notes in MusicXML, not 32nd", () => {
    // With time 4/4, divisions=8, [ss] should export as 16th notes (type="16th")
    // with tuplet 2:1, NOT 32nd notes
    const score = buildNormalizedScore(`time 4/4
divisions 8

DR | ss [ss] |`);
    const xml = buildMusicXml(score);

    // The tuplet notes should be 16th notes, not 32nd notes
    expect(xml).toContain("<type>16th</type>");
    expect(xml).not.toContain("<type>32nd</type>");
    expect(xml).toContain("<actual-notes>2</actual-notes>");
    expect(xml).toContain("<normal-notes>1</normal-notes>");
  });

  it("supports [2:ssss] compressed group (ratio 4:2)", () => {
    // [2:ssss] means span=2, count=4
    // Each item: (1/8 * 2) / 4 = 1/16 (16th note)
    // This is a tuplet: 4 in the space of 2
    const score = buildNormalizedScore(`time 4/4
grouping 1+1+1+1
divisions 8

DR | ss ss ss [2:ssss] |`);

    expect(score.errors).toEqual([]);
    const sdEvents = score.measures[0].events.filter(e => e.track === "SD");
    const tupletEvents = sdEvents.filter(e => e.tuplet);

    // 4 items from [2:ssss], each 1/16 duration
    expect(tupletEvents).toHaveLength(4);
    for (const event of tupletEvents) {
      expect(event.duration).toEqual({ numerator: 1, denominator: 16 });
    }
  });
});