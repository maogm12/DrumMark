import VexFlow from "vexflow";
import type { NormalizedEvent, NormalizedScore } from "../dsl/types";
import { DEFAULT_RENDER_OPTIONS, type PagePadding, type VexflowRenderOptions } from "./types";
import {
  buildVoiceEntries,
  groupingSegmentIndex,
  groupVoiceEvents,
  isBeamable,
  multiplyFraction,
  subtractFractions,
  voiceForTrack,
  visualDurationForEvent,
  type Fraction,
  type VoiceEntry,
} from "../dsl/logic";
import {
  durationCode,
  instrumentForTrack,
  makeNoteKey,
} from "./notes";
import {
  annotationTextForEvent,
  graceNoteSlash,
  modifierIsGrace,
  tremoloMarksForEvent,
} from "./articulations";

const {
  Renderer,
  Stave,
  StaveTempo,
  BarlineType,
  Formatter,
  Voice,
  StaveNote,
  Dot,
  Beam,
  Articulation,
  GraceNote,
  GraceNoteGroup,
  Annotation,
  ModifierPosition,
  Modifier,
  Tuplet,
  Tremolo,
  Glyphs,
  RepeatNote,
  MultiMeasureRest,
  VoltaType,
  StaveText,
  TextJustification,
  RendererBackends,
  Stem,
} = VexFlow;

const NAV_TEXT_FONT = "Academico";
const NAV_GLYPH_FONT = "Bravura";
const SKYLINE_BUCKET_WIDTH = 4;
const SKYLINE_GAP = 6;
const DEFAULT_VOLTA_GAP = -15;
const NAV_TEXT_SIZE = 12;
const NAV_GLYPH_SIZE = 20;
const VOLTA_TEXT_SIZE = 12;

type RenderMeasure = {
  measure: NormalizedScore["measures"][number];
  kind: "normal" | "measure-repeat-1" | "measure-repeat-2-start" | "measure-repeat-2-stop";
};

type NavSegment = {
  text: string;
  fontFamily: string;
  fontSize: number;
  gapAfter?: number;
};

type SkylineRef = {
  modifier: any;
  width: number;
  height: number;
};

type LayoutNote = {
  note: any;
  aboveRefs: SkylineRef[];
};

type NavAnchor = {
  note: any;
  layoutNote: LayoutNote;
};

type PendingEdgeNav = {
  kind: string;
  x1: number;
  x2: number;
  overlay: NavigationOverlay;
};

type PendingVoltaSpan = {
  x1: number;
  x2: number;
  overlay: VoltaOverlay;
};

type SystemLayoutState = {
  skyline: TopSkyline;
  edgeNavs: PendingEdgeNav[];
  voltaSpans: PendingVoltaSpan[];
};

class TopSkyline {
  private readonly startX: number;
  private readonly bucketWidth: number;
  private readonly buckets: number[];
  private readonly fallbackTop: number;

  constructor(startX: number, endX: number, fallbackTop: number, bucketWidth = SKYLINE_BUCKET_WIDTH) {
    this.startX = startX;
    this.bucketWidth = bucketWidth;
    this.fallbackTop = fallbackTop;
    const bucketCount = Math.max(1, Math.ceil((endX - startX) / bucketWidth));
    this.buckets = Array.from({ length: bucketCount }, () => Number.POSITIVE_INFINITY);
  }

  sample(x1: number, x2: number): number {
    const [start, end] = this.bucketRange(x1, x2);
    let top = Number.POSITIVE_INFINITY;
    for (let i = start; i <= end; i++) {
      top = Math.min(top, this.buckets[i] ?? Number.POSITIVE_INFINITY);
    }
    return Number.isFinite(top) ? top : this.fallbackTop;
  }

  occupy(x1: number, x2: number, topY: number): void {
    const [start, end] = this.bucketRange(x1, x2);
    for (let i = start; i <= end; i++) {
      this.buckets[i] = Math.min(this.buckets[i] ?? Number.POSITIVE_INFINITY, topY);
    }
  }

  private bucketRange(x1: number, x2: number): [number, number] {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const start = Math.max(0, Math.floor((left - this.startX) / this.bucketWidth));
    const end = Math.min(this.buckets.length - 1, Math.floor((right - this.startX) / this.bucketWidth));
    return [start, end];
  }
}

class NavigationAnnotation extends Annotation {
  readonly height: number;
  private readonly segments: NavSegment[];
  private readonly widthEstimate: number;
  private readonly className: string;

  constructor(label: string, segments: NavSegment[], className: string) {
    super(label);
    this.segments = segments;
    this.className = className;
    this.height = Math.max(...segments.map((segment) => segment.fontSize));
    this.widthEstimate = estimateSegmentsWidth(segments);
    this.setFont(NAV_TEXT_FONT, this.height, "");
  }

  override getWidth(): number {
    return this.widthEstimate;
  }

  override draw(): void {
    const ctx = this.checkContext();
    const note = this.checkAttachedNote();
    const { x, y } = computeAnnotationCoordinates(note, this, this.widthEstimate, this.height);
    this.setRendered();
    this.x = x;
    this.y = y;
    ctx.openGroup(`annotation ${this.className}`, this.getAttribute("id"));
    drawSegments(ctx, x, y, this.segments);
    ctx.closeGroup();
  }
}

class NavigationOverlay {
  readonly width: number;
  readonly height: number;

  private context: any;

  constructor(
    readonly className: string,
    private readonly leftX: number,
    private readonly topY: number,
    private readonly segments: NavSegment[],
  ) {
    this.width = estimateSegmentsWidth(segments);
    this.height = Math.max(...segments.map((segment) => segment.fontSize));
  }

  setContext(context: any): this {
    this.context = context;
    return this;
  }

  draw(): void {
    const ctx = this.context;
    if (!ctx) return;
    const baselineY = this.topY + this.height;
    ctx.openGroup(this.className);
    drawSegments(ctx, this.leftX, baselineY, this.segments);
    ctx.closeGroup();
  }
}

class VoltaOverlay {
  readonly height: number;

  private context: any;

  constructor(
    readonly className: string,
    private readonly x1: number,
    private readonly x2: number,
    private readonly topY: number,
    private readonly lineHeight: number,
    private readonly showLeft: boolean,
    private readonly showRight: boolean,
    private readonly label?: string,
  ) {
    this.height = Math.max(lineHeight + VOLTA_TEXT_SIZE + 2, lineHeight);
  }

