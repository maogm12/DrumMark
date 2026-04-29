import { buildScoreAst } from "./ast";
import {
  addFractions,
  multiplyFraction,
  divideFraction,
  simplify,
  voiceForTrack,
} from "./logic";
import {
  type Fraction,
  type NormalizedEvent,
  type NormalizedHeader,
  type NormalizedScore,
  type ScoreAst,
  type TrackFamily,
  type NormalizedTrack,
  type TrackName,
  type TokenGlyph,
  type BasicGlyph,
  type Modifier,
  TRACKS,
} from "./types";

import { resolveFallbackTrack } from "./logic";

const CYMBAL_TRACKS = new Set<TrackName>(["HH", "RC", "RC2", "C", "C2", "SPL", "CHN"]);
const DRUM_TRACKS = new Set<TrackName>(["SD", "BD", "BD2", "T1", "T2", "T3", "T4"]);
const PEDAL_TRACKS = new Set<TrackName>(["HF"]);
const PERCUSSION_TRACKS = new Set<TrackName>(["CB", "WB", "CL"]);

function getTrackFamily(track: TrackName): TrackFamily {
  if (CYMBAL_TRACKS.has(track)) return "cymbal";
  if (DRUM_TRACKS.has(track)) return "drum";
  if (PEDAL_TRACKS.has(track)) return "pedal";
  if (PERCUSSION_TRACKS.has(track)) return "percussion";
  return "auxiliary";
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

  // Basic token weight with dots and halves
  const base = 1;
  const dotMultiplier = 2 - Math.pow(0.5, token.dots);
  const halfDivider = Math.pow(2, token.halves);
  return (base * dotMultiplier) / halfDivider;
}

type ResolvedToken = {
  track: TrackName;
  glyph: Exclude<BasicGlyph, "-">;
  modifiers: Modifier[];
};

function resolveToken(
  token: Extract<TokenGlyph, { kind: "basic" }>,
  contextTrack: TrackName | "ANONYMOUS",
): ResolvedToken | null {
  if (token.value === "-") return null;

  let track: TrackName;
  let glyph: Exclude<BasicGlyph, "-"> = "d";
  const modifiers = [...token.modifiers];

  // 1. Resolve Track (Hierarchy)
  if (token.trackOverride && TRACKS.includes(token.trackOverride as TrackName)) {
    track = token.trackOverride as TrackName;
  } else if (contextTrack !== "ANONYMOUS") {
    track = contextTrack;
  } else {
    track = resolveFallbackTrack(token.value);
  }

  // 2. Resolve Magic Tokens (Mapping to d + modifiers)
  const v = token.value;
  if (["S", "B", "B2", "X", "P", "R", "R2", "C", "C2", "O", "D", "G", "SPL", "CHN", "CB", "WB", "CL"].includes(v)) {
    if (!modifiers.includes("accent")) modifiers.push("accent");
  }

  if (v === "g" || v === "G") {
    if (!modifiers.includes("ghost")) modifiers.push("ghost");
  }

  if (v === "o" || v === "O") {
    if (!modifiers.includes("open")) modifiers.push("open");
  }

  // 3. Context-aware x/X mapping for Drum Family
  if ((v === "x" || v === "X") && getTrackFamily(track) === "drum") {
    if (!modifiers.includes("cross")) modifiers.push("cross");
  }

  // 4. Notehead Selection (Glyph semantic)
  if (track === "ST") {
    glyph = token.value as Exclude<BasicGlyph, "-">;
  } else if (getTrackFamily(track) === "cymbal") {
    glyph = "x";
  } else {
    glyph = "d";
  }

  return { track, glyph, modifiers };
}

function tokenToEvents(
  token: TokenGlyph,
  start: Fraction,
  duration: Fraction,
  contextTrack: TrackName | "ANONYMOUS",
  paragraphIndex: number,
  measureIndex: number,
  measureInParagraph: number,
): NormalizedEvent[] {
  if (token.kind === "basic") {
    const resolved = resolveToken(token, contextTrack);
    if (!resolved) return [];

    const primaryModifier = resolved.modifiers.find((m) => m !== "accent");

    const kind: NormalizedEvent["kind"] = resolved.track === "ST" ? "sticking" : "hit";

    return [
      {
        track: resolved.track,
        paragraphIndex,
        measureIndex,
        measureInParagraph,
        start,
        duration,
        kind,
        glyph: resolved.glyph,
        modifiers: resolved.modifiers,
        modifier: primaryModifier,
        voice: voiceForTrack(resolved.track),
        beam: "none",
      },
    ];
  }

  if (token.kind === "combined") {
    return token.items.flatMap((item) =>
      tokenToEvents(item, start, duration, contextTrack, paragraphIndex, measureIndex, measureInParagraph),
    );
  }

  if (token.kind === "braced") {
    const events: NormalizedEvent[] = [];
    let currentStart = start;
    token.items.forEach((item) => {
      const weight = calculateTokenWeight(item);
      const itemDuration = multiplyFraction(duration, weight / calculateTokenWeight(token));
      events.push(
        ...tokenToEvents(
          item,
          currentStart,
          itemDuration,
          token.track as TrackName,
          paragraphIndex,
          measureIndex,
          measureInParagraph,
        ),
      );
      currentStart = addFractions(currentStart, itemDuration);
    });
    return events;
  }

  if (token.kind === "group") {
    const events: NormalizedEvent[] = [];
    const totalWeight = token.items.reduce((sum, item) => sum + calculateTokenWeight(item), 0);

    let currentStart = start;
    token.items.forEach((item) => {
      const itemWeight = calculateTokenWeight(item);
      const itemDuration = multiplyFraction(duration, itemWeight / totalWeight);

      events.push(
        ...tokenToEvents(
          item,
          currentStart,
          itemDuration,
          contextTrack,
          paragraphIndex,
          measureIndex,
          measureInParagraph,
        ),
      );
      currentStart = addFractions(currentStart, itemDuration);
    });
    return events;
  }

  return [];
}

