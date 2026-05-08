import type { NormalizedScore } from "../dsl/types";
import {
  buildVoiceEntries,
  compareFractions,
  getGroupingBoundaries,
  groupVoiceEvents,
  multiplyFraction,
  subtractFractions,
  voiceForTrack,
  type Fraction,
  type VoiceEntry,
} from "../dsl/logic";
import { modifierIsGrace } from "./articulations";

export type RenderMeasure = {
  measure: NormalizedScore["measures"][number];
  kind: "normal" | "measure-repeat-1" | "measure-repeat-2-start" | "measure-repeat-2-stop";
};

export type MeasureSpacingPlan = {
  orderedStartKeys: string[];
  normalizedOffsets: number[];
};

export type MeasureWidthPlan = {
  widths: number[];
  xOffsets: number[];
};

const DURATION_SPACING_GROUP_BONUS = 0.12;
const DURATION_SPACING_MIN_CLAMP = 0.7;
const DURATION_SPACING_MAX_CLAMP = 1.8;
const MEASURE_WIDTH_MIN_CLAMP = 0.72;
const MEASURE_WIDTH_MAX_CLAMP = 1.6;

export function fractionKey(fraction: Fraction): string {
  return `${fraction.numerator}/${fraction.denominator}`;
}

export function fractionValue(fraction: Fraction): number {
  return fraction.numerator / fraction.denominator;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildMeasureSpacingPlan(
  score: NormalizedScore,
  measureStart: Fraction,
  measureDuration: Fraction,
  voiceEntries: VoiceEntry[][],
  compression: number,
): MeasureSpacingPlan | undefined {
  const normalizedEntries = voiceEntries.flatMap((entries) => {
    if (entries.length > 0 && entries.every((entry) => entry.kind === "rest")) {
      return [{ kind: "rest", start: measureStart, duration: measureDuration } satisfies Pick<VoiceEntry, "kind" | "start" | "duration">];
    }
    return entries.map((entry) => ({ kind: entry.kind, start: entry.start, duration: entry.duration }));
  });

  if (normalizedEntries.length <= 1) return undefined;

  const startsByKey = new Map<string, Fraction>();
  for (const entry of normalizedEntries) {
    const relativeStart = subtractFractions(entry.start, measureStart);
    const key = fractionKey(relativeStart);
    if (!startsByKey.has(key)) {
      startsByKey.set(key, relativeStart);
    }
  }

  const orderedStarts = [...startsByKey.entries()]
    .map(([key, fraction]) => ({ key, fraction }))
    .sort((left, right) => compareFractions(left.fraction, right.fraction));

  if (orderedStarts.length <= 1) return undefined;

  const measureEnd = measureDuration;
  const segmentDurations = orderedStarts.map((start, index) => {
    const nextStart = orderedStarts[index + 1]?.fraction ?? measureEnd;
    return subtractFractions(nextStart, start.fraction);
  });

  const minUnit = segmentDurations.reduce<Fraction | undefined>((currentMin, duration) => {
    if (compareFractions(duration, { numerator: 0, denominator: 1 }) <= 0) return currentMin;
    if (!currentMin || compareFractions(duration, currentMin) < 0) return duration;
    return currentMin;
  }, undefined);
  if (!minUnit) return undefined;

  const chunkStartKeys = new Set<string>();
  for (const boundary of getGroupingBoundaries(measureStart, score.header.grouping, score.header.timeSignature)) {
    const relativeBoundary = subtractFractions(boundary, measureStart);
    if (compareFractions(relativeBoundary, measureDuration) >= 0) continue;
    chunkStartKeys.add(fractionKey(relativeBoundary));
  }

  const rawWeights = orderedStarts.map(({ key }, index) => {
    const duration = segmentDurations[index]!;
    const ratio = fractionValue(duration) / Math.max(fractionValue(minUnit), Number.EPSILON);
    const durationBonus = compression * Math.log2(ratio + 1);
    const boundaryBonus = chunkStartKeys.has(key) ? DURATION_SPACING_GROUP_BONUS : 0;
    return 1 + durationBonus + boundaryBonus;
  });

  const averageWeight = rawWeights.reduce((sum, weight) => sum + weight, 0) / rawWeights.length;
  const clampedWeights = rawWeights.map((weight) =>
    clampNumber(weight, averageWeight * DURATION_SPACING_MIN_CLAMP, averageWeight * DURATION_SPACING_MAX_CLAMP),
  );
  const totalWeight = clampedWeights.reduce((sum, weight) => sum + weight, 0);

  let cumulative = 0;
  const normalizedOffsets = clampedWeights.map((_, index) => {
    if (index === 0) return 0;
    cumulative += clampedWeights[index - 1]! / totalWeight;
    return cumulative;
  });

  return {
    orderedStartKeys: orderedStarts.map(({ key }) => key),
    normalizedOffsets,
  };
}

export function buildMeasureEntries(
  score: NormalizedScore,
  renderMeasure: RenderMeasure,
): VoiceEntry[][] {
  const measureDuration = {
    numerator: score.header.timeSignature.beats,
    denominator: score.header.timeSignature.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, renderMeasure.measure.globalIndex);
  const upEvents = renderMeasure.measure.events.filter((event: any) => voiceForTrack(event.track) === 1 && event.track !== "ST");
  const downEvents = renderMeasure.measure.events.filter((event: any) => voiceForTrack(event.track) === 2 && event.track !== "ST");

  const upEntries = buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration, score.header.grouping, score.header.timeSignature);
  const downEntries = buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration, score.header.grouping, score.header.timeSignature);
  return [upEntries, downEntries];
}

