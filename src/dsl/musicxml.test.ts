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

  it("preserves supported modifiers with MusicXML semantics", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8

HH | x:open x:close - - - - - - |
SD | g d:rim d:cross d:flam - - - - |
RC | x:bell - - - - - - - |
C  | x:choke - - - - - - - |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);

    expect(xml).toContain("<technical><open-string/></technical>");
    expect(xml).toContain("<technical><stopped/></technical>");
    expect(xml).toContain("<notehead parentheses=\"yes\">normal</notehead>");
    expect(xml).toContain("<technical><other-technical>rim</other-technical></technical>");
    expect(xml).toContain("<technical><other-technical>cross-stick</other-technical></technical>");
    expect(xml).toContain("<technical><other-technical>bell</other-technical></technical>");
    expect(xml).toContain("<technical><other-technical>choke</other-technical></technical>");
    expect(xml).toContain("<ornaments><tremolo type=\"single\">1</tremolo></ornaments>");
  });

  it("does not export ST sticking events", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - x - |
ST | R L R L |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);

    expect(xml).not.toContain("<display-step>B</display-step>");
  });

  it("exports score metadata headers", () => {
    const score = buildNormalizedScore(`title Funk & Flow
subtitle Verse <A>
composer G. "Mao"
time 4/4
divisions 4

HH | x - x - |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);

    expect(xml).toContain("<work-title>Funk &amp; Flow</work-title>");
    expect(xml).toContain("<creator type=\"composer\">G. &quot;Mao&quot;</creator>");
    expect(xml).toContain("<credit-type>title</credit-type>");
    expect(xml).toContain("<credit-words>Funk &amp; Flow</credit-words>");
    expect(xml).toContain("<credit-type>subtitle</credit-type>");
    expect(xml).toContain("<credit-words>Verse &lt;A&gt;</credit-words>");
    expect(xml).toContain("<credit-type>composer</credit-type>");
    expect(xml).toContain("<credit-words>G. &quot;Mao&quot;</credit-words>");
  });
});
