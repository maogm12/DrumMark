import type { NormalizedScore, NormalizedMeasure, NormalizedEvent } from "../dsl/types";
import { trackFamily } from "./layoutMetrics";

// ── Public API ───────────────────────────────────────────────────

export function renderScoreToSvg(
  score: NormalizedScore,
  _options?: { staffScale?: number; pageWidth?: number; showTitle?: boolean },
): string {
  const pageWidth = _options?.pageWidth ?? 612;
  const staffScale = _options?.staffScale ?? 0.75;
  const showTitle = _options?.showTitle ?? true;
  const marginLeft = 50;
  const marginRight = 50;
  const marginTop = 30;
  const staffHeightPx = 40 * staffScale;
  const staffSpace = staffHeightPx / 4;

  let currentY = marginTop;
  if (showTitle && (score.header?.title || score.ast?.headers?.title)) {
    currentY += 30;
  }

  // Measure layout
  let measures: { m: NormalizedMeasure; x: number; width: number }[] = [];
  let cursorX = marginLeft + 70;
  const usableWidth = pageWidth - marginLeft - marginRight - 70;

  for (const measure of score.measures) {
    const width = Math.max((measure.events.length || 4) * 14 * staffScale, 60);
    if (cursorX + width > marginLeft + usableWidth && measures.length > 0) {
      currentY += staffHeightPx + 60;
      cursorX = marginLeft + 70;
    }
    measures.push({ m: measure, x: cursorX, width });
    cursorX += width;
  }

  const totalHeight = currentY + staffHeightPx + marginTop + 40;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${totalHeight}" viewBox="0 0 ${pageWidth} ${totalHeight}">`;
  svg += `<defs><style>
    .staff-line { stroke: #666; stroke-width: 0.5; }
    .barline { stroke: #666; stroke-width: 1.2; }
    .notehead { fill: #333; font-family: Bravura,sans-serif; }
    .rest { fill: #333; font-family: Bravura,sans-serif; }
    .stem { stroke: #333; stroke-width: 0.8; }
    .nav-text { fill: #333; font-family: Academico,serif; font-size: 12px; }
    .hairpin { stroke: #333; stroke-width: 0.8; fill: none; }
    .volta-line { stroke: #666; stroke-width: 0.5; fill: none; }
    .tempo-text { fill: #666; font-family: Academico,serif; font-size: 10px; }
  </style></defs>`;

  const headerTitle = (score as any).header?.title ?? score.ast?.headers?.title?.value;
  if (showTitle && headerTitle) {
    svg += `<text x="${pageWidth / 2}" y="${marginTop}" text-anchor="middle" font-family="Academico,serif" font-size="18" fill="#333">${esc(String(headerTitle))}</text>`;
  }
  if (score.header?.tempo) {
    svg += `<text x="${marginLeft + 70}" y="${marginTop + (showTitle ? 22 : 0)}" class="tempo-text">♩ = ${score.header.tempo}</text>`;
  }

  let systemY = marginTop + (showTitle && headerTitle ? 30 : 0);

  for (let mi = 0; mi < measures.length; mi++) {
    const item = measures[mi]!;
    svg += renderStaffLines(item.x, systemY, item.width, staffSpace);
    svg += renderBarline(item.x, systemY, item.m.barline, staffHeightPx);
    svg += renderMeasureContent(item.m, item.x, systemY, item.width, staffSpace);
    svg += renderHairpins(item.m, item.x, systemY, staffSpace, totalHeight);
    svg += renderNavigation(item.m, item.x, systemY, staffSpace, staffHeightPx);
    svg += renderVolta(item.m, item.x, systemY, staffSpace, staffHeightPx);
  }

  // Final barline
  const lastItem = measures[measures.length - 1];
  if (lastItem) {
    svg += renderBarline(lastItem.x + lastItem.width, systemY, "final", staffHeightPx);
  }

  svg += "</svg>";
  return svg;
}

// ── Staff Lines ─────────────────────────────────────────────────

function renderStaffLines(x: number, y: number, width: number, staffSpace: number): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += `<line x1="${x - 5}" y1="${y + i * staffSpace}" x2="${x + width + 5}" y2="${y + i * staffSpace}" class="staff-line"/>`;
  }
  return s;
}

// ── Barlines ─────────────────────────────────────────────────────

function renderBarline(x: number, y: number, type?: string | null, h?: number): string {
  const H = h ?? 30;
  switch (type) {
    case "double": case "final":
      return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + H}" class="barline"/>`
        + `<line x1="${x + 3}" y1="${y}" x2="${x + 3}" y2="${y + H}" class="barline"/>`;
    case "repeat-start":
      return `<line x1="${x + 3}" y1="${y}" x2="${x + 3}" y2="${y + H}" class="barline"/>`
        + `<line x1="${x + 8}" y1="${y}" x2="${x + 8}" y2="${y + H}" class="barline"/>`
        + `<text x="${x + 14}" y="${y + H / 2 + 4}" class="nav-text" text-anchor="middle">:</text>`;
    case "repeat-end":
      return `<text x="${x + 4}" y="${y + H / 2 + 4}" class="nav-text" text-anchor="middle">:</text>`
        + `<line x1="${x + 10}" y1="${y}" x2="${x + 10}" y2="${y + H}" class="barline"/>`
        + `<line x1="${x + 15}" y1="${y}" x2="${x + 15}" y2="${y + H}" class="barline"/>`;
    case "repeat-both":
      return renderBarline(x, y, "repeat-end", H) + renderBarline(x + 24, y, "repeat-start", H);
    default:
      return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + H}" class="barline"/>`;
  }
}

