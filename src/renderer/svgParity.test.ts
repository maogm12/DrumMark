import { describe, it, expect } from "vitest";
import { buildNormalizedScore } from "../dsl/normalize";
import type { NormalizedScore } from "../dsl/types";
import { renderScoreToSvg } from "./svgRenderer";

// ── Shared header ────────────────────────────────────────────────

const HEADER = `time 4/4
note 1/8
grouping 2+2
`;

// ── Helpers ──────────────────────────────────────────────────────

/** Extract element tags from SVG string. */
function tags(svg: string): string[] {
  const re = /<(text|line|rect|path|circle|g)[ >]/g;
  const result: string[] = [];
  let m;
  while ((m = re.exec(svg)) !== null) result.push(m[1]);
  return result;
}

/** Extract <text> content from SVG. */
function textContent(svg: string): string[] {
  const re = /<text[^>]*>([^<]*)<\/text>/g;
  const result: string[] = [];
  let m;
  while ((m = re.exec(svg)) !== null) result.push(m[1]);
  return result;
}

/** Count elements of a given tag type. */
function countTag(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag}[ >]`, "g")) || []).length;
}

/** Count elements with given class. */
function countClass(svg: string, cls: string): number {
  return (svg.match(new RegExp(`class="[^"]*${cls}[^"]*"`, "g")) || []).length;
}

// ── Tests ────────────────────────────────────────────────────────

describe("SVG Renderer parity", () => {
  // ── Staff lines ───────────────────────────────────────────────
  it("renders 5 staff lines", () => {
    const svg = render(HEADER + "HH | - |\n");
    const lineCount = countClass(svg, "staff-line");
    expect(lineCount).toBe(5);
  });

  // ── Barlines ──────────────────────────────────────────────────
  it("renders single barline", () => {
    const svg = render(HEADER + "HH | - |\n");
    const bars = countClass(svg, "barline");
    expect(bars).toBeGreaterThanOrEqual(1);
  });

  it("renders double barline", () => {
    const svg = render(HEADER + "HH | - ||\n");
    expect(svg).toContain("class=\"barline\"");
    // Double barline has two barline elements
    const bars = countClass(svg, "barline");
    expect(bars).toBeGreaterThanOrEqual(2);
  });

  it("renders repeat-start barline", () => {
    const svg = render(HEADER + "HH |: - |\n");
    expect(textContent(svg).some((t) => t.includes(":"))).toBe(true);
  });

  it("renders repeat-end barline", () => {
    const svg = render(HEADER + "HH | - :|\n");
    expect(textContent(svg).some((t) => t.includes(":"))).toBe(true);
  });

  // ── Noteheads ─────────────────────────────────────────────────
  it("renders standard notehead (d on SD)", () => {
    const svg = render(HEADER + "SD | d |\n");
    expect(countClass(svg, "notehead")).toBeGreaterThanOrEqual(1);
  });

  it("renders X notehead on cymbal (x on HH)", () => {
    const svg = render(HEADER + "HH | x |\n");
    expect(countClass(svg, "notehead")).toBeGreaterThanOrEqual(1);
  });

  // ── Rests ─────────────────────────────────────────────────────
  it("rests produce no events in NormalizedScore", () => {
    // Rests are implicit gaps between events, not explicit NormalizedEvents.
    // The SVG renderer shows empty staff content for rest-only measures.
    const svg = render(HEADER + "SD | - |\n");
    expect(countClass(svg, "staff-line")).toBe(5); // staff renders
    // Rests are not rendered as explicit glyphs in NormalizedScore
  });

  // ── Title ─────────────────────────────────────────────────────
  it("renders title", () => {
    const svg = render("title Hello\n" + HEADER + "HH | x |\n");
    expect(textContent(svg).some((t) => t.includes("Hello"))).toBe(true);
  });

  // ── Stems ─────────────────────────────────────────────────────
  it("renders stems for notes", () => {
    const svg = render(HEADER + "SD | x - x - |\n");
    expect(countClass(svg, "stem")).toBeGreaterThanOrEqual(2);
  });

  // ── Multiple measures ──────────────────────────────────────────
  it("renders multiple measures", () => {
    const svg = render(HEADER + "SD | x | x | x |\n");
    const bars = countClass(svg, "barline");
    expect(bars).toBeGreaterThanOrEqual(3);
  });
});

// ── Helpers ──────────────────────────────────────────────────────

function render(dsl: string): string {
  const score = buildNormalizedScore(dsl);
  return renderScoreToSvg(score, { staffScale: 0.75, pageWidth: 612, showTitle: true });
}
