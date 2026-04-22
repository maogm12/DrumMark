import { describe, expect, it } from "vitest";
import { buildMusicXml, buildNormalizedScore } from "./index";

describe("buildMusicXml", () => {
  it("emits dotted note markup for stretched groups", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8

HH | [3: x] - - - - - |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    expect(xml).toContain("<type>quarter</type><dot/>");
  });

  it("keeps default beaming within grouping boundaries", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8
grouping 2+2

HH | x x x x x x x x |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    expect(xml).toContain("<beam number=\"1\">end</beam>");
    expect(xml).toContain("<beam number=\"1\">begin</beam>");
  });

  it("expands repeats when play count is greater than two", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH |: x - x - :|x3`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    expect(xml.match(/<measure number=/g)).toHaveLength(3);
    expect(xml).not.toContain("<repeat direction=\"forward\"/>");
    expect(xml).not.toContain("<repeat direction=\"backward\"/>");
  });

  it("can hide voice 2 rests with forward elements", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - x - |
BD | - - p - |`);

    expect(score.errors).toEqual([]);
    const visibleXml = buildMusicXml(score);
    const hiddenXml = buildMusicXml(score, true);

    expect(visibleXml).toContain("<rest/><duration>8</duration><voice>2</voice>");
    expect(hiddenXml).not.toContain("<rest/><duration>8</duration><voice>2</voice>");
    expect(hiddenXml).toContain("<forward><duration>8</duration><voice>2</voice><staff>1</staff></forward>");
    expect(hiddenXml).not.toContain("<note><forward>");
  });
});