export function normalizeScoreAst(ast: ScoreAst): NormalizedScore {
  const measures: NormalizedScore["measures"] = [];
  let globalMeasureIndex = 0;

  for (const [paragraphIndex, paragraph] of ast.paragraphs.entries()) {
    for (let measureInParagraph = 0; measureInParagraph < paragraph.measureCount; measureInParagraph += 1) {
      const events: NormalizedEvent[] = [];
      let sourceLine = 0;
      const measureMeta = paragraph.tracks.map((trackLine) => trackLine.measures[measureInParagraph]).find((measure) => measure !== undefined);

      for (const trackLine of paragraph.tracks) {
        const measure = trackLine.measures[measureInParagraph];
        if (!measure) continue;

        sourceLine = measure.sourceLine || sourceLine;

        const measureDuration = {
          numerator: ast.headers.time.beats,
          denominator: ast.headers.time.beatUnit,
        };
        const divisions = ast.headers.divisions.value;
        const slotDuration = simplify({
          numerator: measureDuration.numerator,
          denominator: measureDuration.denominator * divisions,
        });

        let currentSlotOffset = 0;
        for (const token of measure.tokens) {
          const weight = calculateTokenWeight(token);
          const tokenStart = multiplyFraction(slotDuration, currentSlotOffset);
          const tokenDuration = multiplyFraction(slotDuration, weight);

          // Validation: Check grouping boundaries
          const startSlot = currentSlotOffset;
          const endSlot = currentSlotOffset + weight;
          let cumulativeGrouping = 0;
          for (const groupSize of ast.headers.grouping.values) {
            cumulativeGrouping += groupSize;
            if (startSlot < cumulativeGrouping - 0.001 && endSlot > cumulativeGrouping + 0.001) {
              ast.errors.push({
                line: measure.sourceLine || 0,
                column: 1,
                message: `Token \`${token.kind === "basic" ? token.value : "group"}\` crosses grouping boundary at ${cumulativeGrouping} in track ${trackLine.track}`,
              });
            }
          }

          events.push(
            ...tokenToEvents(
              token,
              tokenStart,
              tokenDuration,
              trackLine.track as TrackName | "ANONYMOUS",
              paragraphIndex,
              globalMeasureIndex,
              measureInParagraph,
            ),
          );
          currentSlotOffset += weight;
        }

        // Pad if measure is short (validation)
        if (
          measure.measureRepeat === undefined &&
          measure.multiRest === undefined &&
          Math.abs(currentSlotOffset - divisions) > 0.001
        ) {
          ast.errors.push({
            line: measure.sourceLine || 0,
            column: 1,
            message: `Track \`${trackLine.track}\` measure ${measureInParagraph + 1} has invalid duration: used ${currentSlotOffset} slots, expected ${divisions}`,
          });
        }
      }

      measures.push({
        index: globalMeasureIndex,
        globalIndex: globalMeasureIndex,
        paragraphIndex,
        measureInParagraph,
        sourceLine,
        events,
        generated: measureMeta?.generated,
        barline: measureMeta?.barline,
        marker: measureMeta?.marker,
        jump: measureMeta?.jump,
        volta: measureMeta?.volta,
        measureRepeat: measureMeta?.measureRepeat,
        multiRest: measureMeta?.multiRest,
        multiRestCount: measureMeta?.multiRestCount,
      });
      globalMeasureIndex++;
    }
  }

  const header: NormalizedHeader = {
    ...(ast.headers.title ? { title: ast.headers.title.value } : {}),
    ...(ast.headers.subtitle ? { subtitle: ast.headers.subtitle.value } : {}),
    ...(ast.headers.composer ? { composer: ast.headers.composer.value } : {}),
    tempo: ast.headers.tempo.value,
    timeSignature: {
      beats: ast.headers.time.beats,
      beatUnit: ast.headers.time.beatUnit,
    },
    divisions: ast.headers.divisions.value,
    grouping: [...ast.headers.grouping.values],
  };

  const trackIds = new Set<TrackName>();
  for (const paragraph of ast.paragraphs) {
    for (const track of paragraph.tracks) {
      if (track.track !== "ANONYMOUS") {
        trackIds.add(track.track);
      }
    }
  }

  const tracks: NormalizedTrack[] = [...trackIds].map((id) => ({
    id,
    family: getTrackFamily(id),
  }));

  return {
    version: "1.0",
    header,
    tracks,
    ast,
    measures,
    errors: ast.errors,
  };
}

export function buildNormalizedScore(source: string): NormalizedScore {
  return normalizeScoreAst(buildScoreAst(source));
}
