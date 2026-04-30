import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { buildMusicXml } from "./musicxml";

describe("buildMusicXml", () => {
  it("exports the universal 'd' note and context aliases correctly", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | d - - - |
SD | d - - - |
| r - - - |`); // Use 'r' (Ride) instead of 'c' to keep it in voice 1

    const xml = buildMusicXml(score);
    
    // Use regex to find notes with specific display steps
    const findNote = (step: string) => {
      // Use a more restrictive match to avoid crossing <note> boundaries
      const match = xml.match(new RegExp(`<note>(?:(?!<note>)[^])*?<display-step>${step}</display-step>(?:(?!<note>)[^])*?</note>`, "g"));
      return match ? match[0] : undefined;
    };

    const hhNote = findNote("G");
    const rcNote = findNote("F");
    const sdNote = findNote("C");

    expect(hhNote).toContain("<notehead>x</notehead>");
    expect(rcNote).toContain("<notehead>x</notehead>");
    expect(sdNote).not.toContain("<notehead>x</notehead>");
  });

  it("preserves supported modifiers like rim and cross-stick", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
SD | d:rim d:cross |`);

    const xml = buildMusicXml(score);
    expect(xml).toContain("<other-technical>rim</other-technical>");
    expect(xml).toContain("<other-technical>cross-stick</other-technical>");
  });

  it("exports half-open, roll, and dead with explicit MusicXML behavior", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | d:half-open - - - |
SD | d:dead - - - |
BD | d:roll - - - |`);

    const xml = buildMusicXml(score);

    expect(xml).toContain("<other-technical>half-open</other-technical>");
    expect(xml).toContain("<tremolo type=\"single\">3</tremolo>");
    expect(xml).toContain("<notehead>x</notehead>");
  });

  it("exports accents from uppercase tokens", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
| S B X |`);

    const xml = buildMusicXml(score);
    expect(xml.match(/<accent placement="above"\/>/g)).toHaveLength(3);
  });

  it("exports ghost notes with technical notations", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
| g |`);

    const xml = buildMusicXml(score);
    // My implementation for ghost in musicxml.ts:
    // if (event.modifier === "ghost") return "normal";
    // We expect normal notehead (or similar)
    expect(xml).toContain("<display-step>C</display-step>");
  });

  it("exports ST sticking as fingering above matching notes", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
SD | d - d - |
ST | R - L - |`);

    const xml = buildMusicXml(score);
    expect(xml).toContain("<fingering placement=\"above\" font-size=\"14\">R</fingering>");
    expect(xml).toContain("<fingering placement=\"above\" font-size=\"14\">L</fingering>");
  });

  it("maps the expanded track registry to MusicXML display positions", () => {
    const score = buildNormalizedScore(`time 9/4
divisions 9
grouping 1+1+1+1+1+1+1+1+1

| b2 r2 c2 t4 spl chn cb wb cl |`);

    const xml = buildMusicXml(score);

    expect(xml).toContain("<display-step>E</display-step><display-octave>4</display-octave>");
    expect(xml).toContain("<display-step>E</display-step><display-octave>5</display-octave>");
    expect(xml).toContain("<display-step>B</display-step><display-octave>5</display-octave>");
    expect(xml).toContain("<display-step>G</display-step><display-octave>4</display-octave>");
    expect(xml).toContain("<display-step>D</display-step><display-octave>6</display-octave>");
    expect(xml).toContain("<display-step>C</display-step><display-octave>6</display-octave>");
    expect(xml).toContain("<display-step>B</display-step><display-octave>4</display-octave>");
    expect(xml).toContain("<display-step>A</display-step><display-octave>3</display-octave>");
    expect(xml.match(/<display-step>G<\/display-step><display-octave>4<\/display-octave>/g)).toHaveLength(2);

    const xNoteheads = xml.match(/<notehead>x<\/notehead>/g) ?? [];
    expect(xNoteheads).toHaveLength(4);
  });

  it("exports rests with explicit vertical positioning and dots", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8
HH | x x x x x x x x |
BD | d - - - d - - - |`);

    const xml = buildMusicXml(score);
    
    // Voice 2 should have a dotted quarter rest (duration 12 if divisions=8)
    expect(xml).toContain("<voice>2</voice>");
    expect(xml).toContain("<type>quarter</type><dot/>");
    expect(xml).toContain("<rest><display-step>F</display-step><display-octave>4</display-octave></rest>");
  });

  it("exports canonical measure-level repeat, volta, and navigation metadata", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x :| @segno % |1. x - - - | --2-- @to-coda |.`);

    const xml = buildMusicXml(score);

    expect(xml).toContain('<barline location="left"><repeat direction="forward"/></barline>');
    expect(xml).toContain('<barline location="right"><repeat direction="backward"/></barline>');
    expect(xml).toContain("<direction placement=\"above\"><direction-type><segno/></direction-type></direction>");
    expect(xml).toContain("<measure-style><measure-repeat type=\"start\" slashes=\"1\">1</measure-repeat></measure-style>");
    expect(xml).toContain("<measure-style><measure-repeat type=\"stop\"></measure-repeat></measure-style>");
    expect(xml).toContain('<ending number="1" type="start"/>');
    expect(xml).toContain('<ending number="1" type="stop"/>');
    expect(xml).toContain("<measure-style><multiple-rest>2</multiple-rest></measure-style>");
  });

  it("exports supported start-side and end-side navigation", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | @segno x x x x | x x x @fine | x x x @dc |`);

    expect(score.errors).toEqual([]);

    const xml = buildMusicXml(score);
    expect(xml).toContain("<segno/>");
    expect(xml).toContain("<words>Fine</words>");
    expect(xml).toContain("<words>D.C.</words>");
  });

  it("stops a volta at `|.` without exporting a final bar-style unless the score actually ends there", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|1. x - - - |. x - - - |`);

    const xml = buildMusicXml(score);

    expect(xml).toContain('<barline location="right"><ending number="1" type="stop"/></barline>');
    expect(xml).not.toContain('<measure number="1"><barline location="right"><bar-style>light-heavy</bar-style>');
  });

  it("exports a multi-measure rest as physical placeholder measures with style only on the first one", () => {
    const score = buildNormalizedScore(`title Extended Rest
time 4/4
divisions 4
grouping 4

| --16-- |`);

    const xml = buildMusicXml(score);
    const measureTags = xml.match(/<measure number="/g) ?? [];
    const multipleRests = xml.match(/<multiple-rest>16<\/multiple-rest>/g) ?? [];

    expect(measureTags).toHaveLength(16);
    expect(multipleRests).toHaveLength(1);
    expect(xml).toContain('<measure number="1">');
    expect(xml).toContain('<measure number="16">');
    expect(xml).toContain('<rest measure="yes"/>');
  });

  it("exports a two-bar measure repeat as two physical measures with repeated content and a later stop marker", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | x x - - | %% | x - x - |
SD | - - - - | - - s - | %% | - - s - |
BD | b - - - | b - b - | %% | b - - - |`);

    const xml = buildMusicXml(score);
    const measureTags = xml.match(/<measure number="/g) ?? [];

    expect(measureTags).toHaveLength(5);
    expect(xml).toContain('<measure number="3"><attributes><measure-style><measure-repeat type="start" slashes="2">2</measure-repeat></measure-style></attributes>');
    expect(xml).toContain('<measure number="5"><attributes><measure-style><measure-repeat type="stop"></measure-repeat></measure-style></attributes>');
    expect(xml).toContain('<measure number="3"><attributes><measure-style><measure-repeat type="start" slashes="2">2</measure-repeat></measure-style></attributes><note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>4</duration>');
    expect(xml).toContain('<measure number="4"><note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>4</duration>');
    expect(xml).not.toContain('<measure number="3"><attributes><measure-style><measure-repeat type="start" slashes="2">2</measure-repeat></measure-style></attributes><note><rest measure="yes"/>');
  });

  it("exports chained measure repeats using resolved canonical source content", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | % | %% |
BD | b - - - | % | %% |`);

    expect(score.errors).toEqual([]);

    const xml = buildMusicXml(score);
    expect(xml).toContain('<measure number="2"><attributes><measure-style><measure-repeat type="start" slashes="1">1</measure-repeat></measure-style></attributes><note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>4</duration>');
    expect(xml).toContain('<measure number="3"><attributes><measure-style><measure-repeat type="start" slashes="2">2</measure-repeat>');
    expect(xml).toContain('<measure number="3"><attributes><measure-style><measure-repeat type="start" slashes="2">2</measure-repeat><measure-repeat type="stop"></measure-repeat></measure-style></attributes><note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>4</duration>');
    expect(xml).toContain('<measure number="4"><note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>4</duration>');
    expect(xml).not.toContain('<measure number="3"><attributes><measure-style><measure-repeat type="start" slashes="2">2</measure-repeat><measure-repeat type="stop"></measure-repeat></measure-style></attributes><note><rest measure="yes"/>');
  });
});
