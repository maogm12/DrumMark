// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { Glyphs, StaveNote, Stem } from "vexflow";
import { buildNormalizedScore } from "../dsl/normalize";
import { renderScoreToSvg } from "./renderer";

describe("VexFlow render probe", () => {
  it("renders the expanded track registry without falling back to stale mappings", async () => {
    const score = buildNormalizedScore(`time 9/4
divisions 9
grouping 1+1+1+1+1+1+1+1+1

| b2 r2 c2 t4 spl chn cb wb cl |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("vf-stavenote");
  });

  it("applies stemLength render options to note construction", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| x - - - |`);

    const stemSpy = vi.spyOn(StaveNote.prototype, "setStemLength");
    const extensionSpy = vi.spyOn(Stem.prototype, "setExtension");

    await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 40,
      hideVoice2Rests: true,
    });

    expect(stemSpy).toHaveBeenCalledWith(40);
    expect(extensionSpy).toHaveBeenCalledWith(40 - Stem.HEIGHT);
    stemSpy.mockRestore();
    extensionSpy.mockRestore();
  });

  it("renders canonical structural intent without crashing the VexFlow path", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| @segno x - - - | x - - - @to-coda |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain(Glyphs.segno);
    expect(svg).toContain("To");
    expect(svg).toContain(Glyphs.coda);
  });

  it("renders fine and dc/ds family navigation above the stave on the same row as symbols", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| @segno x x x x | x x x x @fine | x x x x @dc | x x x x @ds |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain(">Fine</text>");
    expect(svg).toContain(">D.C.</text>");
    expect(svg).toContain(">D.S.</text>");
    expect(svg).toContain('class="vf-edge-navigation edge-navigation-fine"');
    expect(svg).toContain('class="vf-edge-navigation edge-navigation-dc"');
    expect(svg).toContain('class="vf-edge-navigation edge-navigation-ds"');
    expect(svg).toContain('font-family="Academico"');
    expect(svg).toContain(">\uE047</text>");
    expect(svg).toContain('font-family="Bravura"');
    expect(svg).toContain('font-size="20pt"');
  });

  it("continues a volta across systems when the ending spans multiple measures", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| x - - - | x - - - |1. x - - - | x - - - | x - - - |. x - - - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain(">1.</text>");
    const overlayYs = [...svg.matchAll(/<g class="vf-volta-overlay"[\s\S]*?<rect x="[^"]+" y="([0-9.]+)" width="[^"]+" height="1" stroke="none"><\/rect>/g)]
      .map((match) => Number(match[1]));

    expect(overlayYs).toHaveLength(2);
    expect(overlayYs[0]).toBeLessThan(190.5);
    expect(overlayYs[1]).toBeLessThan(390.5);
  });

  it("keeps adjacent volta spans on the same system at one shared height", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x |1. x x x x :|2. x x x x |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    const overlayYs = [...svg.matchAll(/<g class="vf-volta-overlay"[\s\S]*?<rect x="[^"]+" y="([0-9.]+)" width="[^"]+" height="1" stroke="none"><\/rect>/g)]
      .map((match) => Number(match[1]));

    expect(overlayYs).toHaveLength(2);
    expect(overlayYs[0]).toBe(overlayYs[1]);
  });

  it("lets volta gap control how close the bracket sits to the notes", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x |1. x x x x :|2. x x x x |`);

    const compactSvg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      voltaGap: 0,
      hideVoice2Rests: true,
    });

    const looseSvg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      voltaGap: 16,
      hideVoice2Rests: true,
    });

    const compactY = Number(compactSvg.match(/<g class="vf-volta-overlay"[\s\S]*?<rect x="[^"]+" y="([0-9.]+)" width="[^"]+" height="1" stroke="none"><\/rect>/)?.[1] ?? "0");
    const looseY = Number(looseSvg.match(/<g class="vf-volta-overlay"[\s\S]*?<rect x="[^"]+" y="([0-9.]+)" width="[^"]+" height="1" stroke="none"><\/rect>/)?.[1] ?? "0");

    expect(compactY).toBeGreaterThan(looseY);
  });

  it("stacks interior navigation above accent and sticking modifiers", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | X X @to-coda X X |
ST | R - L - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain('class="vf-annotation note-navigation note-navigation-to-coda"');
    expect(svg).toContain(">To</text>");
    expect(svg).toContain(Glyphs.coda);
    expect(svg).toContain(">R</text>");
    expect(svg).toContain(">L</text>");
  });

  it("renders a native multi-measure rest instead of a text label plus whole-rest note", async () => {
    const score = buildNormalizedScore(`title Extended Rest
time 4/4
divisions 4
grouping 4

| --16-- |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).not.toContain("rest x16");
    expect(svg).not.toContain("vf-stavenote");
  });

  it("renders triplet beams without VexFlow beam errors", async () => {
    // Single-slot triplet [1: d d d] with divisions=8: each item is 1/3 of a slot
    // which is 1/24 of the measure (16th note triplet, denominator 24).
    // The duration code must map 1/24 -> "16" (not "q" which would cause
    // "Beams can only be applied to notes shorter than a quarter note" in VexFlow).
    const score = buildNormalizedScore(`time 4/4
divisions 8

T1 | [1: d d d] - - - - - - - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("vf-stavenote");
  });

  it("renders sticking annotations across multiple measures without collapsing to the first bar", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

SD | d - d - | d - d - |
ST | R - L - | R - L - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg.match(/>R<\/text>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(svg.match(/>L<\/text>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("forces a new system when a blank line starts a new paragraph", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - |
BD | b - - - |

HH | x x - - |
BD | b - b - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staffLineYs = [...svg.matchAll(/<path fill="none" d="M50 ([0-9.]+)L850 \1"><\/path>/g)]
      .map((match) => Number(match[1]));

    expect(staffLineYs).toContain(190.5);
    expect(staffLineYs).toContain(390.5);
  });

  it("centers a one-bar repeat within its physical measure", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | % |
BD | b - - - | % |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staveMatches = [...svg.matchAll(/<path fill="none" d="M([0-9.]+) 190\.5L([0-9.]+) 190\.5"><\/path>/g)];
    const repeatMatch = svg.match(/<g class="vf-glyphNote"[^>]*><text[^>]*x="([0-9.]+)" y="210"><\/text><\/g>/);

    expect(staveMatches).toHaveLength(2);
    expect(repeatMatch).not.toBeNull();

    const secondStaveStart = Number(staveMatches[1]?.[1]);
    const secondStaveEnd = Number(staveMatches[1]?.[2]);
    const repeatX = Number(repeatMatch?.[1]);
    const secondStaveWidth = secondStaveEnd - secondStaveStart;
    const relativeX = (repeatX - secondStaveStart) / secondStaveWidth;

    expect(relativeX).toBeGreaterThan(0.4);
    expect(relativeX).toBeLessThan(0.55);
  });

  it("expands a two-bar repeat into two physical measures and centers the symbol across the pair", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | x x - - | %% |
SD | - - - - | - - s - | %% |
BD | b - - - | b - b - | %% |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staveMatches = [...svg.matchAll(/<path fill="none" d="M([0-9.]+) 190\.5L([0-9.]+) 190\.5"><\/path>/g)];
    const repeatMatch = svg.match(/<g class="vf-glyphNote"[^>]*><text[^>]*x="([0-9.]+)" y="210"><\/text><\/g>/);

    expect(staveMatches).toHaveLength(4);
    expect(repeatMatch).not.toBeNull();

    const thirdStaveStart = Number(staveMatches[2]?.[1]);
    const fourthStaveEnd = Number(staveMatches[3]?.[2]);
    const repeatX = Number(repeatMatch?.[1]);
    const pairWidth = fourthStaveEnd - thirdStaveStart;
    const relativeX = (repeatX - thirdStaveStart) / pairWidth;

    expect(relativeX).toBeGreaterThan(0.4);
    expect(relativeX).toBeLessThan(0.55);
  });

  it("keeps lower-voice dotted rests aligned to the correct eighth-note slot", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8

HH | x x x x x x x x |
BD | p - - - p - - - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const hhNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" y="185"><\/text>/g)]
      .map((match) => Number(match[1]));

    const bdNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" y="225"><\/text>/g)]
      .map((match) => Number(match[1]));

    expect(hhNoteXs).toHaveLength(8);
    expect(bdNoteXs).toHaveLength(2);
    expect(bdNoteXs[0]).toBeCloseTo(hhNoteXs[0]!, 2);
    expect(bdNoteXs[1]).toBeCloseTo(hhNoteXs[4]!, 2);
  });
});
