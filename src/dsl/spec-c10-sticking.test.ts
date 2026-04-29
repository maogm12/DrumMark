import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { buildMusicXml } from "./musicxml";

describe("spec C10: sticking semantics", () => {
  it("normalizes ST tokens as sticking events at the same start positions as the target notes", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
SD | d - d - |
ST | R - L - |`);

    expect(score.errors).toEqual([]);

    const stickings = score.measures[0].events
      .filter((event) => event.kind === "sticking")
      .map((event) => ({
        track: event.track,
        glyph: event.glyph,
        start: `${event.start.numerator}/${event.start.denominator}`,
        duration: `${event.duration.numerator}/${event.duration.denominator}`,
      }));

    expect(stickings).toEqual([
      { track: "ST", glyph: "R", start: "0/1", duration: "1/4" },
      { track: "ST", glyph: "L", start: "1/2", duration: "1/4" },
    ]);
  });

  it("attaches one sticking fingering to every note at the same start across voices and same-voice chords", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | d - - - |
SD | d - - - |
BD | d - - - |
ST | R - - - |`);

    expect(score.errors).toEqual([]);

    const xml = buildMusicXml(score);
    expect(xml.match(/<fingering placement="above" font-size="14">R<\/fingering>/g)).toHaveLength(3);
    expect(xml.match(/<note>[\s\S]*?<fingering placement="above" font-size="14">R<\/fingering>[\s\S]*?<\/note>/g)).toHaveLength(3);
  });

  it("joins multiple sticking glyphs at one start and attaches the full annotation to each simultaneous note", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
HH | d+SD:d - - - |
ST | R+L - - - |`);

    expect(score.errors).toEqual([]);

    const xml = buildMusicXml(score);
    expect(xml.match(/<fingering placement="above" font-size="14">R L<\/fingering>/g)).toHaveLength(2);
    expect(xml).not.toContain("<fingering placement=\"above\" font-size=\"14\">R</fingering>");
  });

  it("ignores sticking starts that have no matching note in MusicXML export", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
SD | d - - - |
ST | R - L - |`);

    expect(score.errors).toEqual([]);

    const xml = buildMusicXml(score);
    expect(xml).toContain("<fingering placement=\"above\" font-size=\"14\">R</fingering>");
    expect(xml).not.toContain("<fingering placement=\"above\" font-size=\"14\">L</fingering>");
    expect(xml.match(/<note>[\s\S]*?<fingering placement="above" font-size="14">R<\/fingering>[\s\S]*?<\/note>/g)).toHaveLength(1);
  });
});
