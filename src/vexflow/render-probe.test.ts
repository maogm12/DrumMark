// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
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
      pageScale: 1.0,
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("vf-stavenote");
  });

  it("renders canonical structural intent without crashing the VexFlow path", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

|: x x x x :| @segno % |1. x - - - | @to-coda --2-- |.`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      pageScale: 1.0,
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("Segno");
    expect(svg).toContain("To Coda");
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
      pageScale: 1.0,
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
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
      pageScale: 1.0,
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
      hideVoice2Rests: true,
    });

    expect(svg).toContain("<svg");
    expect(svg.match(/>R<\/text>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(svg.match(/>L<\/text>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("keeps lower-voice dotted rests aligned to the correct eighth-note slot", async () => {
    const score = buildNormalizedScore(`time 4/4
divisions 8

HH | x x x x x x x x |
BD | p - - - p - - - |`);

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      pageScale: 1.0,
      titleTopPadding: 3.6,
      titleSubtitleGap: 1.2,
      titleStaffGap: 2.8,
      systemSpacing: 1,
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