  setContext(context: any): this {
    this.context = context;
    return this;
  }

  draw(): void {
    const ctx = this.context;
    if (!ctx) return;

    const width = Math.max(0, this.x2 - this.x1);
    ctx.openGroup(this.className);
    ctx.fillRect(this.x1, this.topY, width, 1);
    if (this.showLeft) ctx.fillRect(this.x1, this.topY, 1, this.lineHeight);
    if (this.showRight) ctx.fillRect(this.x2, this.topY, 1, this.lineHeight);
    if (this.label) {
      ctx.setFont(NAV_TEXT_FONT, VOLTA_TEXT_SIZE, "");
      ctx.fillText(this.label, this.x1 + 5, this.topY + VOLTA_TEXT_SIZE + 2);
    }
    ctx.closeGroup();
  }
}

export function endNavText(endNav?: NormalizedScore["measures"][number]["endNav"]): string | null {
  if (!endNav) return null;
  if (endNav.kind === "fine") return "Fine";
  if (endNav.kind === "to-coda") return "To Coda";

  return {
    dc: "D.C.",
    ds: "D.S.",
    "dc-al-fine": "D.C. al Fine",
    "dc-al-coda": "D.C. al Coda",
    "ds-al-fine": "D.S. al Fine",
    "ds-al-coda": "D.S. al Coda",
  }[endNav.kind];
}

export function startNavText(startNav?: NormalizedScore["measures"][number]["startNav"]): string | null {
  if (!startNav) return null;
  return {
    segno: "Segno",
    coda: "Coda",
  }[startNav.kind];
}

export function voltaTypeForMeasure(score: NormalizedScore, measure: NormalizedScore["measures"][number]): number | null {
  const current = measure.volta?.indices.join(",");
  if (!current) return null;

  const previous = score.measures[measure.globalIndex - 1]?.volta?.indices.join(",");
  const next = score.measures[measure.globalIndex + 1]?.volta?.indices.join(",");
  const begins = current !== previous;
  const ends = current !== next || score.measures[measure.globalIndex]?.barline === "repeat-end";

  if (begins && ends) return VoltaType.BEGIN_END;
  if (begins) return VoltaType.BEGIN;
  if (ends) return VoltaType.END;
  return VoltaType.MID;
}

export function measureRepeatGlyph(slashes: number): string {
  return slashes === 2 ? Glyphs.repeat2Bars : Glyphs.repeat1Bar;
}

function leftEdgeBarline(barline: NormalizedScore["measures"][number]["barline"]) {
  if (barline === "repeat-start" || barline === "repeat-both") return "repeat-start";
  return undefined;
}

function rightEdgeBarline(barline: NormalizedScore["measures"][number]["barline"]) {
  if (barline === "repeat-end" || barline === "repeat-both") return "repeat-end";
  if (barline === "double" || barline === "final") return barline;
  return undefined;
}

function buildRenderMeasures(score: NormalizedScore): RenderMeasure[] {
  const expanded: RenderMeasure[] = [];

  for (const measure of score.measures) {
    if (measure.measureRepeat?.slashes === 2) {
      expanded.push({
        measure: {
          ...measure,
          startNav: measure.startNav,
          endNav: undefined,
          barline: leftEdgeBarline(measure.barline),
        },
        kind: "measure-repeat-2-start",
      });
      expanded.push({
        measure: {
          ...measure,
          startNav: undefined,
          endNav: measure.endNav,
          barline: rightEdgeBarline(measure.barline),
        },
        kind: "measure-repeat-2-stop",
      });
      continue;
    }

    expanded.push({
      measure,
      kind: measure.measureRepeat?.slashes === 1 ? "measure-repeat-1" : "normal",
    });
  }

  return expanded;
}

function applyStaveBarlines(stave: any, measure: NormalizedScore["measures"][number], score: NormalizedScore) {
  switch (measure.barline) {
    case "repeat-start":
      stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      break;
    case "repeat-end":
      stave.setEndBarType(BarlineType.REPEAT_END);
      break;
    case "repeat-both":
      stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      stave.setEndBarType(BarlineType.REPEAT_END);
      break;
    case "double":
      stave.setEndBarType(BarlineType.DOUBLE);
      break;
    case "final":
      stave.setEndBarType(BarlineType.END);
      break;
    default:
      break;
  }

  const voltaType = voltaTypeForMeasure(score, measure);
  if (voltaType !== null && (voltaType === VoltaType.END || voltaType === VoltaType.BEGIN_END)) {
    if (measure.barline === undefined) {
      const hasNext = score.measures[measure.globalIndex + 1] !== undefined;
      stave.setEndBarType(hasNext ? BarlineType.REPEAT_END : BarlineType.END);
    }
  }
}

function estimateTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const perChar = fontFamily === NAV_GLYPH_FONT ? 0.95 : 0.62;
  return Math.max(fontSize, text.length * fontSize * perChar);
}

function estimateSegmentsWidth(segments: NavSegment[]): number {
  return segments.reduce((sum, segment) => sum + estimateTextWidth(segment.text, segment.fontSize, segment.fontFamily) + (segment.gapAfter ?? 0), 0);
}

function drawSegments(ctx: any, startX: number, baselineY: number, segments: NavSegment[]): void {
  let cursorX = startX;
  for (const segment of segments) {
    ctx.setFont(segment.fontFamily, segment.fontSize, "");
    ctx.fillText(segment.text, cursorX, baselineY);
    cursorX += estimateTextWidth(segment.text, segment.fontSize, segment.fontFamily) + (segment.gapAfter ?? 0);
  }
}

function navAnchorKeys(navAnchors: Map<string, NavAnchor>): string[] {
  return [...navAnchors.keys()].sort((a, b) => {
    const [an, ad] = a.split("/").map(Number);
    const [bn, bd] = b.split("/").map(Number);
    return an / ad - bn / bd;
  });
}

function segmentsForStartNav(startNav: NonNullable<NormalizedScore["measures"][number]["startNav"]>): NavSegment[] {
  return [{
    text: startNav.kind === "segno" ? Glyphs.segno : Glyphs.coda,
    fontFamily: NAV_GLYPH_FONT,
    fontSize: NAV_GLYPH_SIZE,
  }];
}

