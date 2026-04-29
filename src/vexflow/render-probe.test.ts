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
});
