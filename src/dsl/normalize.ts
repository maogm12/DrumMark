import { buildScoreAst } from "./ast";
import { TRACKS } from "./types";
import type {
  BasicGlyph,
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
    return glyph === "P" ? "accent" : "pedal";
  }

  if (glyph === "X" || glyph === "D" || glyph === "P" || glyph === "C") {
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

  if (token.kind === "combined") {
    // Combined token: all items play at the same time position
    for (const item of token.items) {
      // "-" in combined is unusual but filter it out to avoid classification issues
      if (item.value === "-") continue;
      const glyph = item.value as Exclude<BasicGlyph, "-">;
      into.push({
        track,
        paragraphIndex,
        measureIndex,
        measureInParagraph,
        start: addFractions(measureStart, tokenStart),
        duration: tokenDuration,
        kind: classifyEventKind(track, glyph),
        glyph,
        modifier: undefined,
        ...(tuplet ? { tuplet } : {}),
      });
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

function calculateTokenWeight(token: MeasureToken): number {
  if (token.kind === "group") {
    return token.span;
  }
  if (token.kind === "combined") {
    return 1; // All items play simultaneously = 1 slot
  }
  // Weight = (1 + 0.5 + 0.25... based on dots) / (2^halves)
  const baseWeight = 2 - Math.pow(0.5, token.dots);
  return baseWeight / Math.pow(2, token.halves);
}

export function normalizeScoreAst(ast: ScoreAst): NormalizedScore {
  const errors = [...ast.errors];
  const measures: NormalizedMeasure[] = [];
  const measureDuration = simplify({
    numerator: ast.headers.time.beats,
    denominator: ast.headers.time.beatUnit,
  });
  const slotDuration = divideFraction(measureDuration, ast.headers.divisions.value);

  const groupingValues = ast.headers.grouping.values;
  const slotsPerBeatUnit = ast.headers.divisions.value / ast.headers.time.beats;
  const groupingBoundaries = groupingValues.reduce((acc, val, i) => {
    const prev = acc[i - 1] ?? 0;
    return [...acc, prev + (val * slotsPerBeatUnit)];
  }, [] as number[]);

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

        let currentSlotOffset = 0;
        const expectedSlots = ast.headers.divisions.value;

        for (const token of measure.tokens) {
          const weight = calculateTokenWeight(token);
          const tokenStart = multiplyFraction(slotDuration, currentSlotOffset);
          const tokenDuration = multiplyFraction(slotDuration, weight);

          // Boundary check: A note or group cannot cross a grouping boundary
          const startSlot = currentSlotOffset;
          const endSlot = currentSlotOffset + weight;
          
          for (const boundary of groupingBoundaries) {
            // Use a small epsilon to avoid floating point issues
            if (startSlot < boundary - 0.0001 && endSlot > boundary + 0.0001) {
              const tokenDesc = token.kind === "combined"
                ? token.items.map((i) => i.value).join("+")
                : token.kind === "group" ? "group" : token.value;
              errors.push({
                line: measure.sourceLine ?? track.lineNumber ?? paragraph.startLine,
                column: 1,
                message: `Token \`${tokenDesc}\` crosses grouping boundary at ${boundary} in track ${track.track}`,
              });
            }
          }

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

          currentSlotOffset += weight;
        }

        // Final measure length validation
        // Multi-rest measures span multiple bars and don't need to fill a single measure
        if (measure.multiRestCount === undefined && Math.abs(currentSlotOffset - expectedSlots) > 0.0001) {
          errors.push({
            line: measure.sourceLine ?? track.lineNumber ?? paragraph.startLine,
            column: 1,
            message: `Track \`${track.track}\` measure ${globalIndex + 1} has invalid duration: used ${currentSlotOffset} slots, expected ${expectedSlots}`,
          });
        }
      }

      let multiRestCount: number | undefined = undefined;
      for (const track of paragraph.tracks) {
        const m = track.measures[measureInParagraph];
        if (m?.multiRestCount !== undefined) {
          if (multiRestCount === undefined || m.multiRestCount < multiRestCount) {
            multiRestCount = m.multiRestCount;
          }
        }
      }

      measures.push({
        globalIndex,
        paragraphIndex,
        measureInParagraph,
        sourceLine: paragraph.tracks[0]?.measures[measureInParagraph]?.sourceLine ?? 0,
        multiRestCount,
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
