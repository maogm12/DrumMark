import { parseDocumentSkeleton } from "./parser";
import { TRACKS, type MeasureToken, type ParseError, type ParsedMeasure, type ParsedTrackLine, type RepeatSpan, type ScoreAst, type ScoreMeasure, type ScoreParagraph, type TrackName, type TokenGlyph, type ScoreTrackParagraph } from "./types";
import { resolveFallbackTrack } from "./logic";

function makeRestTokens(divisions: number): MeasureToken[] {
  return Array.from({ length: divisions }, () => ({ kind: "basic", value: "-" as const, dots: 0, halves: 0, modifiers: [], trackOverride: undefined }));
}

function makeRestMeasure(globalIndex: number, divisions: number): ScoreMeasure {
  return {
    content: Array.from({ length: divisions }, () => "-").join(" "),
    tokens: makeRestTokens(divisions),
    repeatStart: false,
    repeatEnd: false,
    generated: true,
    globalIndex,
    barline: "regular",
  };
}

function pushError(errors: ParseError[], line: number, message: string): void {
  errors.push({
    line,
    column: 1,
    message,
  });
}

function calculateTokenWeight(token: TokenGlyph): number {
  if (token.kind === "group") {
    return token.span;
  }
  if (token.kind === "combined") {
    return Math.max(...token.items.map(calculateTokenWeight));
  }
  if (token.kind === "braced") {
    return token.items.reduce((sum, item) => sum + calculateTokenWeight(item), 0);
  }

  const base = 1;
  const dotMultiplier = 2 - Math.pow(0.5, token.dots);
  const halfDivider = Math.pow(2, token.halves);
  return (base * dotMultiplier) / halfDivider;
}

function normalizeExplicitMeasure(measure: ParsedMeasure, globalIndex: number, lineNumber: number, divisions: number): ScoreMeasure {
  const needsRestFill = measure.tokens.length === 0 && measure.multiRestCount === undefined;
  let tokens = needsRestFill ? makeRestTokens(divisions) : [...measure.tokens];

  if (measure.multiRestCount === undefined) {
    const currentWeight = tokens.reduce((sum, t) => sum + calculateTokenWeight(t), 0);
    if (currentWeight < divisions - 0.001) {
      const remaining = Math.round(divisions - currentWeight);
      if (remaining > 0) {
        tokens = [...tokens, ...makeRestTokens(remaining)];
      }
    }
  }

  const barline =
    measure.repeatStart && measure.repeatEnd
      ? "repeat-both"
      : measure.repeatStart
        ? "repeat-start"
        : measure.repeatEnd
          ? "repeat-end"
          : "regular";

  return {
    ...measure,
    tokens,
    generated: measure.tokens.length === 0 && measure.multiRestCount === undefined,
    globalIndex,
    sourceLine: lineNumber,
    barline,
    ...(measure.voltaIndices ? { volta: { indices: [...measure.voltaIndices] } } : {}),
    ...(measure.measureRepeatSlashes !== undefined ? { measureRepeat: { slashes: measure.measureRepeatSlashes } } : {}),
    ...(measure.multiRestCount !== undefined ? { multiRest: { count: measure.multiRestCount } } : {}),
  };
}

function collectTracksInToken(token: TokenGlyph, tracks: Set<TrackName>, contextTrack: TrackName | "ANONYMOUS"): void {
  if (token.kind === "basic") {
    if (token.value === "-") return;
    if (token.trackOverride && TRACKS.includes(token.trackOverride as TrackName)) {
      tracks.add(token.trackOverride as TrackName);
    } else if (contextTrack === "ANONYMOUS") {
      tracks.add(resolveFallbackTrack(token.value));
    } else {
      tracks.add(contextTrack as TrackName);
    }
  } else if (token.kind === "combined") {
    token.items.forEach((t) => collectTracksInToken(t, tracks, contextTrack));
  } else if (token.kind === "group") {
    token.items.forEach((t) => collectTracksInToken(t, tracks, contextTrack));
  } else if (token.kind === "braced") {
    const bracedTrack = token.track as TrackName;
    if (TRACKS.includes(bracedTrack)) {
      tracks.add(bracedTrack);
    }
    token.items.forEach((t) => collectTracksInToken(t, tracks, bracedTrack));
  }
}

