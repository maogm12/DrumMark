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
});