function segmentsForEndNav(endNav: NonNullable<NormalizedScore["measures"][number]["endNav"]>): NavSegment[] {
  if (endNav.kind === "to-coda") {
    return [
      { text: "To", fontFamily: NAV_TEXT_FONT, fontSize: NAV_TEXT_SIZE, gapAfter: 6 },
      { text: Glyphs.coda, fontFamily: NAV_GLYPH_FONT, fontSize: NAV_GLYPH_SIZE },
    ];
  }

  return [{
    text: endNavText(endNav) ?? "",
    fontFamily: NAV_TEXT_FONT,
    fontSize: NAV_TEXT_SIZE,
  }];
}

function addSkylineRef(layoutNote: LayoutNote, modifier: any, width: number, height: number): void {
  layoutNote.aboveRefs.push({ modifier, width, height });
}

function addNoteNavigationModifier(layoutNote: LayoutNote, segments: NavSegment[], className: string, xShift = 0): void {
  const modifier = new NavigationAnnotation(
    segments.map((segment) => segment.text).join(" "),
    segments,
    className,
  )
    .setJustification("center")
    .setVerticalJustification("above");
  modifier.setXShift(xShift);
  layoutNote.note.addModifier(modifier, 0);
  addSkylineRef(layoutNote, modifier, estimateSegmentsWidth(segments), modifier.height);
}

function attachInteriorNavigation(
  measure: NormalizedScore["measures"][number],
  navAnchors: Map<string, NavAnchor>,
): void {
  if (measure.startNav && measure.startNav.anchor !== "left-edge") {
    const key = `${measure.startNav.anchor.eventAfter.numerator}/${measure.startNav.anchor.eventAfter.denominator}`;
    const anchor = navAnchors.get(key);
    if (anchor) {
      addNoteNavigationModifier(anchor.layoutNote, segmentsForStartNav(measure.startNav), `note-navigation note-navigation-${measure.startNav.kind}`);
    }
  }

  if (measure.endNav && measure.endNav.anchor !== "right-edge") {
    const key = `${measure.endNav.anchor.eventBefore.numerator}/${measure.endNav.anchor.eventBefore.denominator}`;
    const anchor = navAnchors.get(key);
    if (anchor) {
      addNoteNavigationModifier(anchor.layoutNote, segmentsForEndNav(measure.endNav), `note-navigation note-navigation-${measure.endNav.kind}`);
    }
  }
}

function computeAnnotationCoordinates(note: any, annotation: any, textWidth: number, textHeight: number) {
  const stemDirection = note.hasStem() ? note.getStemDirection() : Stem.UP;
  const start = note.getModifierStartXY(ModifierPosition.ABOVE, annotation.index ?? 0);

  let x = start.x - textWidth / 2;
  const justification = annotation.getJustification();
  if (justification === Annotation.HorizontalJustify.LEFT) x = start.x;
  else if (justification === Annotation.HorizontalJustify.RIGHT) x = start.x - textWidth;
  else if (justification === Annotation.HorizontalJustify.CENTER_STEM) x = note.getStemX() - textWidth / 2;

  const textLine = annotation.textLine ?? 0;
  let spacing = 0;
  let stemExt = { topY: Number.POSITIVE_INFINITY, baseY: Number.NEGATIVE_INFINITY };
  const stave = note.checkStave();
  if (note.hasStem()) {
    stemExt = note.checkStem().getExtents();
    spacing = stave.getSpacingBetweenLines();
  }

  let y = Math.min(...note.getYs()) - (textLine + 1) * 10;
  if (annotation.verticalJustification === Annotation.VerticalJustify.BOTTOM) {
    const ys = note.getYs();
    y = ys.reduce((a: number, b: number) => (a > b ? a : b));
    y += (textLine + 1) * 10 + textHeight;
    if (note.hasStem() && stemDirection === Stem.DOWN) {
      y = Math.max(y, stemExt.topY + textHeight + spacing * textLine);
    }
  } else if (annotation.verticalJustification === Annotation.VerticalJustify.CENTER) {
    const yt = note.getYForTopText(textLine) - 1;
    const yb = stave.getYForBottomText(textLine);
    y = yt + (yb - yt) / 2 + textHeight / 2;
  } else if (annotation.verticalJustification === Annotation.VerticalJustify.TOP) {
    const topY = Math.min(...note.getYs());
    y = topY - (textLine + 1) * 10;
    if (note.hasStem() && stemDirection === Stem.UP) {
      spacing = stemExt.topY < stave.getTopLineTopY() ? 10 : spacing;
      y = Math.min(y, stemExt.topY - spacing * (textLine + 1));
    }
  }

  return { x, y };
}

function drawHeaderWithVexFlow(context: any, score: NormalizedScore, width: number, options: VexflowRenderOptions, headerY: number) {
  const title = score.header.title;
  const subtitle = score.header.subtitle;
  const composer = score.header.composer;
  const tempo = score.header.tempo;

  if (!title && !subtitle && !composer && !tempo) return;

  const paddingLeftPt = options.pagePadding.left;
  const paddingRightPt = options.pagePadding.right;
  const headerHeightPt = options.headerHeight;

  const headerBottomY = headerY;
  const headerTopY = headerBottomY - headerHeightPt;

  // Title anchor: fixed relative to the page top (headerTopY)
  const titleStave = new Stave(paddingLeftPt, headerTopY + 28, width - paddingLeftPt - paddingRightPt, {
    numLines: 0,
    leftBar: false,
    rightBar: false,
  });

  // Subtitle/Composer anchor: moves with headerHeight (headerBottomY)
  const bottomStave = new Stave(paddingLeftPt, headerBottomY, width - paddingLeftPt - paddingRightPt, {
    numLines: 0,
    leftBar: false,
    rightBar: false,
  });

  // Title: Positioned at the top of the header area (fixed)
  if (title) {
    const titleText = new StaveText(title, Modifier.Position.ABOVE, {
      justification: TextJustification.CENTER,
      shiftY: 0,
    });
    titleText.setFont("Academico", 24, "bold");
    titleStave.addModifier(titleText);
  }

  // Subtitle: Positioned at the bottom of the header area (moves with height)
  if (subtitle) {
    const subtitleText = new StaveText(subtitle, Modifier.Position.ABOVE, {
      justification: TextJustification.CENTER,
      shiftY: 12,
    });
    subtitleText.setFont("Academico", 14, "italic");
    bottomStave.addModifier(subtitleText);
  }

  // Composer: Positioned at the bottom-right of the header area (moves with height)
  if (composer) {
    const composerText = new StaveText(composer, Modifier.Position.ABOVE, {
      justification: TextJustification.RIGHT,
      shiftY: 12,
    });
    composerText.setFont("Academico", 12, "");
    bottomStave.addModifier(composerText);
  }

  titleStave.setContext(context).draw();
  bottomStave.setContext(context).draw();
}

