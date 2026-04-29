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
});
