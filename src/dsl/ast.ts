import { parseDocumentSkeleton } from "./parser";
import { TRACKS, type MeasureToken, type ParseError, type ParsedMeasure, type ParsedTrackLine, type RepeatSpan, type ScoreAst, type ScoreMeasure, type ScoreParagraph, type TrackName } from "./types";

const DR_TARGET_TRACKS: TrackName[] = ["SD", "T1", "T2", "T3"];
type CanonicalParsedTrackLine = ParsedTrackLine & { track: TrackName };

function makeRestTokens(divisions: number): MeasureToken[] {
  return Array.from({ length: divisions }, () => ({ kind: "basic", value: "-" as const }));
}

function makeRestMeasure(globalIndex: number, divisions: number): ScoreMeasure {
  return {
    content: Array.from({ length: divisions }, () => "-").join(" "),
    tokens: makeRestTokens(divisions),
    repeatStart: false,
    repeatEnd: false,
    generated: true,
    globalIndex,
  };
}

function pushError(errors: ParseError[], line: number, message: string): void {
  errors.push({
    line,
    column: 1,
    message,
  });
}

function countMeasureSlots(tokens: MeasureToken[]): number {
  return tokens.reduce((total, token) => {
    if (token.kind === "group") {
      return total + token.span;
    }

    return total + 1;
  }, 0);
}

function normalizeExplicitMeasure(measure: ParsedMeasure, globalIndex: number, lineNumber: number, divisions: number): ScoreMeasure {
  const tokens = measure.tokens.length === 0 ? makeRestTokens(divisions) : measure.tokens;

  return {
    ...measure,
    tokens,
    generated: false,
    globalIndex,
    sourceLine: lineNumber,
  };
}

function drTokenUsesTrack(token: MeasureToken, track: TrackName): boolean {
  if (token.kind === "group") {
    return token.items.some((item) => drTokenUsesTrack(item, track));
  }

  switch (token.value) {
    case "s":
    case "S":
    case "g":
      return track === "SD";
    case "t1":
    case "T1":
      return track === "T1";
    case "t2":
    case "T2":
      return track === "T2";
    case "t3":
    case "T3":
      return track === "T3";
    default:
      return false;
  }
}

function expandDrToken(token: MeasureToken, track: TrackName): MeasureToken {
  if (token.kind === "group") {
    return {
      kind: "group",
      count: token.count,
      span: token.span,
      items: token.items.map((item) => expandDrToken(item, track)),
    };
  }

  switch (token.value) {
    case "s":
      return { kind: "basic", value: track === "SD" ? "d" : "-" };
    case "S":
      return { kind: "basic", value: track === "SD" ? "D" : "-" };
    case "g":
      return { kind: "basic", value: track === "SD" ? "g" : "-" };
    case "t1":
      return { kind: "basic", value: track === "T1" ? "d" : "-" };
    case "T1":
      return { kind: "basic", value: track === "T1" ? "D" : "-" };
    case "t2":
      return { kind: "basic", value: track === "T2" ? "d" : "-" };
    case "T2":
      return { kind: "basic", value: track === "T2" ? "D" : "-" };
    case "t3":
      return { kind: "basic", value: track === "T3" ? "d" : "-" };
    case "T3":
      return { kind: "basic", value: track === "T3" ? "D" : "-" };
    default:
      return token;
  }
}