async function ensureVexFlowFonts() {
  if (typeof FontFace === "undefined") return;
  if (typeof VexFlow.loadFonts === "function") {
    try {
      await VexFlow.loadFonts("Bravura", "Academico");
    } catch {
      // no-op in headless / test environments
    }
  }
}

let cachedBravuraBase64: string | null = null;

async function getBravuraBase64(): Promise<string> {
  if (cachedBravuraBase64) return cachedBravuraBase64;
  try {
    const fontUrl = window.location.origin + "/drum_notation/fonts/bravura.woff2";
    const resp = await fetch(fontUrl);
    if (!resp.ok) throw new Error("Failed to fetch font");
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        cachedBravuraBase64 = base64;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Font preloading failed:", e);
    return "";
  }
}

function serializeSvgWithStyles(svgElement: SVGSVGElement, fontBase64?: string): string {
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  let fontRule = "";
  if (fontBase64) {
    fontRule = `
      @font-face {
        font-family: 'Bravura';
        src: url(data:font/woff2;base64,${fontBase64}) format('woff2');
      }
    `;
  }
  
  style.textContent = `
    ${fontRule}
    svg { background: white; }
  `;
  svgElement.prepend(style);
  return new XMLSerializer().serializeToString(svgElement);
}

function getScaledDimensions(options: VexflowRenderOptions) {
  const staffScale = options.staffScale;
  return {
    staffScale,
    systemSpacing: options.systemSpacing / staffScale,
    pagePaddingTop: options.pagePadding.top / staffScale,
    pagePaddingBottom: options.pagePadding.bottom / staffScale,
    pagePaddingLeft: options.pagePadding.left / staffScale,
    pagePaddingRight: options.pagePadding.right / staffScale,
    headerHeight: options.headerHeight / staffScale,
    titleStaffGap: options.titleStaffGap / staffScale,
  };
}

function groupMeasuresIntoSystems(score: NormalizedScore): RenderMeasure[][] {
  const renderMeasures = buildRenderMeasures(score);
  const allSystems: RenderMeasure[][] = [];
  let currentSystem: RenderMeasure[] = [];
  for (const measure of renderMeasures) {
    if (currentSystem.length > 0) {
      const last = currentSystem[currentSystem.length - 1];
      if (last && (measure.measure.paragraphIndex !== last.measure.paragraphIndex || currentSystem.length >= 6)) {
        allSystems.push(currentSystem);
        currentSystem = [];
      }
    }
    currentSystem.push(measure);
  }
  if (currentSystem.length > 0) allSystems.push(currentSystem);
  return allSystems;
}

function createHiddenContainer(isExport: boolean): HTMLDivElement {
  const container = document.createElement("div");
  if (!isExport) {
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.visibility = "hidden";
    document.body.appendChild(container);
  }
  return container;
}

