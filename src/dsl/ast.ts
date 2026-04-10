import { parseDocumentSkeleton } from "./parser";
import { TRACKS, type MeasureToken, type ParseError, type RepeatSpan, type ScoreAst, type ScoreMeasure, type ScoreParagraph, type TrackName } from "./types";

function makeRestMeasure(globalIndex: number, divisions: number): ScoreMeasure {
  return {
    content: Array.from({ length: divisions }, () => "-").join(" "),
    tokens: Array.from({ length: divisions }, () => ({ kind: "basic", value: "-" as const })),
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
  const paragraphs: ScoreParagraph[] = [];
  const knownTracks: TrackName[] = [];
  let globalBarIndex = 0;

  for (const paragraph of skeleton.paragraphs) {
    const explicitMeasureCounts = [...new Set(paragraph.lines.map((line) => line.measures.length))];

    if (explicitMeasureCounts.length > 1) {
      errors.push({
        line: paragraph.startLine,
        column: 1,
        message: "All explicit track lines in a paragraph must have the same measure count",
      });
      continue;
    }

    const measureCount = explicitMeasureCounts[0] ?? 0;
    const explicitByTrack = new Map(paragraph.lines.map((line) => [line.track, line] as const));

    for (const line of paragraph.lines) {
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
            measures: explicit.measures.map((measure, index) => ({
              ...measure,
              generated: false,
              globalIndex: globalBarIndex + index,
              sourceLine: explicit.lineNumber,
            })),
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
      groups: paragraph.lines.map((line) => [line.track]),
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
