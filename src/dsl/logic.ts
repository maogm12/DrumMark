import type { Fraction, NormalizedEvent, NormalizedScore, TrackName, TokenGlyph } from "./types";
export type { Fraction };

// --- Fraction Math ---

export function gcd(a: number, b: number): number {
  let x = Math.round(Math.abs(a));
  let y = Math.round(Math.abs(b));
  
  if (isNaN(x) || isNaN(y)) return 1;

  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

export function simplify(fraction: Fraction): Fraction {
  const divisor = gcd(fraction.numerator, fraction.denominator);
  const numerator = Math.round(fraction.numerator / divisor);
  const denominator = Math.round(fraction.denominator / divisor);
  if (denominator < 0) {
    return { numerator: -numerator, denominator: -denominator };
  }
  return { numerator, denominator };
}

export function addFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

export function subtractFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

export function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

export function divideFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

export function multiplyFraction(fraction: Fraction, multiplier: number): Fraction {
  return multiplyFractions(fraction, fractionFromNumber(multiplier));
}

export function divideFraction(fraction: Fraction, divisor: number): Fraction {
  return divideFractions(fraction, fractionFromNumber(divisor));
}

export function fractionFromNumber(n: number): Fraction {
  if (Number.isInteger(n)) {
    return { numerator: n, denominator: 1 };
  }

  const s = n.toString();
  if (s.includes(".")) {
    const parts = s.split(".");
    const decimalPlaces = Math.min(parts[1]!.length, 9);
    const denominator = Math.pow(10, decimalPlaces);
    const numerator = Math.round(n * denominator);
    return simplify({ numerator, denominator });
  }

  const precision = 1000000;
  return simplify({
    numerator: Math.round(n * precision),
    denominator: precision,
  });
}

export function fractionsEqual(left: Fraction, right: Fraction): boolean {
  const a = simplify(left);
  const b = simplify(right);
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export function compareFractions(left: Fraction, right: Fraction): number {
  const denominator = lcm(left.denominator, right.denominator);
  const leftValue = left.numerator * (denominator / left.denominator);
  const rightValue = right.numerator * (denominator / right.denominator);
  return leftValue - rightValue;
}

export function resolveMeasureRepeatContentMeasure(
  score: NormalizedScore,
  measure: NormalizedScore["measures"][number] | undefined,
  slashHint?: number,
): NormalizedScore["measures"][number] | undefined {
  if (!measure) return undefined;
  const slashes = slashHint ?? measure.measureRepeat?.slashes;
  if (!slashes) return measure;
  if (slashes === 1) {
    return resolveMeasureRepeatContentMeasure(score, score.measures[measure.globalIndex - 1]);
  }
  return resolveMeasureRepeatContentMeasure(score, score.measures[measure.globalIndex - slashes]);
}

// --- Musical Logic ---

export type VoiceId = 1 | 2;

export function voiceForTrack(track: TrackName): VoiceId {
  switch (track) {
    case "BD":
    case "BD2":
    case "HF":
      return 2;
    default:
      return 1;
  }
}

export function calculateTokenWeightAsFraction(token: TokenGlyph): Fraction {
  if (
    token.kind === "crescendo_start"
    || token.kind === "decrescendo_start"
    || token.kind === "hairpin_end"
  ) {
    return { numerator: 0, denominator: 1 };
  }
  if (token.kind === "group") {
    return { numerator: token.span, denominator: 1 };
  }
  if (token.kind === "combined") {
    // Combined hit weight is the max weight of its items
    let maxWeight = { numerator: 0, denominator: 1 };
    for (const item of token.items) {
      const weight = calculateTokenWeightAsFraction(item);
      if (compareFractions(weight, maxWeight) > 0) {
        maxWeight = weight;
      }
    }
    return maxWeight;
  }
  if (token.kind === "braced") {
    return token.items.reduce((sum, item) => addFractions(sum, calculateTokenWeightAsFraction(item)), {
      numerator: 0,
      denominator: 1,
    });
  }

  // Weight formula: weight = base * (2 - 0.5^dots) * (2^stars) / (2^halves)
  // dots=1: 1.5 = 3/2
  // dots=2: 1.75 = 7/4
  // dots=3: 1.875 = 15/8
  // numerator = 2^(dots+1) - 1, denominator = 2^dots

  const dotNumerator = (1 << (token.dots + 1)) - 1;
  const dotDenominator = 1 << token.dots;
  const dotWeight: Fraction = { numerator: dotNumerator, denominator: dotDenominator };

  const halfDivider = 1 << token.halves;
  const starMultiplier = 1 << token.stars; // 2^stars
  return simplify({
    numerator: dotWeight.numerator * starMultiplier,
    denominator: dotWeight.denominator * halfDivider,
  });
}

export function stemDirectionForVoice(voice: VoiceId): "up" | "down" {
  return voice === 1 ? "up" : "down";
}

/**
 * Returns which grouping segment a position belongs to, based on the 'grouping' header.
 * Used for beaming logic.
 */
export function groupingSegmentIndex(score: NormalizedScore, positionInMeasure: Fraction): number {
  const grouping = score.header.grouping;
  const time = score.header.timeSignature;

  let accumulated = 0;
  for (const [i, g] of grouping.entries()) {
    accumulated += g;
    const boundary = simplify({
      numerator: accumulated,
      denominator: time.beatUnit,
    });
    if (compareFractions(positionInMeasure, boundary) < 0) {
      return i;
    }
  }
  return Math.max(0, grouping.length - 1);
}

export function isBeamable(duration: Fraction): boolean {
  const normalized = simplify(duration);
  // Eighth notes (1/8) or shorter (1/16, etc.) are beamable.
  return normalized.denominator >= 8;
}

export function visualDurationForEvent(event: NormalizedEvent, duration: Fraction): Fraction {
  if (!event.tuplet || event.tuplet.actual % event.tuplet.normal === 0) {
    return duration;
  }

  return divideFractions(multiplyFraction(duration, event.tuplet.actual), fractionFromNumber(event.tuplet.normal));
}

export type InstrumentSpec = {
  displayStep: string;
  displayOctave: number;
  notehead?: "x" | "slash" | "diamond" | "circle-x";
};

// --- Voice Entry Types ---

export type VoiceEventGroup = {
  start: Fraction; // Absolute start in score
  duration: Fraction;
  events: NormalizedEvent[];
};

export type VoiceEntry =
  | { kind: "rest"; start: Fraction; duration: Fraction }
  | { kind: "notes"; start: Fraction; duration: Fraction; events: NormalizedEvent[] };

export function resolveFallbackTrack(glyph: string): TrackName {
  const v = glyph;
  if (v === "s" || v === "S") return "SD";
  if (v === "b" || v === "B") return "BD";
  if (v === "b2" || v === "B2") return "BD2";
  if (v === "t1" || v === "T1") return "T1";
  if (v === "t2" || v === "T2") return "T2";
  if (v === "t3" || v === "T3") return "T3";
  if (v === "t4" || v === "T4") return "T4";
  if (v === "c" || v === "C") return "C";
  if (v === "c2" || v === "C2") return "C2";
  if (v === "r" || v === "R") return "RC";
  if (v === "r2" || v === "R2") return "RC2";
  if (v === "spl" || v === "SPL") return "SPL";
  if (v === "chn" || v === "CHN") return "CHN";
  if (v === "cb" || v === "CB") return "CB";
  if (v === "wb" || v === "WB") return "WB";
  if (v === "cl" || v === "CL") return "CL";
  if (v === "p" || v === "P") return "HF";
  if (v === "g" || v === "G") return "SD";
  return "HH"; // Default for x, d, o etc.
}

/**
 * Groups events by their start time and duration.
 */
export function groupVoiceEvents(events: NormalizedEvent[]): VoiceEventGroup[] {
  const sorted = [...events].sort((left, right) => {
    const startCompare = compareFractions(left.start, right.start);
    if (startCompare !== 0) return startCompare;
    return compareFractions(left.duration, right.duration);
  });

  const groups: VoiceEventGroup[] = [];
  for (const event of sorted) {
    const current = groups[groups.length - 1];
    if (current && fractionsEqual(current.start, event.start) && fractionsEqual(current.duration, event.duration)) {
      current.events.push(event);
      continue;
    }
    groups.push({
      start: event.start,
      duration: event.duration,
      events: [event],
    });
  }
  return groups;
}

/**
 * Fills gaps with rests and returns a continuous sequence of entries for a voice in a measure.
 * Rests are split at grouping boundaries for proper layout.
 */
export function buildVoiceEntries(
  groups: VoiceEventGroup[],
  measureStart: Fraction,
  measureDuration: Fraction,
  grouping: number[] = [],
  timeSignature?: { beats: number; beatUnit: number }
): VoiceEntry[] {
  const entries: VoiceEntry[] = [];
  let cursor = measureStart;
  const time = timeSignature ?? { beats: 4, beatUnit: 4 };

  for (const group of groups) {
    const absoluteGroupStart = addFractions(measureStart, group.start);
    if (compareFractions(absoluteGroupStart, cursor) > 0) {
      // Gap before this group - split at grouping boundaries
      const gapEnd = absoluteGroupStart;
      cursor = addRestsForSegment(entries, cursor, gapEnd, measureStart, grouping, time);
    }

    entries.push({
      kind: "notes",
      start: absoluteGroupStart,
      duration: group.duration,
      events: group.events,
    });

    cursor = addFractions(absoluteGroupStart, group.duration);
  }

  const measureEnd = addFractions(measureStart, measureDuration);
  if (compareFractions(cursor, measureEnd) < 0) {
    addRestsForSegment(entries, cursor, measureEnd, measureStart, grouping, time);
  }

  return entries;
}

/**
 * Adds rest entries filling from start to end, splitting at grouping boundaries.
 */
function addRestsForSegment(
  entries: VoiceEntry[],
  start: Fraction,
  end: Fraction,
  measureStart: Fraction,
  grouping: number[],
  timeSignature: { beats: number; beatUnit: number }
): Fraction {
  const boundaries = getGroupingBoundaries(measureStart, grouping, timeSignature);
  let cursor = start;

  for (const boundary of boundaries) {
    if (compareFractions(cursor, boundary) >= 0) continue;
    if (compareFractions(end, boundary) <= 0) {
      // Rest goes to end of measure
      entries.push({ kind: "rest", start: cursor, duration: subtractFractions(end, cursor) });
      return end;
    }
    // Rest goes to grouping boundary
    entries.push({ kind: "rest", start: cursor, duration: subtractFractions(boundary, cursor) });
    cursor = boundary;
  }

  if (compareFractions(cursor, end) < 0) {
    entries.push({ kind: "rest", start: cursor, duration: subtractFractions(end, cursor) });
    return end;
  }

  return cursor;
}

/**
 * Returns the grouping boundary positions as fractions from measure start.
 * E.g., for grouping [2, 2] in 4/4: boundaries are 2/4 and 4/4.
 */
export function getGroupingBoundaries(
  measureStart: Fraction,
  grouping: number[],
  timeSignature: { beats: number; beatUnit: number }
): Fraction[] {
  const boundaries: Fraction[] = [];
  let accumulated = 0;

  for (const g of grouping) {
    accumulated += g;
    // boundary = accumulated / beatUnit
    const boundary: Fraction = simplify({
      numerator: accumulated,
      denominator: timeSignature.beatUnit,
    });
    boundaries.push(addFractions(measureStart, boundary));
  }

  return boundaries;
}
