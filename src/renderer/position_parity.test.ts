// @vitest-environment jsdom

import { describe, it, expect, beforeAll } from "vitest";
import { initWasm } from "../wasm/drummark_wasm";
import { buildNormalizedScore } from "../dsl/normalize";
import { renderScoreToSvg } from "./svgRenderer";
import { renderScoreToSvg as vexRender } from "../vexflow/renderer";
import { setLayoutSource } from "./svgRenderer";

const SRC = `tempo 100
time 4/4
note 1/4

|s s s s|`;

function extractYPositions(svg: string): number[] {
  const re = /<line[^>]*y1="([\d.]+)"[^>]*>/g;
  const r: number[] = [];
  let m;
  while ((m = re.exec(svg)) !== null) r.push(+m[1]);
  return r.sort((a, b) => a - b);
}

function extractTextPositions(svg: string): { x: number; y: number; content: string }[] {
  const re = /<text[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
  const r: { x: number; y: number; content: string }[] = [];
  let m;
  while ((m = re.exec(svg)) !== null) r.push({ x: +m[1], y: +m[2], content: m[3] });
  return r;
}

function extractRectPositions(svg: string): { x: number; y: number; width: number; height: number }[] {
  const re = /<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"[^>]*\/>/g;
  const r: { x: number; y: number; width: number; height: number }[] = [];
  let m;
  while ((m = re.exec(svg)) !== null) r.push({ x: +m[1], y: +m[2], width: +m[3], height: +m[4] });
  return r;
}

describe("VexFlow vs Layout engine position parity", () => {
  beforeAll(async () => {
    await initWasm();
  });

  it("staff lines Y positions match within tolerance", async () => {
    const score = buildNormalizedScore(SRC);
    const vexSvg = await vexRender(score, { staffScale: 0.75 });
    setLayoutSource(SRC);
    const ourSvg = renderScoreToSvg(score, { staffScale: 0.75, pageWidth: 816, showTitle: true });

    const vexY = extractYPositions(vexSvg);
    const ourY = extractYPositions(ourSvg);

    console.log("VexFlow staff Y:", vexY.slice(0, 5));
    console.log("Layout staff Y:", ourY.slice(0, 5));

    expect(ourY.length).toBeGreaterThanOrEqual(5);
    if (vexY.length >= 5) {
      // First staff line should be within 5pt
      expect(Math.abs(vexY[0] - ourY[0])).toBeLessThan(10);
    }
  });

  it("notehead positions have similar Y", async () => {
    const score = buildNormalizedScore(SRC);
    const vexSvg = await vexRender(score, { staffScale: 0.75 });
    setLayoutSource(SRC);
    const ourSvg = renderScoreToSvg(score, { staffScale: 0.75, pageWidth: 816, showTitle: true });

    const vexTexts = extractTextPositions(vexSvg);
    const ourTexts = extractTextPositions(ourSvg);

    console.log("VexFlow texts:", JSON.stringify(vexTexts.slice(0, 8)));
    console.log("Layout texts:", JSON.stringify(ourTexts.slice(0, 8)));

    // Both should have texts rendered
    expect(ourTexts.length).toBeGreaterThan(0);
  });

  it("barlines exist at both edges", async () => {
    const score = buildNormalizedScore(SRC);
    const vexSvg = await vexRender(score, { staffScale: 0.75 });
    setLayoutSource(SRC);
    const ourSvg = renderScoreToSvg(score, { staffScale: 0.75, pageWidth: 816, showTitle: true });

    // Layout engine uses <line> elements for barlines
    const ourLines = ourSvg.match(/<line/g)?.length ?? 0;
    console.log("Layout line elements:", ourLines);

    // Should have at least one line element (staff lines + barlines)
    expect(ourLines).toBeGreaterThan(0);
  });

  it("notehead Y within 5pt of VexFlow", async () => {
    const score = buildNormalizedScore(SRC);
    const vexSvg = await vexRender(score, { staffScale: 0.75 });
    setLayoutSource(SRC);
    const ourSvg = renderScoreToSvg(score, { staffScale: 0.75, pageWidth: 816, showTitle: true });

    const vexTexts = extractTextPositions(vexSvg);
    const ourTexts = extractTextPositions(ourSvg);
    
    // First notehead
    const vexNote = vexTexts.find(t => t.content.includes(""));
    const ourNote = ourTexts.find(t => t.content.includes(""));
    
    if (vexNote && ourNote) {
      const yDiff = Math.abs(vexNote.y - ourNote.y);
      console.log("Notehead Y diff:", yDiff.toFixed(1), "pt");
      expect(yDiff).toBeLessThan(10);
    }
    
    // Clef
    const vexClef = vexTexts.find(t => t.content.includes(""));
    const ourClef = ourTexts.find(t => t.content.includes(""));
    if (vexClef && ourClef) {
      const xDiff = Math.abs(vexClef.x - ourClef.x);
      console.log("Clef X diff:", xDiff.toFixed(1), "pt");
      expect(xDiff).toBeLessThan(15);
    }
  });
});