function expandDrLine(line: ParsedTrackLine): CanonicalParsedTrackLine[] {
  const usedTracks = DR_TARGET_TRACKS.filter((track) =>
    line.measures.some((measure) => measure.tokens.some((token) => drTokenUsesTrack(token, track))),
  );

  return usedTracks.map((track) => ({
    ...line,
    track,
    measures: line.measures.map((measure) => ({
      ...measure,
      tokens: measure.tokens.map((token) => expandDrToken(token, track)),
    })),
  }));
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
      if (track.generated) {
        continue;
      }

      for (const measure of track.measures) {
        if (!measure.repeatStart && !measure.repeatEnd) {
          continue;
        }

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

  const maxBar = paragraphs.flatMap((paragraph) => paragraph.tracks.flatMap((track) => track.measures)).reduce((max, measure) => Math.max(max, measure.globalIndex), -1);
  const repeatSpans: RepeatSpan[] = [];
  let openStart: number | null = null;

  for (let bar = 0; bar <= maxBar; bar += 1) {
    const boundary = boundaryByBar.get(bar);
    const start = boundary?.start ?? false;
    const end = boundary?.end ?? false;

    if (start && openStart !== null) {
      pushError(errors, paragraphs[0]?.startLine ?? 1, `Nested repeat start at bar ${bar + 1} is not supported`);
    }

    if (start && openStart === null) {
      openStart = bar;
    }

    if (end && openStart === null) {
      pushError(errors, paragraphs[0]?.startLine ?? 1, `Repeat end at bar ${bar + 1} has no matching start`);
    }

    if (end && openStart !== null) {
      repeatSpans.push({
        startBar: openStart,
        endBar: bar,
        times: boundary?.times ?? 2,
      });
      openStart = null;
    }
  }

  if (openStart !== null) {
    pushError(errors, paragraphs[0]?.startLine ?? 1, `Repeat starting at bar ${openStart + 1} is missing an end`);
  }

  return repeatSpans;
}

export function buildScoreAst(source: string): ScoreAst {
  const skeleton = parseDocumentSkeleton(source);
  const errors = [...skeleton.errors];
  validateGrouping(skeleton.headers as ScoreAst["headers"], errors);
  const paragraphs: ScoreParagraph[] = [];
  const knownTracks: TrackName[] = [];
  let globalBarIndex = 0;

  for (const paragraph of skeleton.paragraphs) {
    const hasDr = paragraph.lines.some((line) => line.track === "DR");
    const hasExplicitDrumTracks = paragraph.lines.some((line) => line.track === "SD" || line.track === "T1" || line.track === "T2" || line.track === "T3");

    if (hasDr && hasExplicitDrumTracks) {
      errors.push({
        line: paragraph.startLine,
        column: 1,
        message: "Track `DR` cannot be mixed with explicit `SD`, `T1`, `T2`, or `T3` lines in the same paragraph",
      });
      continue;
    }

    const expandedLines: CanonicalParsedTrackLine[] = paragraph.lines.flatMap((line) => line.track === "DR"
      ? expandDrLine(line)
      : [{ ...line, track: line.track as TrackName } satisfies CanonicalParsedTrackLine]);
    const explicitMeasureCounts = [...new Set(expandedLines.map((line) => line.measures.length))];

    if (explicitMeasureCounts.length > 1) {
      errors.push({
        line: paragraph.startLine,
        column: 1,
        message: "All explicit track lines in a paragraph must have the same measure count",
      });
      continue;
    }

    const measureCount = explicitMeasureCounts[0] ?? 0;
    const explicitByTrack = new Map(expandedLines.map((line) => [line.track, line] as const));

    for (const line of expandedLines) {
      if (!knownTracks.includes(line.track)) {
        knownTracks.push(line.track);
      }
    }

    const paragraphTracks = knownTracks
      .slice()
      .sort((left, right) => TRACKS.indexOf(left) - TRACKS.indexOf(right))
      .map((track) => {
        const explicit = explicitByTrack.get(track);

        if (explicit) {
          return {
            track,
            generated: false,
            lineNumber: explicit.lineNumber,
            measures: explicit.measures.map((measure, index) =>
              normalizeExplicitMeasure(measure, globalBarIndex + index, explicit.lineNumber, skeleton.headers.divisions.value),
            ),
          };
        }

        return {
          track,
          generated: true,
          lineNumber: undefined,
          measures: Array.from({ length: measureCount }, (_, index) =>
            makeRestMeasure(globalBarIndex + index, skeleton.headers.divisions.value),
          ),
        };
      });

    paragraphs.push({
      startLine: paragraph.startLine,
      measureCount,
      tracks: paragraphTracks,
      groups: expandedLines.map((line) => [line.track]),
    });

    globalBarIndex += measureCount;
  }

  for (const paragraph of paragraphs) {
    for (const track of paragraph.tracks) {
      if (track.generated) {
        continue;
      }

      for (const measure of track.measures) {
        const slotCount = countMeasureSlots(measure.tokens);

        if (slotCount !== skeleton.headers.divisions.value) {
          errors.push({
            line: track.lineNumber ?? paragraph.startLine,
            column: 1,
            message: `Measure ${measure.globalIndex + 1} on track ${track.track} uses ${slotCount} slots, expected ${skeleton.headers.divisions.value}`,
          });
        }

        for (const token of measure.tokens) {
          validateGroupToken(
            token,
            skeleton.headers.time.beats,
            skeleton.headers.time.beatUnit,
            skeleton.headers.divisions.value,
            errors,
            track.lineNumber ?? paragraph.startLine,
          );
        }
      }
    }
  }

  return {
    headers: skeleton.headers,
    paragraphs,
    repeatSpans: validateAndBuildRepeats(paragraphs, errors),
    errors,
  };
}
