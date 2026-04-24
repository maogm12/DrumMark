import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { buildMusicXml } from "./musicxml";

describe("Dotted and halved durations", () => {
  it("calculates weights correctly for various combinations", () => {
    // divisions 16 means 1 slot = 1/16
    // d = 1 slot
    // d. = 1.5 slots
    // d/ = 0.5 slots
    // d./ = 0.75 slots
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | x. x/ x.. x// |`);

    expect(score.errors).toEqual([]);
    
    const events = score.measures[0].events;
    // x. (1.5 slots) -> 1.5 * 1/4 = 3/8
    expect(events[0].duration).toEqual({ numerator: 3, denominator: 8 });
    // x/ (0.5 slots) -> 0.5 * 1/4 = 1/8
    expect(events[1].duration).toEqual({ numerator: 1, denominator: 8 });
    // x.. (1.75 slots) -> 1.75 * 1/4 = 7/16
    expect(events[2].duration).toEqual({ numerator: 7, denominator: 16 });
    // x// (0.25 slots) -> 0.25 * 1/4 = 1/16
    expect(events[3].duration).toEqual({ numerator: 1, denominator: 16 });
    
    // Total: 1.5 + 0.5 + 1.75 + 0.25 = 4.0 slots. Correct.
  });

  it("reports error when notes cross grouping boundaries", () => {
    // grouping 2+2, divisions 4
    // Boundary at slot 2
    const score = buildNormalizedScore(`time 4/4
grouping 2+2
divisions 4
HH | x x. x/ |`);

    expect(score.errors).toContainEqual(expect.objectContaining({
      message: "Token `x` crosses grouping boundary at 2 in track HH"
    }));
  });

  it("exports dotted notes correctly to MusicXML", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | x. -/ x x |`);
    
    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    // Note: buildMusicXml may scale divisions to keep durations as integers.
    // In this case, to represent 3/8 and 1/8 with divisions, it might use 8.
    // 3/8 * 8*4 = 12? No, 3/8 of a bar. 
    // Let's just check the relative types which are more stable.
    expect(xml).toContain("<type>quarter</type><dot/>");
    expect(xml).toContain("<rest/>");
    expect(xml).toContain("<type>eighth</type>");
  });

  it("supports complex combinations like d./", () => {
    // 0.75 + 0.75 + 1.5 + 1.0 = 4.0 slots
    const score = buildNormalizedScore(`time 4/4
grouping 4
divisions 4
HH | x./ x./ x. x |`);
    
    expect(score.errors).toEqual([]);
    const events = score.measures[0].events;
    // x./ (0.75 slots) -> 0.75 * 1/4 = 3/16
    expect(events[0].duration).toEqual({ numerator: 3, denominator: 16 });
  });

  it("calculates complex weights accurately", () => {
    // x.. is 1.75 slots. x/// is 0.125 slots.
    // 1.75 + 0.125 + 0.125 + 1.0 + 1.0 = 4.0
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | x.. x/// x/// x x |`);
    
    expect(score.errors).toEqual([]);
    const events = score.measures[0].events;
    expect(events[0].duration).toEqual({ numerator: 7, denominator: 16 }); // 1.75 * 1/4
    expect(events[1].duration).toEqual({ numerator: 1, denominator: 32 }); // 0.125 * 1/4
  });
});
