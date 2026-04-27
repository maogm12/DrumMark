import type { Fraction, NormalizedEvent, NormalizedScore, TrackName } from "./types";
export type { Fraction };

// --- Fraction Math ---

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
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
  const numerator = fraction.numerator / divisor;
  const denominator = fraction.denominator / divisor;
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

export function multiplyFraction(fraction: Fraction, multiplier: number): Fraction {
  return simplify({
    numerator: fraction.numerator * multiplier,
    denominator: fraction.denominator,
  });
}

export function divideFraction(fraction: Fraction, divisor: number): Fraction {
  return simplify({
    numerator: fraction.numerator,
    denominator: fraction.denominator * divisor,
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

// --- Musical Logic ---

export type VoiceId = 1 | 2;

export function voiceForTrack(track: TrackName): VoiceId {
  switch (track) {
    case "BD":
    case "HF":
      return 2;
    default:
      return 1;
  }
}

export function stemDirectionForVoice(voice: VoiceId): "up" | "down" {
  return voice === 1 ? "up" : "down";
}

/**
 * Returns which grouping segment a position belongs to, based on the 'grouping' header.
 * Used for beaming logic.
 */
export function groupingSegmentIndex(score: NormalizedScore, positionInMeasure: Fraction): number {
  const grouping = score.ast.headers.grouping.values;
  const time = score.ast.headers.time;
  
  // Convert position to a value in units of the time signature's denominator
  const posInUnits = (positionInMeasure.numerator * time.beatUnit) / positionInMeasure.denominator;
  
  let accumulated = 0;
  for (const [i, g] of grouping.entries()) {
    accumulated += g;
    if (posInUnits < accumulated - 0.0001) {
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

  return divideFraction(multiplyFraction(duration, event.tuplet.actual), event.tuplet.normal);
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
  if (v === "t1" || v === "T1") return "T1";
  if (v === "t2" || v === "T2") return "T2";
  if (v === "t3" || v === "T3") return "T3";
  if (v === "c" || v === "C") return "C";
  if (v === "r" || v === "R") return "RC";
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
 */
export function buildVoiceEntries(
  groups: VoiceEventGroup[],
  measureStart: Fraction,
  measureDuration: Fraction,
): VoiceEntry[] {
  const entries: VoiceEntry[] = [];
  let cursor = measureStart;

  for (const group of groups) {
    if (compareFractions(group.start, cursor) > 0) {
      entries.push({
        kind: "rest",
        start: cursor,
        duration: subtractFractions(group.start, cursor),
      });
    }

    entries.push({
      kind: "notes",
      start: group.start,
      duration: group.duration,
      events: group.events,
    });

    cursor = addFractions(group.start, group.duration);
  }

  const measureEnd = addFractions(measureStart, measureDuration);
  if (compareFractions(cursor, measureEnd) < 0) {
    entries.push({
      kind: "rest",
      start: cursor,
      duration: subtractFractions(measureEnd, cursor),
    });
  }

  return entries;
}