// ── Measure Content ──────────────────────────────────────────────

function renderMeasureContent(
  m: NormalizedMeasure, measureX: number, staffY: number, _w: number, ss: number,
): string {
  let s = "";
  let px = measureX + 10;
  for (const ev of m.events) {
    px += 14;
    const y = noteY(ev.track, staffY, ss);
    const glyph = noteGlyph(ev);
    s += `<text x="${px}" y="${y + ss * 0.7}" class="notehead" font-size="${ss * 2.5}px" text-anchor="middle">${glyph}</text>`;
    const up = ev.voice !== 2;
    s += `<line x1="${px + ss * 0.8}" y1="${y - (up ? ss * 2.5 : 0)}" x2="${px + ss * 0.8}" y2="${y + (up ? 0 : ss * 2.5)}" class="stem"/>`;
    // Modifier annotations
    if (ev.modifiers) {
      for (const mod of ev.modifiers) {
        if (mod === "accent") s += `<text x="${px}" y="${y - ss * 1.5}" text-anchor="middle" font-size="${ss * 2}px" fill="#333">></text>`;
        if (mod === "ghost") s += `<text x="${px - ss * 0.6}" y="${y + ss * 0.5}" font-size="${ss * 1.5}px" fill="#999">(</text><text x="${px + ss * 0.6}" y="${y + ss * 0.5}" font-size="${ss * 1.5}px" fill="#999">)</text>`;
      }
    }
  }
  return s;
}

// ── Hairpins ─────────────────────────────────────────────────────

function renderHairpins(m: NormalizedMeasure, measureX: number, staffY: number, ss: number, _totalH: number): string {
  let s = "";
  for (const h of m.hairpins || []) {
    const x1 = measureX + 10;
    const x2 = measureX + 50;
    const y = staffY + ss * 10;
    const open = (h as any).kind === "crescendo" || (h as any).kind === "Crescendo" || (h as any).type === "crescendo";
    s += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y - (open ? 6 : 0)}" class="hairpin"/>`;
    s += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y + (open ? 0 : 6)}" class="hairpin"/>`;
  }
  return s;
}

// ── Navigation Markers ───────────────────────────────────────────

function renderNavigation(m: NormalizedMeasure, measureX: number, staffY: number, ss: number, staffH: number): string {
  let s = "";
  if (m.startNav) {
    const kind = (m.startNav as any).kind ?? m.startNav;
    const label = kind === "segno" ? "\u{E047}" : kind === "coda" ? "\u{E048}" : kind;
    s += `<text x="${measureX + 4}" y="${staffY - ss * 1.5}" class="nav-text" font-family="Bravura,serif" font-size="${ss * 2.5}px">${label}</text>`;
  }
  if (m.endNav) {
    const kind = (m.endNav as any).kind ?? m.endNav;
    const label = kind === "fine" ? "Fine" : kind === "dc" ? "D.C." : kind === "ds" ? "D.S." : kind;
    s += `<text x="${measureX + 30}" y="${staffY + staffH + ss * 2}" class="nav-text" text-anchor="start">${label}</text>`;
  }
  return s;
}

// ── Volta Brackets ───────────────────────────────────────────────

function renderVolta(m: NormalizedMeasure, measureX: number, staffY: number, ss: number, _staffH: number): string {
  let s = "";
  if ((m as any).volta?.indices) {
    const idx = (m as any).volta.indices.join(",");
    s += `<text x="${measureX + 4}" y="${staffY - ss * 3}" class="nav-text">${idx}.</text>`;
    s += `<line x1="${measureX + 8}" y1="${staffY - ss * 3.5}" x2="${measureX + 50}" y2="${staffY - ss * 3.5}" class="volta-line"/>`;
    s += `<line x1="${measureX + 8}" y1="${staffY - ss * 3.5}" x2="${measureX + 8}" y2="${staffY - ss * 2}" class="volta-line"/>`;
  }
  return s;
}

// ── Note Y Position ─────────────────────────────────────────────

function noteY(track: string, staffY: number, ss: number): number {
  const pos: Record<string, number> = {
    HH: 0, RC: 1, RC2: 1, C: 2, C2: 2, SPL: -1, CHN: -1,
    T1: 3, T2: 4, T3: 5, T4: 6, SD: 4, BD: 8, BD2: 8, HF: 9,
    ST: -1, CB: 0, WB: 0, CL: 0,
  };
  return staffY + (pos[track] ?? 4) * (ss / 2);
}

// ── Glyph Mapping ────────────────────────────────────────────────

function noteGlyph(ev: NormalizedEvent): string {
  const family = trackFamily(ev.track);
  if (family === "cymbal") return "\u{E0A9}";
  for (const m of ev.modifiers || []) {
    if (m === "open") return "\u{E0B3}";
    if (m === "cross") return "\u{E0A9}";
    if (m === "bell") return "\u{E0DB}";
    if (m === "rim") return "\u{E0CE}";
  }
  return "\u{E0A4}";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