function collectTracksInLine(line: ParsedTrackLine, tracks: Set<TrackName>): void {
  line.measures.forEach((m) => m.tokens.forEach((t) => collectTracksInToken(t, tracks, line.track as TrackName | "ANONYMOUS")));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function reduceFraction(numerator: number, denominator: number): [number, number] {
  const divisor = gcd(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}

function isSupportedSimpleDuration(numerator: number, denominator: number): boolean {
  const [n, d] = reduceFraction(numerator, denominator);
  const baseDurations = new Set(["1/1", "1/2", "1/4", "1/8", "1/16", "1/32", "1/64"]);
  const dottedDurations = new Set(["3/2", "3/4", "3/8", "3/16", "3/32"]);
  return baseDurations.has(`${n}/${d}`) || dottedDurations.has(`${n}/${d}`);
}

function isBelowSixtyFourth(numerator: number, denominator: number): boolean {
  return numerator * 64 < denominator;
}

function validateGrouping(headers: ScoreAst["headers"], errors: ParseError[]): void {
  const groupingTotal = headers.grouping.values.reduce((total, value) => total + value, 0);
  if (groupingTotal !== headers.time.beats) {
    errors.push({
      line: headers.grouping.line || headers.time.line || 1,
      column: 1,
      message: `Grouping must sum to ${headers.time.beats} for time ${headers.time.beats}/${headers.time.beatUnit}`,
    });
  }

  let cumulative = 0;
  for (const value of headers.grouping.values) {
    cumulative += value;
    const slotPosition = cumulative * headers.divisions.value;
    if (slotPosition % headers.time.beats !== 0) {
      errors.push({
        line: headers.grouping.line || headers.divisions.line || 1,
        column: 1,
        message: "Grouping boundaries must fall on integer slot positions under the current divisions",
      });
      break;
    }
  }
}

function validateGroupToken(
  token: MeasureToken,
  measureDurationNumerator: number,
  measureDurationDenominator: number,
  divisions: number,
  errors: ParseError[],
  line: number,
): void {
  if (token.kind !== "group") {
    return;
  }

  for (const item of token.items) {
    validateGroupToken(item, measureDurationNumerator, measureDurationDenominator, divisions, errors, line);
  }

  const itemNumerator = measureDurationNumerator * token.span;
  const itemDenominator = measureDurationDenominator * divisions * token.count;

  if (isBelowSixtyFourth(itemNumerator, itemDenominator)) {
    errors.push({
      line,
      column: 1,
      message: "Group item durations below 64th notes are not supported in v0",
    });
    return;
  }

  if (token.count <= token.span) {
    if (!isSupportedSimpleDuration(itemNumerator, itemDenominator)) {
      errors.push({
        line,
        column: 1,
        message: "Stretched group items must map to a supported single note value without tie splitting",
      });
    }
    return;
  }

  const ratio = `${token.count}:${token.span}`;
  const supportedCompressed = new Set(["2:1", "3:1", "4:1", "3:2", "4:2", "5:4", "6:4", "7:4"]);
  if (!supportedCompressed.has(ratio)) {
    errors.push({
      line,
      column: 1,
      message: `Unsupported compressed group ratio ${token.count} in ${token.span}`,
    });
  }
}

function validateAndBuildRepeats(
  paragraphs: ScoreParagraph[],
  errors: ParseError[],
): RepeatSpan[] {
  const boundaryByBar = new Map<number, { start?: boolean; end?: boolean; times?: number; line: number }>();

  for (const paragraph of paragraphs) {
    for (const track of paragraph.tracks) {
      for (const measure of track.measures) {
        if (!measure.repeatStart && !measure.repeatEnd) continue;

        const existing = boundaryByBar.get(measure.globalIndex);
        if (!existing) {
          boundaryByBar.set(measure.globalIndex, {
            start: measure.repeatStart || undefined,
            end: measure.repeatEnd || undefined,
            times: measure.repeatEnd ? measure.repeatTimes : undefined,
            line: paragraph.startLine,
          });
          continue;
        }

        if (measure.repeatEnd && (existing.times ?? 2) !== (measure.repeatTimes ?? 2)) {
          errors.push({
            line: paragraph.startLine,
            column: 1,
            message: `Conflicting repeat count at bar ${measure.globalIndex + 1}`,
          });
        }

        existing.start = existing.start || measure.repeatStart || undefined;
        existing.end = existing.end || measure.repeatEnd || undefined;
        existing.times = existing.end ? existing.times ?? measure.repeatTimes ?? 2 : undefined;
      }
    }
  }

  const maxBar = paragraphs.flatMap((p) => p.tracks.flatMap((t) => t.measures)).reduce((max, m) => Math.max(max, m.globalIndex), -1);
  const repeatSpans: RepeatSpan[] = [];
  let openStart: number | null = null;

  for (let bar = 0; bar <= maxBar; bar += 1) {
    const boundary = boundaryByBar.get(bar);
    const start = boundary?.start ?? false;
    const end = boundary?.end ?? false;

    if (start && openStart !== null) pushError(errors, paragraphs[0]?.startLine ?? 1, `Nested repeat start at bar ${bar + 1} is not supported`);
    if (start && openStart === null) openStart = bar;
    if (end && openStart === null) pushError(errors, paragraphs[0]?.startLine ?? 1, `Repeat end at bar ${bar + 1} has no matching start`);
    if (end && openStart !== null) {
      repeatSpans.push({ startBar: openStart, endBar: bar, times: boundary?.times ?? 2 });
      openStart = null;
    }
  }

  if (openStart !== null) pushError(errors, paragraphs[0]?.startLine ?? 1, `Repeat starting at bar ${openStart + 1} is missing an end`);

  return repeatSpans;
}

export function buildScoreAst(source: string): ScoreAst {
  const skeleton = parseDocumentSkeleton(source);
  const errors = [...skeleton.errors];
  validateGrouping(skeleton.headers as ScoreAst["headers"], errors);
  const paragraphs: ScoreParagraph[] = [];
  const globalTracks: TrackName[] = [];
  let globalBarIndex = 0;

  // Track discovery and ordering
  skeleton.paragraphs.forEach((p) =>
    p.lines.forEach((l) => {
      const lineTracks = new Set<TrackName>();
      collectTracksInLine(l, lineTracks);
      lineTracks.forEach((t) => {
        if (!globalTracks.includes(t)) {
          globalTracks.push(t);
        }
      });
    }),
  );

  for (const paragraph of skeleton.paragraphs) {
    const explicitMeasureCounts = [...new Set(paragraph.lines.map((l) => l.measures.length))];
    if (explicitMeasureCounts.length > 1) {
      errors.push({
        line: paragraph.startLine,
        column: 1,
        message: "All track lines in a paragraph must have the same measure count",
      });
      continue;
    }

    const measureCount = explicitMeasureCounts[0] ?? 0;
    const explicitLines = paragraph.lines.map((line) => {
      line.measures.forEach((m) =>
        m.tokens.forEach((t) =>
          validateGroupToken(
            t,
            skeleton.headers.time.beats,
            skeleton.headers.time.beatUnit,
            skeleton.headers.divisions.value,
            errors,
            line.lineNumber,
          ),
        ),
      );

      return {
        track: line.track as TrackName | "ANONYMOUS",
        generated: false,
        lineNumber: line.lineNumber,
        measures: line.measures.map((m, idx) =>
          normalizeExplicitMeasure(m, globalBarIndex + idx, line.lineNumber, skeleton.headers.divisions.value),
        ),
      } satisfies ScoreTrackParagraph;
    });

    const anonymousLines = explicitLines.filter((line) => line.track === "ANONYMOUS");
    const namedLineByTrack = new Map<TrackName, ScoreTrackParagraph>();
    explicitLines
      .filter((line): line is ScoreTrackParagraph & { track: TrackName } => line.track !== "ANONYMOUS")
      .forEach((line) => {
        namedLineByTrack.set(line.track, line);
      });

    const filledTracks: ScoreTrackParagraph[] = [...anonymousLines];
    globalTracks.forEach((track) => {
      const explicitTrack = namedLineByTrack.get(track);
      if (explicitTrack) {
        filledTracks.push(explicitTrack);
        return;
      }

      filledTracks.push({
        track,
        generated: true,
        lineNumber: undefined,
        measures: Array.from({ length: measureCount }, (_, index) =>
          makeRestMeasure(globalBarIndex + index, skeleton.headers.divisions.value),
        ),
      });
    });

    paragraphs.push({
      startLine: paragraph.startLine,
      measureCount,
      tracks: filledTracks,
      groups: paragraph.lines.filter((l) => l.track !== "ANONYMOUS").map((l) => [l.track as TrackName]),
    });

    globalBarIndex += measureCount;
  }

  return {
    headers: skeleton.headers,
    paragraphs,
    repeatSpans: validateAndBuildRepeats(paragraphs, errors),
    errors,
  };
}
