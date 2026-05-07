// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { Glyphs, StaveHairpin, StaveNote, Stem } from "vexflow";
import { buildNormalizedScore } from "../dsl/normalize";
import { renderScoreToSvg } from "./renderer";

describe("VexFlow render probe", () => {
  it("renders the expanded track registry without falling back to stale mappings", async () => {
    const score = buildNormalizedScore(`time 9/4
divisions 9
grouping 1+1+1+1+1+1+1+1+1

| b2 r2 c2 t4 spl chn cb wb cl |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain(Glyphs.segno);
    expect(svg).toContain("To");
    expect(svg).toContain(Glyphs.coda);
  });

  it("renders hairpins through VexFlow StaveHairpin", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | d < d d ! |`);

    const hairpinSpy = vi.spyOn(StaveHairpin.prototype, "draw");
    const renderOptionsSpy = vi.spyOn(StaveHairpin.prototype, "setRenderOptions");

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hairpinOffsetY: 9,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(hairpinSpy).toHaveBeenCalled();
    expect(renderOptionsSpy).toHaveBeenCalledWith(expect.objectContaining({ yShift: 9 }));
    hairpinSpy.mockRestore();
    renderOptionsSpy.mockRestore();
  });

  it("ends a carry-forward hairpin on the note before a later-system closing `!`", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | < d d d d | d d d d | d d d d | d d d d | d d d d | d d d d | ! d d d d |`);

    const hairpinSpy = vi.spyOn(StaveHairpin.prototype, "draw");

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(score.errors).toEqual([]);
    expect(hairpinSpy).toHaveBeenCalledTimes(1);
    hairpinSpy.mockRestore();
  });

  it("renders a cross-system hairpin as continued slices of one long wedge", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | < d d d d | d d d d | d d d d | d d d d | d d d d | d d d d | d d ! d d |`);

    const hairpinSpy = vi.spyOn(StaveHairpin.prototype, "draw");
    const renderOptionsSpy = vi.spyOn(StaveHairpin.prototype, "setRenderOptions");

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(score.errors).toEqual([]);
    expect(hairpinSpy).toHaveBeenCalledTimes(2);
    expect(renderOptionsSpy).toHaveBeenCalledTimes(2);
    expect(svg).toContain('clipPathUnits="userSpaceOnUse"');
    expect(svg).toContain('clip-path="url(#hairpin-clip-');

    const firstSegment = renderOptionsSpy.mock.calls[0]?.[0];
    const secondSegment = renderOptionsSpy.mock.calls[1]?.[0];
    expect(firstSegment?.rightShiftPx).toBeGreaterThan(0);
    expect(secondSegment?.leftShiftPx).toBeLessThan(0);
    expect(secondSegment?.rightShiftPx).toBe(0);

    hairpinSpy.mockRestore();
    renderOptionsSpy.mockRestore();
  });

  it("renders fine and dc/ds family navigation above the stave on the same row as symbols", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| @segno x x x x | x x x x @fine | x x x x @dc | x x x x @ds |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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

| x - - - | x - - - |1. x - - - | x - - - |

| x - - - |. x - - - |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    expect(svg).toContain(">1.</text>");
    const overlayYs = [...svg.matchAll(/<g class="vf-volta-overlay"[^>]*>[\s\S]*?<rect [^>]*?y="([0-9.]+)" [^>]*?height="1"[^>]*?>/g)]
      .map((match) => Number(match[1]));

    expect(overlayYs).toHaveLength(2);
    // Increased thresholds to accommodate staffScale shifts
    expect(overlayYs[0]).toBeLessThan(300);
    expect(overlayYs[1]).toBeGreaterThan(overlayYs[0]!);
  });

  it("keeps adjacent volta spans on the same system at one shared height", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x |1. x x x x :|2. x x x x |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: true,
    });

    const overlayYs = [...svg.matchAll(/<g class="vf-volta-overlay"[^>]*>[\s\S]*?<rect [^>]*?y="([0-9.]+)" [^>]*?height="1"[^>]*?>/g)]
      .map((match) => Number(match[1]));

    expect(overlayYs).toHaveLength(2);
    expect(overlayYs[0]).toBe(overlayYs[1]);
  });

  it("lets volta gap control how close the bracket sits to the notes", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x |1. x x x x :|2. x x x x |`);

    const compactSvg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      voltaSpacing: 0,
      hideVoice2Rests: true,
    });

    const looseSvg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      voltaSpacing: 16,
      hideVoice2Rests: true,
    });

    const compactY = Number(compactSvg.match(/<g class="vf-volta-overlay"[^>]*>[\s\S]*?<rect [^>]*?y="([0-9.]+)" [^>]*?height="1"/)?.[1]);
    const looseY = Number(looseSvg.match(/<g class="vf-volta-overlay"[^>]*>[\s\S]*?<rect [^>]*?y="([0-9.]+)" [^>]*?height="1"/)?.[1]);

    expect(compactY).toBeGreaterThan(looseY);
  });

  it("decouples tempo positioning from volta gap", async () => {
    const score = buildNormalizedScore(`tempo 120\ntime 4/4\ndivisions 4\n\n| x x x x |`);

    const compactSvg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      voltaSpacing: -15,
      hideVoice2Rests: true,
    } as any);

    const looseSvg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      voltaSpacing: 15,
      hideVoice2Rests: true,
    } as any);

    const getTempoY = (svg: string) => {
      // VexFlow 5 might not use a specific class for StaveTempo group.
      // We look for the text "120" and capture its Y coordinate.
      const match = svg.match(/<text[^>]*y="([0-9.]+)"[^>]*>[^<]*120/);
      return match ? Number(match[1]) : null;
    };

    const compactTempoY = getTempoY(compactSvg);
    const looseTempoY = getTempoY(looseSvg);

    expect(compactTempoY).not.toBeNull();
    expect(looseTempoY).not.toBeNull();
    expect(compactTempoY).toBe(looseTempoY);
  });

  it("stacks interior navigation above accent and sticking modifiers", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | X X @to-coda X X |
ST | R - L - |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staffLineYs = [...svg.matchAll(/<path fill="none" d="M[0-9.]+ ([0-9.]+)[^>]+>/g)]
      .map((match) => Number(match[1]));

    expect(staffLineYs).toHaveLength(10);
    const uniqueYs = Array.from(new Set(staffLineYs));
    expect(uniqueYs).toHaveLength(10);
    // Verify we have lines starting at significantly different vertical positions
    const sortedYs = uniqueYs.sort((a, b) => a - b);
    expect(sortedYs[9]! - sortedYs[0]!).toBeGreaterThan(100);
  });

  it("centers a one-bar repeat within its physical measure", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | x - - - | % |
BD | b - - - | % |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staveMatches = [...svg.matchAll(/<path fill="none" d="M([0-9.]+) [0-9.]+L([0-9.]+) [0-9.]+"[^>]*>/g)];
    const repeatMatch = svg.match(/<g class="vf-glyphNote"[^>]*><text[^>]*x="([0-9.]+)" y="[0-9.]+"><\/text><\/g>/);

    expect(staveMatches).toHaveLength(10);
    expect(repeatMatch).not.toBeNull();

    const secondStaveStart = Number(staveMatches[5]?.[1]);
    const secondStaveEnd = Number(staveMatches[5]?.[2]);
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staveMatches = [...svg.matchAll(/<path fill="none" d="M([0-9.]+) [0-9.]+L([0-9.]+) [0-9.]+"[^>]*>/g)];
    const repeatMatch = svg.match(/<g class="vf-glyphNote"[^>]*><text[^>]*x="([0-9.]+)" y="[0-9.]+"><\/text><\/g>/);

    expect(staveMatches).toHaveLength(20);
    expect(repeatMatch).not.toBeNull();

    const thirdStaveStart = Number(staveMatches[10]?.[1]);
    const fourthStaveEnd = Number(staveMatches[15]?.[2]);
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
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const hhNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" [^>]*y="[0-9.]+"[^>]*><\/text>/g)]
      .map((match) => Number(match[1]));

    const bdNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" [^>]*y="[0-9.]+"[^>]*><\/text>/g)]
      .map((match) => Number(match[1]));

    expect(hhNoteXs).toHaveLength(8);
    expect(bdNoteXs).toHaveLength(2);
    expect(bdNoteXs[0]).toBeCloseTo(hhNoteXs[0]!, 2);
    expect(bdNoteXs[1]).toBeCloseTo(hhNoteXs[4]!, 2);
  });

  it("collapses an empty upper voice into a single whole-rest glyph", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 2+2

BD | b - - - |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staveNotes = svg.match(/class="vf-stavenote"/g) ?? [];
    expect(staveNotes).toHaveLength(4);
  });

  it("collapses a shown empty lower voice into a single whole-rest glyph", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
grouping 2+2

HH | x x x x |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
    });

    const staveNotes = svg.match(/class="vf-stavenote"/g) ?? [];
    expect(staveNotes).toHaveLength(5);
  });

  it("gives longer starting durations more horizontal space than later shorter starts", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8
grouping 2+2

HH | x* x x x x x x |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
      durationSpacingCompression: 0.6,
    });

    const hhNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" [^>]*y="[0-9.]+"[^>]*><\/text>/g)]
      .map((match) => Number(match[1]));

    expect(hhNoteXs).toHaveLength(7);
    const quarterLikeGap = hhNoteXs[1]! - hhNoteXs[0]!;
    const eighthLikeGap = hhNoteXs[2]! - hhNoteXs[1]!;
    expect(quarterLikeGap).toBeGreaterThan(eighthLikeGap);
  });

  it("keeps cross-voice onsets aligned after duration-weighted spacing is applied", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8
grouping 2+2

HH | x* x x x x x x |
BD | - - b - - - - - |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
      durationSpacingCompression: 0.6,
    });

    const hhNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" [^>]*y="[0-9.]+"[^>]*><\/text>/g)]
      .map((match) => Number(match[1]));
    const bdNoteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" [^>]*y="[0-9.]+"[^>]*><\/text>/g)]
      .map((match) => Number(match[1]));

    expect(hhNoteXs).toHaveLength(7);
    expect(bdNoteXs).toHaveLength(1);
    expect(bdNoteXs[0]).toBeCloseTo(hhNoteXs[1]!, 2);
  });

  it("does not over-expand the first short onset in compact mixed-slash notation", async () => {
    const score = buildNormalizedScore(`time 4/4
note 1/8
grouping 1+1+1+1

| s/ss/ ss ss ss |`);

    const svg = await renderScoreToSvg(score, {
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      headerStaffSpacing: 2.8,
      systemSpacing: 1,
      stemLength: 30,
      hideVoice2Rests: false,
      durationSpacingCompression: 0.6,
    });

    const noteXs = [...svg.matchAll(/<text[^>]*x="([0-9.]+)" [^>]*y="[0-9.]+"[^>]*><\/text>/g)]
      .map((match) => Number(match[1]));

    expect(noteXs.length).toBeGreaterThanOrEqual(4);
    const firstGap = noteXs[1]! - noteXs[0]!;
    const secondGap = noteXs[2]! - noteXs[1]!;
    expect(firstGap).toBeLessThanOrEqual(secondGap * 1.1);
  });
});
