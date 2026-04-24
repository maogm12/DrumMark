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

  it("exports 3:2 groups as eighth-note triplets", () => {
    const score = buildNormalizedScore(`time 4/4
grouping 1+1+1+1
divisions 8

DR | [2:s] ss [ss][ssss] [2:sss] |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    const tripletNotes = xml.match(
      /<type>eighth<\/type><time-modification><actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes><\/time-modification>/g,
    );

    expect(tripletNotes).toHaveLength(3);
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

  it("requests system-level measure numbers", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - x - |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);

    expect(xml).toContain("<print><measure-numbering>system</measure-numbering></print>");
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

  it("exports ST sticking as fingering above matching notes", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x x x x |
ST | R L R L |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);

    expect(xml).not.toContain("<display-step>B</display-step>");
    expect(xml.match(/<direction placement="above">/g)).toHaveLength(1);
    expect(xml.match(/<fingering placement="above" font-size="14">R<\/fingering>/g)).toHaveLength(2);
    expect(xml.match(/<fingering placement="above" font-size="14">L<\/fingering>/g)).toHaveLength(2);
  });

  it("attaches sticking to the highest note when multiple notes share a start", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

SD | d - - - |
T1 | d - - - |
ST | R - - - |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    const fingeringNote = xml
      .match(/<note>.*?<\/note>/g)
      ?.find((note) => note.includes('<fingering placement="above" font-size="14">R</fingering>'));

    expect(fingeringNote).toContain("<display-step>E</display-step>");
    expect(fingeringNote).not.toContain("<display-step>C</display-step>");
  });

  it("supports complex grouping like 2+2+3 in 7/8 time", () => {
    const score = buildNormalizedScore(`time 7/8
divisions 7
grouping 2+2+3

HH | x x x x x x x |`);

    expect(score.errors).toEqual([]);
    const xml = buildMusicXml(score);
    
    // Split into individual notes to inspect beams
    const notes = xml.match(/<note>.*?<\/note>/gs) || [];
    expect(notes).toHaveLength(7);

    // Note 1 & 2 (Group 1: size 2)
    expect(notes[0]).toContain('<beam number="1">begin</beam>');
    expect(notes[1]).toContain('<beam number="1">end</beam>');

    // Note 3 & 4 (Group 2: size 2)
    expect(notes[2]).toContain('<beam number="1">begin</beam>');
    expect(notes[3]).toContain('<beam number="1">end</beam>');

    // Note 5, 6 & 7 (Group 3: size 3)
    expect(notes[4]).toContain('<beam number="1">begin</beam>');
    expect(notes[5]).toContain('<beam number="1">continue</beam>');
    expect(notes[6]).toContain('<beam number="1">end</beam>');
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
    expect(xml).toContain('<credit-words justify="center" font-size="20" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, Helvetica Neue, Arial, sans-serif" font-weight="bold">Funk &amp; Flow</credit-words>');
    expect(xml).toContain("<credit-type>subtitle</credit-type>");
    expect(xml).toContain('<credit-words justify="center" font-size="12" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, Helvetica Neue, Arial, sans-serif" font-style="italic">Verse &lt;A&gt;</credit-words>');
    expect(xml).toContain("<credit-type>composer</credit-type>");
    expect(xml).toContain('<credit-words justify="right" font-size="10" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, Helvetica Neue, Arial, sans-serif">G. &quot;Mao&quot;</credit-words>');
  });
});