function finalizeSvg(container: HTMLDivElement, isExport: boolean, fontBase64?: string): string {
  try {
    const svgElement = container.querySelector("svg");
    if (!svgElement) return container.innerHTML;
    return isExport ? serializeSvgWithStyles(svgElement, fontBase64) : new XMLSerializer().serializeToString(svgElement);
  } finally {
    if (container.parentElement) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Shared internal logic for rendering a batch of systems onto a single context.
 */
function renderSystemsBatch(
  context: any,
  score: NormalizedScore,
  systems: RenderMeasure[][],
  startSystemIdx: number, 
  layoutWidth: number,
  yStart: number,
  dims: ReturnType<typeof getScaledDimensions>,
  options: VexflowRenderOptions
): number {
  let yOffset = yStart;
  const staffHeight = 100;
  const measureDuration = { numerator: score.header.timeSignature.beats, denominator: score.header.timeSignature.beatUnit };

  for (let i = 0; i < systems.length; i++) {
    const globalIdx = startSystemIdx + i;
    renderSystem(context, score, systems[i]!, {
      x: dims.pagePaddingLeft,
      y: yOffset,
      width: layoutWidth - dims.pagePaddingLeft - dims.pagePaddingRight,
      isFirstSystem: globalIdx === 0,
      measureDuration,
      options: {
        ...options,
        systemSpacing: dims.systemSpacing,
        tempoShiftX: options.tempoShiftX / dims.staffScale,
        voltaGap: options.voltaGap / dims.staffScale,
        pagePadding: { 
          ...options.pagePadding, 
          top: dims.pagePaddingTop, 
          bottom: dims.pagePaddingBottom, 
          left: dims.pagePaddingLeft, 
          right: dims.pagePaddingRight 
        }
      },
    });
    yOffset += staffHeight + dims.systemSpacing;
  }
  return yOffset;
}

export async function renderScoreToSvg(score: NormalizedScore, inputOptions: VexflowRenderOptions): Promise<string> {
  const options = { ...DEFAULT_RENDER_OPTIONS, ...inputOptions } as VexflowRenderOptions;
  await ensureVexFlowFonts();
  const isExport = options.mode === "pdf";
  const fontBase64 = isExport ? await getBravuraBase64() : undefined;
  
  const dims = getScaledDimensions(options);
  const allSystems = groupMeasuresIntoSystems(score);

  const physicalWidth = options.pageWidth;
  const systemWidth = physicalWidth / dims.staffScale;
  const staffHeight = 100;
  
  const totalLogicalHeight = dims.pagePaddingTop + dims.headerHeight + dims.titleStaffGap + 
                             allSystems.length * (staffHeight + dims.systemSpacing) + dims.pagePaddingBottom;
  const totalPhysicalHeight = totalLogicalHeight * dims.staffScale;

  const container = createHiddenContainer(isExport);
  const renderer = new Renderer(container, RendererBackends.SVG);
  renderer.resize(physicalWidth, totalPhysicalHeight);
  const context = renderer.getContext();
  
  const svgElement = container.querySelector("svg");
  if (svgElement) {
    const logicalHeight = totalLogicalHeight;
    svgElement.setAttribute("viewBox", `0 0 ${systemWidth} ${logicalHeight}`);
    svgElement.setAttribute("width", physicalWidth.toString());
    svgElement.setAttribute("height", totalPhysicalHeight.toString());
  }

  context.setFont("Arial", 10);
  context.setFillStyle("#333");
  context.setStrokeStyle("#333");

  drawHeaderWithVexFlow(context, score, systemWidth, {
    ...options,
    titleStaffGap: dims.titleStaffGap,
    headerHeight: dims.headerHeight,
    pagePadding: { ...options.pagePadding, top: dims.pagePaddingTop, left: dims.pagePaddingLeft, right: dims.pagePaddingRight }
  }, dims.pagePaddingTop + dims.headerHeight);

  const yStart = dims.pagePaddingTop + dims.headerHeight + dims.titleStaffGap;
  renderSystemsBatch(context, score, allSystems, 0, systemWidth, yStart, dims, options);

  return finalizeSvg(container, isExport, fontBase64);
}

export async function renderScorePagesToSvgs(score: NormalizedScore, inputOptions: VexflowRenderOptions): Promise<string[]> {
  const options = { ...DEFAULT_RENDER_OPTIONS, ...inputOptions } as VexflowRenderOptions;
  await ensureVexFlowFonts();
  const isExport = options.mode === "pdf";
  const fontBase64 = isExport ? await getBravuraBase64() : undefined;
  
  const dims = getScaledDimensions(options);
  const allSystems = groupMeasuresIntoSystems(score);

  const svgs: string[] = [];
  const physicalWidth = options.pageWidth;
  const physicalHeight = options.pageHeight;
  const pageWidth = physicalWidth / dims.staffScale;
  const pageHeight = physicalHeight / dims.staffScale;
  const staffHeight = 100;

  let systemIdx = 0;
  while (systemIdx < allSystems.length) {
    const container = createHiddenContainer(isExport);
    const renderer = new Renderer(container, RendererBackends.SVG);
    renderer.resize(physicalWidth, physicalHeight);
    const context = renderer.getContext();
    
    const svgElement = container.querySelector("svg");
    if (svgElement) {
      svgElement.setAttribute("viewBox", `0 0 ${pageWidth} ${pageHeight}`);
      svgElement.setAttribute("width", physicalWidth.toString());
      svgElement.setAttribute("height", physicalHeight.toString());
    }

    context.setFont("Arial", 10);
    context.setFillStyle("#333");
    context.setStrokeStyle("#333");

    let yOffset: number;
    const isFirstPage = systemIdx === 0;
    
    if (isFirstPage) {
      drawHeaderWithVexFlow(context, score, pageWidth, {
        ...options,
        titleStaffGap: dims.titleStaffGap,
        headerHeight: dims.headerHeight,
        pagePadding: { ...options.pagePadding, top: dims.pagePaddingTop, left: dims.pagePaddingLeft, right: dims.pagePaddingRight }
      }, dims.pagePaddingTop + dims.headerHeight);
      yOffset = dims.pagePaddingTop + dims.headerHeight + dims.titleStaffGap;
    } else {
      yOffset = dims.pagePaddingTop;
    }

    const startBatchIdx = systemIdx;
    const currentBatch: RenderMeasure[][] = [];
    while (systemIdx < allSystems.length) {
      const neededHeight = staffHeight + dims.systemSpacing;
      if (systemIdx > startBatchIdx && yOffset + neededHeight > pageHeight - dims.pagePaddingBottom) {
        break;
      }
      currentBatch.push(allSystems[systemIdx]!);
      yOffset += neededHeight;
      systemIdx++;
    }

    renderSystemsBatch(context, score, currentBatch, startBatchIdx, pageWidth, isFirstPage ? (dims.pagePaddingTop + dims.headerHeight + dims.titleStaffGap) : dims.pagePaddingTop, dims, options);
    svgs.push(finalizeSvg(container, isExport, fontBase64));
  }
  return svgs;
}

interface SystemOptions {
  x: number;
  y: number;
  width: number;
  isFirstSystem: boolean;
  measureDuration: { numerator: number; denominator: number };
  options: VexflowRenderOptions;
}

function renderSystem(context: any, score: NormalizedScore, measures: RenderMeasure[], sysOpts: SystemOptions) {
  const { x, y, width, isFirstSystem, options } = sysOpts;
  const measureWidth = width / measures.length;

  const staves: any[] = [];
  const allVoices: any[] = [];
  const allBeams: any[] = [];
  const allTuplets: any[] = [];
  const noteDrawables: any[] = [];
  const repeatTwoBarOverlays: { start: any; end: any }[] = [];
  const layoutNotesByMeasure: LayoutNote[][] = [];

  for (let i = 0; i < measures.length; i++) {
    const renderMeasure = measures[i];
    if (!renderMeasure) continue;
    const measure = renderMeasure.measure;
    const stave = new Stave(x + i * measureWidth, y, measureWidth);
    stave.setContext(context);
    const stickings = stickingsByStart(measure.events);

    if (i === 0) {
      stave.addClef("percussion");

      if (measure.globalIndex > 0) {
        const measureNumber = new StaveText((measure.globalIndex + 1).toString(), Modifier.Position.ABOVE, {
          justification: TextJustification.LEFT,
        });
        measureNumber.setFont("Academico", 10, "italic");
        stave.addModifier(measureNumber);
      }

      if (isFirstSystem) {
        stave.addTimeSignature(`${score.header.timeSignature.beats}/${score.header.timeSignature.beatUnit}`);
        if (score.header.tempo) {
          // VexFlow 5 bug: StaveTempo above/below modifiers don't seem to account for stave.x.
          // We manually add 'x' to the offset and shift it further left (-45) to sit above the clef.
          const tempoText = new StaveTempo(
            { duration: "q", bpm: score.header.tempo },
            x - 45, 
            options.voltaGap
          );
          stave.addModifier(tempoText, Modifier.Position.ABOVE);
        }
      }
    }

    applyStaveBarlines(stave, measure, score);
    const { voices, beams, tuplets, layoutNotes, drawables } = renderMeasureVoices(score, renderMeasure, stave, stickings, options);
    allVoices.push(...voices);
    allBeams.push(...beams);
    allTuplets.push(...tuplets);
    noteDrawables.push(...drawables);
    layoutNotesByMeasure.push(layoutNotes);
    staves.push(stave);

    if (renderMeasure.kind === "measure-repeat-2-start") {
      const next = measures[i + 1];
      if (next?.kind === "measure-repeat-2-stop") {
        const nextStave = new Stave(x + (i + 1) * measureWidth, y, measureWidth);
        repeatTwoBarOverlays.push({ start: stave, end: nextStave });
      }
    }
  }

  const formatter = new Formatter();
  for (let i = 0; i < staves.length; i++) {
    const stave = staves[i];
    const staveVoices = allVoices.filter((voice) => (voice as any)._stave === stave);
    if (staveVoices.length === 0) continue;

    const noteStart = stave.getNoteStartX();
    const noteEnd = stave.getX() + stave.getWidth();
    const availableWidth = Math.max(10, noteEnd - noteStart - 10);
    formatter.joinVoices(staveVoices).format(staveVoices, availableWidth);
    staveVoices.forEach((voice) => (voice as any).draw(context, stave));
  }

  allBeams.forEach((beam) => beam.setContext(context).draw());
  allTuplets.forEach((tuplet) => tuplet.setContext(context).draw());
  noteDrawables.forEach((drawable) => drawable.setContext(context).draw());

  const systemLayout = buildSystemLayoutState(score, measures, staves, layoutNotesByMeasure, options.voltaGap);
  staves.forEach((stave) => stave.setContext(context).draw());
  systemLayout.edgeNavs.forEach(({ overlay }) => overlay.setContext(context).draw());
  systemLayout.voltaSpans.forEach(({ overlay }) => overlay.setContext(context).draw());

  repeatTwoBarOverlays.forEach(({ start, end }) => {
    const overlayStave = new Stave(start.getX(), start.getY(), start.getWidth() + end.getWidth());
    overlayStave.setContext(context);
    const repeatNote = new RepeatNote("2", { duration: "w" }, { line: 2 });
    const voice = new Voice({ numBeats: score.header.timeSignature.beats, beatValue: score.header.timeSignature.beatUnit }).setStrict(false).addTickables([repeatNote]);
    new Formatter().joinVoices([voice]).format([voice], overlayStave.getWidth() - 10);
    voice.draw(context, overlayStave);
  });
}

function buildSystemLayoutState(
  score: NormalizedScore,
  measures: RenderMeasure[],
  staves: any[],
  layoutNotesByMeasure: LayoutNote[][],
  voltaGap: number,
): SystemLayoutState {
  const fallbackTop = Math.min(...staves.map((stave) => stave.getYForTopText(1)));
  const skyline = new TopSkyline(staves[0]?.getX() ?? 0, (staves.at(-1)?.getX() ?? 0) + (staves.at(-1)?.getWidth() ?? 0), fallbackTop);

  for (let i = 0; i < layoutNotesByMeasure.length; i++) {
    const layoutNotes = layoutNotesByMeasure[i] ?? [];
    for (const layoutNote of layoutNotes) {
      occupyNoteInSkyline(layoutNote, skyline);
    }
  }

  const edgeNavs = buildEdgeNavs(measures, staves, skyline);
  const voltaSpans = buildVoltaSpans(score, measures, staves, skyline, voltaGap);
  return { skyline, edgeNavs, voltaSpans };
}

function occupyNoteInSkyline(layoutNote: LayoutNote, skyline: TopSkyline): void {
  const note = layoutNote.note;
  const absoluteX = note.getAbsoluteX();
  const glyphWidth = note.getGlyphWidth?.() ?? 12;
  const x1 = absoluteX - glyphWidth / 2 - 2;
  const x2 = absoluteX + glyphWidth / 2 + 2;
  const noteTop = note.hasStem() && note.getStemDirection() === Stem.UP
    ? note.getStemExtents().topY
    : Math.min(...note.getYs());
  skyline.occupy(x1, x2, noteTop);

  for (const ref of layoutNote.aboveRefs) {
    const modifier = ref.modifier;
    if (typeof modifier.x !== "number" || typeof modifier.y !== "number") continue;
    const modifierTop = modifier.y - ref.height;
    skyline.occupy(modifier.x, modifier.x + ref.width, modifierTop);
  }
}

function buildEdgeNavs(measures: RenderMeasure[], staves: any[], skyline: TopSkyline): PendingEdgeNav[] {
  const edgeNavs: PendingEdgeNav[] = [];

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]?.measure;
    const stave = staves[i];
    if (!measure || !stave) continue;

    if (measure.startNav?.anchor === "left-edge") {
      const segments = segmentsForStartNav(measure.startNav);
      const width = estimateSegmentsWidth(segments);
      const lineX = stave.getX();
      const occupiedTop = skyline.sample(lineX, lineX + width);
      const topY = occupiedTop - SKYLINE_GAP - NAV_GLYPH_SIZE;
      skyline.occupy(lineX, lineX + width, topY);
      edgeNavs.push({
        kind: measure.startNav.kind,
        x1: lineX,
        x2: lineX + width,
        overlay: new NavigationOverlay(`edge-navigation edge-navigation-${measure.startNav.kind}`, lineX, topY, segments),
      });
    }

    if (measure.endNav?.anchor === "right-edge") {
      const segments = segmentsForEndNav(measure.endNav);
      const width = estimateSegmentsWidth(segments);
      const lineX = stave.getX() + stave.getWidth() - width - 4;
      const occupiedTop = skyline.sample(lineX, lineX + width);
      const topY = occupiedTop - SKYLINE_GAP - Math.max(...segments.map((segment) => segment.fontSize));
      skyline.occupy(lineX, lineX + width, topY);
      edgeNavs.push({
        kind: measure.endNav.kind,
        x1: lineX,
        x2: lineX + width,
        overlay: new NavigationOverlay(`edge-navigation edge-navigation-${measure.endNav.kind}`, lineX, topY, segments),
      });
    }
  }

  return edgeNavs;
}

