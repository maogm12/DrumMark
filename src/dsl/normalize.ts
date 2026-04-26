import { buildScoreAst } from "./ast";
import {
  addFractions,
  multiplyFraction,
  divideFraction,
  simplify,
} from "./logic";
import type {
  Fraction,
  NormalizedEvent,
  NormalizedScore,
  ScoreAst,
  TrackName,
  TokenGlyph,
  BasicGlyph,
} from "./types";

function calculateTokenWeight(token: TokenGlyph): number {
  if (token.kind === "group") {
    return token.span;
  }
  return 1;
}

function tokenToEvents(
  token: TokenGlyph,
  start: Fraction,
  duration: Fraction,
  track: TrackName,
  paragraphIndex: number,
  measureIndex: number,
  measureInParagraph: number,
): NormalizedEvent[] {
  if (token.kind === "basic") {
    if (token.value === "-") {
      return [];
    }
    return [
      {
        track,
        paragraphIndex,
        measureIndex,
        measureInParagraph,
        start,
        duration,
        kind: "hit",
        glyph: token.value,
      },
    ];
  }

  if (token.kind === "modified") {
    return [
      {
        track,
        paragraphIndex,
        measureIndex,
        measureInParagraph,
        start,
        duration,
        kind: "hit",
        glyph: token.value,
        modifier: token.modifier,
      },
    ];
  }

  if (token.kind === "combined") {
    return token.items
      .filter((item) => item.value !== "-")
      .map((item) => ({
        track,
        paragraphIndex,
        measureIndex,
        measureInParagraph,
        start,
        duration,
        kind: "hit",
        glyph: item.value as Exclude<BasicGlyph, "-">,
      }));
  }

  if (token.kind === "group") {
    const events: NormalizedEvent[] = [];
    const itemDuration = divideFraction(duration, token.count);

    token.items.forEach((item, i) => {
      const itemStart = addFractions(
        start,
        divideFraction(multiplyFraction(duration, i), token.count),
      );
      events.push(
        ...tokenToEvents(
          item,
          itemStart,
          itemDuration,
          track,
          paragraphIndex,
          measureIndex,
          measureInParagraph,
        ),
      );
    });
    return events;
  }

  return [];
}

export function normalizeScoreAst(ast: ScoreAst): NormalizedScore {
  const measures: NormalizedScore["measures"] = [];
  const measureDuration = {
    numerator: ast.headers.time.beats,
    denominator: ast.headers.time.beatUnit,
  };
  const slotDuration = simplify({
    numerator: measureDuration.numerator,
    denominator: measureDuration.denominator * ast.headers.divisions.value,
  });

  for (const [paragraphIndex, paragraph] of ast.paragraphs.entries()) {
    for (let measureInParagraph = 0; measureInParagraph < paragraph.measureCount; measureInParagraph += 1) {
      const globalIndex = paragraph.tracks[0]?.measures[measureInParagraph]?.globalIndex ?? measures.length;
      const events: NormalizedEvent[] = [];

      for (const track of paragraph.tracks) {
        const measure = track.measures[measureInParagraph];

        if (!measure) {
          continue;
        }

        let currentSlotOffset = 0;
        const expectedSlots = ast.headers.divisions.value;

        for (const token of measure.tokens) {
          const weight = calculateTokenWeight(token);
          const tokenStart = multiplyFraction(slotDuration, currentSlotOffset);
          const tokenDuration = multiplyFraction(slotDuration, weight);

          events.push(...tokenToEvents(token, tokenStart, tokenDuration, track.track, paragraphIndex, measures.length, measureInParagraph));
          currentSlotOffset += weight;
        }

        // Pad if measure is short
        if (currentSlotOffset < expectedSlots) {
          currentSlotOffset = expectedSlots;
        }
      }

      measures.push({
        globalIndex,
        paragraphIndex,
        measureInParagraph,
        sourceLine: paragraph.tracks[0]?.measures[measureInParagraph]?.sourceLine ?? 0,
        events,
      });
    }
  }

  return {
    ast,
    measures,
    errors: ast.errors,
  };
}

export function buildNormalizedScore(source: string): NormalizedScore {
  return normalizeScoreAst(buildScoreAst(source));
}
