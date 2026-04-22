import { buildScoreAst } from "./ast";
import { TRACKS } from "./types";
import type {
  Fraction,
  MeasureToken,
  Modifier,
  NormalizedEvent,
  NormalizedEventKind,
  NormalizedMeasure,
  NormalizedScore,
  ScoreAst,
  TrackName,
} from "./types";

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

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function simplify(fraction: Fraction): Fraction {
  const divisor = gcd(fraction.numerator, fraction.denominator);
  const denominator = fraction.denominator / divisor;
  const numerator = fraction.numerator / divisor;

  if (denominator < 0) {
    return {
      numerator: -numerator,
      denominator: -denominator,
    };
  }

  return { numerator, denominator };
}

function addFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function multiplyFraction(fraction: Fraction, multiplier: number): Fraction {
  return simplify({
    numerator: fraction.numerator * multiplier,
    denominator: fraction.denominator,
  });
}

function divideFraction(fraction: Fraction, divisor: number): Fraction {
  return simplify({
    numerator: fraction.numerator,
    denominator: fraction.denominator * divisor,
  });
}

function classifyEventKind(track: TrackName, glyph: Exclude<NormalizedEvent["glyph"], never>): NormalizedEventKind {
  if (track === "ST") {
    return "sticking";
  }

  if (track === "HF") {
    return "pedal";
  }

  if (glyph === "g") {
    return "ghost";
  }

  if (glyph === "X" || glyph === "D") {
    return "accent";
  }

  return "hit";
}

function pushTokenEvents(
  track: TrackName,
  token: MeasureToken,
  measureStart: Fraction,
  tokenStart: Fraction,
  tokenDuration: Fraction,
  paragraphIndex: number,
  measureIndex: number,
  measureInParagraph: number,
  into: NormalizedEvent[],
  tuplet?: { actual: number; normal: number },
): void {
  if (token.kind === "group") {
    const itemDuration = divideFraction(tokenDuration, token.items.length || 1);
    let itemStart = tokenStart;
    // Only add tuplet when compressing (count > span), not when stretching (count < span)
    const tupletForGroup = token.count > token.span ? { actual: token.count, normal: token.span } : undefined;

    for (const item of token.items) {
      pushTokenEvents(
        track,
        item,
        measureStart,
        itemStart,
        itemDuration,
        paragraphIndex,
        measureIndex,
        measureInParagraph,
        into,
        tupletForGroup,
      );
      itemStart = addFractions(itemStart, itemDuration);
    }

    return;
  }

  if (token.value === "-") {
    return;
  }

  const glyph = token.value;
  const modifier: Modifier | undefined = token.kind === "modified" ? token.modifier : undefined;

  into.push({
    track,
    paragraphIndex,
    measureIndex,
    measureInParagraph,
    start: addFractions(measureStart, tokenStart),
    duration: tokenDuration,
    kind: classifyEventKind(track, glyph),
    glyph,
    modifier,
    ...(tuplet ? { tuplet } : {}),
  });
}

export function normalizeScoreAst(ast: ScoreAst): NormalizedScore {
  const errors = [...ast.errors];
  const measures: NormalizedMeasure[] = [];
  const measureDuration = simplify({
    numerator: ast.headers.time.beats,
    denominator: ast.headers.time.beatUnit,
  });
  const slotDuration = divideFraction(measureDuration, ast.headers.divisions.value);

  for (let paragraphIndex = 0; paragraphIndex < ast.paragraphs.length; paragraphIndex += 1) {
    const paragraph = ast.paragraphs[paragraphIndex];

    for (let measureInParagraph = 0; measureInParagraph < paragraph.measureCount; measureInParagraph += 1) {
      const globalIndex = paragraph.tracks[0]?.measures[measureInParagraph]?.globalIndex ?? measures.length;
      const measureStart = multiplyFraction(measureDuration, globalIndex);
      const events: NormalizedEvent[] = [];

      for (const track of paragraph.tracks) {
        const measure = track.measures[measureInParagraph];

        if (!measure) {
          continue;
        }

        let slotOffset = 0;

        for (const token of measure.tokens) {
          const span = token.kind === "group" ? token.span : 1;
          const tokenStart = multiplyFraction(slotDuration, slotOffset);
          const tokenDuration = multiplyFraction(slotDuration, span);

          pushTokenEvents(
            track.track,
            token,
            measureStart,
            tokenStart,
            tokenDuration,
            paragraphIndex,
            globalIndex,
            measureInParagraph,
            events,
          );

          slotOffset += span;
        }
      }

      measures.push({
        globalIndex,
        paragraphIndex,
        measureInParagraph,
        sourceLine: paragraph.tracks[0]?.measures[measureInParagraph]?.sourceLine ?? 0,
        events: events.sort((left, right) => {
          const denominator = lcm(left.start.denominator, right.start.denominator);
          const leftValue = left.start.numerator * (denominator / left.start.denominator);
          const rightValue = right.start.numerator * (denominator / right.start.denominator);

          if (leftValue !== rightValue) {
            return leftValue - rightValue;
          }

          return TRACKS.indexOf(left.track) - TRACKS.indexOf(right.track);
        }),
      });
    }
  }

  return {
    ast,
    measures,
    errors,
  };
}

export function buildNormalizedScore(source: string): NormalizedScore {
  return normalizeScoreAst(buildScoreAst(source));
}