function buildVoltaSpans(
  score: NormalizedScore,
  measures: RenderMeasure[],
  staves: any[],
  skyline: TopSkyline,
  voltaGap: number,
): PendingVoltaSpan[] {
  const spans: PendingVoltaSpan[] = [];
  let blockStart = 0;

  while (blockStart < measures.length) {
    if (!measures[blockStart]?.measure.volta) {
      blockStart++;
      continue;
    }

    let blockEnd = blockStart;
    while (blockEnd + 1 < measures.length && measures[blockEnd + 1]?.measure.volta) {
      blockEnd++;
    }

    const blockX1 = staves[blockStart].getX();
    const blockX2 = staves[blockEnd].getX() + staves[blockEnd].getWidth();
    const spacing = staves[blockStart].getSpacingBetweenLines();
    const lineHeight = 1.5 * spacing;
    const occupiedTop = skyline.sample(blockX1, blockX2);
    const sharedLineY = occupiedTop - voltaGap - (lineHeight + VOLTA_TEXT_SIZE + 2);

    let index = blockStart;
    while (index <= blockEnd) {
      const measure = measures[index]?.measure;
      if (!measure?.volta) {
        index++;
        continue;
      }

      const label = `${measure.volta.indices.join(",")}.`;
      const start = index;
      let end = index;
      while (
        end + 1 <= blockEnd &&
        measures[end + 1]?.measure.volta?.indices.join(",") === measure.volta.indices.join(",")
      ) {
        end++;
      }

      const x1 = staves[start].getX();
      const x2 = staves[end].getX() + staves[end].getWidth();
      const endMeasure = measures[end]?.measure;
      if (!endMeasure) {
        index = end + 1;
        continue;
      }
      const voltaType = voltaTypeForMeasure(score, measure);
      const endType = voltaTypeForMeasure(score, endMeasure);
      const showLeft = voltaType === VoltaType.BEGIN || voltaType === VoltaType.BEGIN_END;
      const showRight = endType === VoltaType.END || endType === VoltaType.BEGIN_END;
      const displayLabel = showLeft ? label : undefined;

      spans.push({
        x1,
        x2,
        overlay: new VoltaOverlay("volta-overlay", x1, x2, sharedLineY, lineHeight, showLeft, showRight, displayLabel),
      });
      index = end + 1;
    }

    skyline.occupy(blockX1, blockX2, sharedLineY);
    blockStart = blockEnd + 1;
  }

  return spans;
}