export function buildMeasureContentWeight(
  score: NormalizedScore,
  renderMeasure: RenderMeasure,
  compression: number,
): number {
  if (renderMeasure.measure.multiRest) return 1;
  if (renderMeasure.kind === "measure-repeat-1" || renderMeasure.kind === "measure-repeat-2-start" || renderMeasure.kind === "measure-repeat-2-stop") {
    return 1;
  }

  const measureDuration = {
    numerator: score.header.timeSignature.beats,
    denominator: score.header.timeSignature.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, renderMeasure.measure.globalIndex);
  const entriesByVoice = buildMeasureEntries(score, renderMeasure);
  const upEntries = entriesByVoice[0] ?? [];
  const downEntries = entriesByVoice[1] ?? [];
  const visibleVoices = [upEntries, downEntries].filter((entries): entries is VoiceEntry[] => entries.some((entry) => entry.kind === "notes"));
  const contributingEntries: VoiceEntry[] = visibleVoices.length > 0 ? visibleVoices.flat() : [];
  if (contributingEntries.length === 0) return 1;

  const segmentKeys = new Set(
    contributingEntries.map((entry) => fractionKey(subtractFractions(entry.start, measureStart))),
  );
  const segmentCount = Math.max(1, segmentKeys.size);

  const stickingCount = renderMeasure.measure.events.filter((event) => event.kind === "sticking").length;
  const hasTuplet = renderMeasure.measure.events.some((event) => event.tuplet !== undefined);
  const hasGrace = renderMeasure.measure.events.some((event) => modifierIsGrace(event));
  const contentBonus = compression * Math.log2(segmentCount);
  const modifierBonus =
    (hasTuplet ? 0.15 : 0)
    + (stickingCount >= 3 ? 0.1 : 0)
    + (hasGrace ? 0.1 : 0);

  return 1 + contentBonus + modifierBonus;
}

export function normalizeMeasureWeightsToWidths(weights: number[], totalWidth: number): number[] {
  if (weights.length === 0) return [];
  const equalWidth = totalWidth / weights.length;
  const minWidth = equalWidth * MEASURE_WIDTH_MIN_CLAMP;
  const maxWidth = equalWidth * MEASURE_WIDTH_MAX_CLAMP;
  const widths = new Array<number>(weights.length).fill(0);
  const remaining = new Set(weights.map((_, index) => index));
  let remainingWidth = totalWidth;
  let remainingWeight = weights.reduce((sum, weight) => sum + weight, 0);

  while (remaining.size > 0) {
    let changed = false;

    for (const index of [...remaining]) {
      const proposed = remainingWidth * (weights[index]! / remainingWeight);
      if (proposed < minWidth) {
        widths[index] = minWidth;
        remaining.delete(index);
        remainingWidth -= minWidth;
        remainingWeight -= weights[index]!;
        changed = true;
      } else if (proposed > maxWidth) {
        widths[index] = maxWidth;
        remaining.delete(index);
        remainingWidth -= maxWidth;
        remainingWeight -= weights[index]!;
        changed = true;
      }
    }

    if (!changed) {
      for (const index of remaining) {
        widths[index] = remainingWidth * (weights[index]! / remainingWeight);
      }
      break;
    }

    if (remainingWeight <= 0) {
      const fallback = remaining.size > 0 ? remainingWidth / remaining.size : 0;
      for (const index of remaining) {
        widths[index] = fallback;
      }
      break;
    }
  }

  return widths;
}

export function buildMeasureWidthPlan(
  score: NormalizedScore,
  measures: RenderMeasure[],
  totalWidth: number,
  compression: number,
): MeasureWidthPlan {
  const weights = measures.map((measure) => buildMeasureContentWeight(score, measure, compression));

  for (let i = 0; i < measures.length - 1; i++) {
    if (measures[i]?.kind === "measure-repeat-2-start" && measures[i + 1]?.kind === "measure-repeat-2-stop") {
      const sharedWeight = Math.max(weights[i] ?? 1, weights[i + 1] ?? 1);
      weights[i] = sharedWeight;
      weights[i + 1] = sharedWeight;
      i += 1;
    }
  }

  const widths = normalizeMeasureWeightsToWidths(weights, totalWidth);
  const xOffsets: number[] = [];
  let cursor = 0;
  for (const measureWidth of widths) {
    xOffsets.push(cursor);
    cursor += measureWidth;
  }

  return { widths, xOffsets };
}