function renderMeasureVoices(
  score: NormalizedScore,
  renderMeasure: RenderMeasure,
  stave: any,
  stickings: Map<string, string>,
  options: VexflowRenderOptions,
): { voices: any[]; beams: any[]; tuplets: any[]; layoutNotes: LayoutNote[]; drawables: any[] } {
  const measure = renderMeasure.measure;
  const measureDuration = {
    numerator: score.header.timeSignature.beats,
    denominator: score.header.timeSignature.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, measure.globalIndex);

  if (measure.multiRest) {
    const multiMeasureRest = new MultiMeasureRest(measure.multiRest.count, {
      numberOfMeasures: measure.multiRest.count,
      useSymbols: false,
      showNumber: true,
    });
    multiMeasureRest.setStave(stave);
    return { voices: [], beams: [], tuplets: [], layoutNotes: [], drawables: [multiMeasureRest] };
  }

  if (renderMeasure.kind === "measure-repeat-1") {
    const repeatNote = new RepeatNote("1", { duration: "w" }, { line: 2 });
    const voice = new Voice({ numBeats: measureDuration.numerator, beatValue: measureDuration.denominator }).setStrict(false).addTickables([repeatNote]);
    (voice as any)._stave = stave;
    return { voices: [voice], beams: [], tuplets: [], layoutNotes: [], drawables: [] };
  }

  if (renderMeasure.kind === "measure-repeat-2-start" || renderMeasure.kind === "measure-repeat-2-stop") {
    return { voices: [], beams: [], tuplets: [], layoutNotes: [], drawables: [] };
  }

  const upEvents = measure.events.filter((event: any) => voiceForTrack(event.track) === 1 && event.track !== "ST");
  const downEvents = measure.events.filter((event: any) => voiceForTrack(event.track) === 2 && event.track !== "ST");

  const upEntries = buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration, score.header.grouping, score.header.timeSignature);
  const downEntries = buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration, score.header.grouping, score.header.timeSignature);

  const beams: any[] = [];
  const tuplets: any[] = [];
  const navAnchors = new Map<string, NavAnchor>();

  const v1Result = createVexNotes(score, upEntries, 1, measureStart, stickings, beams, tuplets, navAnchors, options.stemLength);
  const voice1 = new Voice({ numBeats: measureDuration.numerator, beatValue: measureDuration.denominator }).setStrict(false).addTickables(v1Result.notes);
  (voice1 as any)._stave = stave;

  const voices = [voice1];
  const layoutNotes = [...v1Result.layoutNotes];

  const hasV2Events = downEvents.length > 0;
  if (hasV2Events || !options.hideVoice2Rests) {
    const v2Result = createVexNotes(score, downEntries, 2, measureStart, stickings, beams, tuplets, navAnchors, options.stemLength, options.hideVoice2Rests);
    const voice2 = new Voice({ numBeats: measureDuration.numerator, beatValue: measureDuration.denominator }).setStrict(false).addTickables(v2Result.notes);
    (voice2 as any)._stave = stave;
    voices.push(voice2);
    layoutNotes.push(...v2Result.layoutNotes);
  }

  attachInteriorNavigation(measure, navAnchors);
  return { voices, beams, tuplets, layoutNotes, drawables: [] };
}

function createVexNotes(
  score: NormalizedScore,
  entries: VoiceEntry[],
  voiceId: number,
  measureStart: Fraction,
  stickings: Map<string, string>,
  allBeams: any[],
  allTuplets: any[],
  navAnchors: Map<string, NavAnchor>,
  stemLength: number,
  hideRests = false,
): { notes: any[]; layoutNotes: LayoutNote[] } {
  const notes: any[] = [];
  const layoutNotes: LayoutNote[] = [];
  let currentBeamNotes: any[] = [];
  let currentBeamSegment = -1;
  let tupletNotes: any[] = [];
  let activeTuplet: any = null;

  function vfDuration(code: string, dots: number, rest = false): string {
    return `${code}${"d".repeat(dots)}${rest ? "r" : ""}`;
  }

  for (const entry of entries) {
    let note: any;
    let layoutNote: LayoutNote | undefined;
    const durInfo = durationCode(entry.kind === "rest" ? entry.duration : visualDurationForEvent(entry.events[0]!, entry.duration));

    if (entry.kind === "rest") {
      note = new StaveNote({
        keys: [voiceId === 1 ? "B/4" : "F/4"],
        duration: vfDuration(durInfo.code, durInfo.dots, true),
      });
      if (hideRests && voiceId === 2) note.setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });

      for (let d = 0; d < durInfo.dots; d++) {
        Dot.buildAndAttach([note], { all: true });
      }

      const relativeStart = subtractFractions(entry.start, measureStart);
      navAnchors.set(`${relativeStart.numerator}/${relativeStart.denominator}`, { note, layoutNote: { note, aboveRefs: [] } });
      if (currentBeamNotes.length > 1) allBeams.push(new Beam(currentBeamNotes));
      currentBeamNotes = [];
      currentBeamSegment = -1;
    } else {
      const firstEvent = entry.events[0];
      if (!firstEvent) continue;

      const instrumentSpecs = entry.events.map((event) => ({
        spec: instrumentForTrack(event.track, event.glyph),
        event,
      }));
      const keys = instrumentSpecs.map((item) => makeNoteKey(item.event, item.spec));
      const visualDur = visualDurationForEvent(firstEvent, entry.duration);

      note = new StaveNote({
        keys,
        duration: vfDuration(durInfo.code, durInfo.dots),
        autoStem: false,
      });
      note.setStemLength(stemLength);
      note.setStemDirection(voiceId === 1 ? 1 : -1);
      layoutNote = { note, aboveRefs: [] };
      layoutNotes.push(layoutNote);

      for (let d = 0; d < durInfo.dots; d++) {
        Dot.buildAndAttach([note], { all: true });
      }

      instrumentSpecs.forEach((item, index) => {
        const heads = note.note_heads || (note as any).noteHeads;
        if (!heads?.[index]) return;
        if (item.event.modifiers.includes("ghost")) {
          heads[index].text = "\uE0F5\uE0A4\uE0F6";
        }
      });

      if (entry.events.some((event) => event.modifiers.includes("accent"))) {
        const modifier = new Articulation("a>").setPosition(voiceId === 1 ? 3 : 4);
        note.addModifier(modifier, 0);
        if (voiceId === 1 && layoutNote) addSkylineRef(layoutNote, modifier, modifier.getWidth(), 14);
      } else if (entry.events.some((event) => event.modifiers.includes("close"))) {
        const modifier = new Articulation("a-").setPosition(voiceId === 1 ? 3 : 4);
        note.addModifier(modifier, 0);
        if (voiceId === 1 && layoutNote) addSkylineRef(layoutNote, modifier, modifier.getWidth(), 14);
      } else if (entry.events.some((event) => event.modifiers.includes("choke"))) {
        const modifier = new Articulation("a.").setPosition(voiceId === 1 ? 3 : 4);
        note.addModifier(modifier, 0);
        if (voiceId === 1 && layoutNote) addSkylineRef(layoutNote, modifier, modifier.getWidth(), 14);
      }

      const annotationText = entry.events.map(annotationTextForEvent).find((value) => value !== null);
      if (annotationText) {
        const modifier = new Annotation(annotationText).setPosition(ModifierPosition.ABOVE);
        note.addModifier(modifier, 0);
        if (layoutNote) addSkylineRef(layoutNote, modifier, estimateTextWidth(annotationText, NAV_TEXT_SIZE, NAV_TEXT_FONT), NAV_TEXT_SIZE);
      }

      const tremoloMarks = entry.events.map(tremoloMarksForEvent).find((value) => value !== null);
      if (tremoloMarks) {
        note.addModifier(new Tremolo(tremoloMarks), 0);
      }

      entry.events.forEach((event) => {
        if (modifierIsGrace(event)) {
          const slash = graceNoteSlash(event);
          const graceNote = new GraceNote({ keys: [makeNoteKey(event, instrumentForTrack(event.track, event.glyph))], duration: "16", slash });
          note.addModifier(new GraceNoteGroup([graceNote], slash), 0);
        }
      });

      if (voiceId === 1) {
        const relativeStart = subtractFractions(entry.start, measureStart);
        const stick = stickings.get(`${relativeStart.numerator}/${relativeStart.denominator}`);
        if (stick) {
          const modifier = new Annotation(stick).setPosition(ModifierPosition.ABOVE);
          note.addModifier(modifier, 0);
          if (layoutNote) addSkylineRef(layoutNote, modifier, estimateTextWidth(stick, NAV_TEXT_SIZE, NAV_TEXT_FONT), NAV_TEXT_SIZE);
        }
      }

      const relativeStart = subtractFractions(entry.start, measureStart);
      const relativeKey = `${relativeStart.numerator}/${relativeStart.denominator}`;
      if (!navAnchors.has(relativeKey) && layoutNote) {
        navAnchors.set(relativeKey, { note, layoutNote });
      }

      const segment = groupingSegmentIndex(score, subtractFractions(entry.start, measureStart));
      if (isBeamable(visualDur) && segment === currentBeamSegment) {
        currentBeamNotes.push(note);
      } else {
        if (currentBeamNotes.length > 1) allBeams.push(new Beam(currentBeamNotes));
        currentBeamNotes = isBeamable(visualDur) ? [note] : [];
        currentBeamSegment = isBeamable(visualDur) ? segment : -1;
      }

      if (firstEvent.tuplet) {
        if (!activeTuplet || activeTuplet.actual !== firstEvent.tuplet.actual) {
          if (tupletNotes.length > 0) {
            allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal, ratioed: false }));
          }
          tupletNotes = [note];
          activeTuplet = firstEvent.tuplet;
        } else {
          tupletNotes.push(note);
          if (tupletNotes.length === activeTuplet.actual) {
            allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal, ratioed: false }));
            tupletNotes = [];
            activeTuplet = null;
          }
        }
      } else if (tupletNotes.length > 0) {
        allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal, ratioed: false }));
        tupletNotes = [];
        activeTuplet = null;
      }
    }

    notes.push(note);
  }

  if (currentBeamNotes.length > 1) allBeams.push(new Beam(currentBeamNotes));
  if (tupletNotes.length > 0) {
    allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal, ratioed: false }));
  }
  return { notes, layoutNotes };
}

function stickingsByStart(events: NormalizedEvent[]): Map<string, string> {
  const byStart = new Map<string, string[]>();
  for (const event of events) {
    if (event.track !== "ST") continue;
    const key = `${event.start.numerator}/${event.start.denominator}`;
    byStart.set(key, [...(byStart.get(key) ?? []), event.glyph]);
  }
  return new Map([...byStart].map(([key, glyphs]) => [key, glyphs.join(" ")]));
}
