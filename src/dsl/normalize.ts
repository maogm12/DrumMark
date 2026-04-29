import { buildScoreAst } from "./ast";
import {
  addFractions,
  multiplyFractions,
  divideFractions,
  simplify,
  voiceForTrack,
  calculateTokenWeightAsFraction,
  compareFractions,
  fractionsEqual,
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
const STATIC_MAGIC_TOKENS = new Set<BasicGlyph>([
  "s",
  "S",
  "b",
  "B",
  "b2",
  "B2",
  "r",
  "R",
  "r2",
  "R2",
  "c",
  "C",
  "c2",
  "C2",
  "t1",
  "T1",
  "t2",
  "T2",
  "t3",
  "T3",
  "t4",
  "T4",
  "o",
  "O",
  "spl",
  "SPL",
  "chn",
  "CHN",
  "cb",
  "CB",
  "wb",
  "WB",
  "cl",
  "CL",
]);
const ACCENT_MAGIC_TOKENS = new Set<BasicGlyph>([
  "D",
  "X",
  "P",
  "G",
  "S",
  "B",
  "B2",
  "R",
  "R2",
  "C",
  "C2",
  "O",
  "SPL",
  "CHN",
  "CB",
  "WB",
  "CL",
]);

function getTrackFamily(track: TrackName): TrackFamily {
  if (CYMBAL_TRACKS.has(track)) return "cymbal";
  if (DRUM_TRACKS.has(track)) return "drum";
  if (PEDAL_TRACKS.has(track)) return "pedal";
  if (PERCUSSION_TRACKS.has(track)) return "percussion";
  return "auxiliary";
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
  const explicitTrack = token.trackOverride && TRACKS.includes(token.trackOverride as TrackName)
    ? token.trackOverride as TrackName
    : undefined;
  const stickingToken = token.value === "R" || token.value === "L";

  // 1. Resolve Track (Hierarchy)
  if (explicitTrack) {
    track = explicitTrack;
  } else if (contextTrack === "ST" && stickingToken) {
    track = "ST";
  } else if (STATIC_MAGIC_TOKENS.has(token.value)) {
    track = resolveFallbackTrack(token.value);
  } else if (contextTrack !== "ANONYMOUS") {
    track = contextTrack;
  } else {
    track = resolveFallbackTrack(token.value);
  }

  // 2. Resolve Magic Tokens (Mapping to d + modifiers)
  const v = token.value;
  if (ACCENT_MAGIC_TOKENS.has(v) && !(track === "ST" && stickingToken)) {
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
  inheritedTuplet?: { actual: number; normal: number },
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
        ...(inheritedTuplet ? { tuplet: inheritedTuplet } : {}),
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
    const totalWeight = calculateTokenWeightAsFraction(token);

    token.items.forEach((item) => {
      const itemWeight = calculateTokenWeightAsFraction(item);
      const itemDuration = multiplyFractions(duration, divideFractions(itemWeight, totalWeight));
      
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
    const totalWeight = token.items.reduce(
      (sum, item) => addFractions(sum, calculateTokenWeightAsFraction(item)),
      { numerator: 0, denominator: 1 },
    );
    // For groups with more than 1 item (e.g., [1: d d d] or [2: d d:flam d]),
    // this represents a tuplet where actual = number of items and normal = span.
    // span=1 means each item occupies 1/3 of its slot (e.g., [1: d d d] is a triplet).
    // span=2 means the group spans 2 slots with items compressed.
    const groupTuplet = token.count > 1 ? { actual: token.count, normal: token.span } : undefined;

    let currentStart = start;
    token.items.forEach((item) => {
      const itemWeight = calculateTokenWeightAsFraction(item);
      const itemDuration = multiplyFractions(duration, divideFractions(itemWeight, totalWeight));

      events.push(
        ...tokenToEvents(
          item,
          currentStart,
          itemDuration,
          contextTrack,
          paragraphIndex,
          measureIndex,
          measureInParagraph,
          groupTuplet,
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

        let currentSlotOffset: Fraction = { numerator: 0, denominator: 1 };
        const divisionsFrac: Fraction = { numerator: divisions, denominator: 1 };
        
        for (const token of measure.tokens) {
          const weight = calculateTokenWeightAsFraction(token);
          const tokenStart = multiplyFractions(slotDuration, currentSlotOffset);
          const tokenDuration = multiplyFractions(slotDuration, weight);

          // Validation: Check grouping boundaries
          const startSlot = currentSlotOffset;
          const endSlot = addFractions(currentSlotOffset, weight);
          
          let cumulativeGrouping = 0;
          for (const groupSize of ast.headers.grouping.values) {
            cumulativeGrouping += groupSize;
            const boundaryFrac: Fraction = { numerator: cumulativeGrouping, denominator: 1 };
            
            // startSlot < boundaryFrac AND endSlot > boundaryFrac
            if (compareFractions(startSlot, boundaryFrac) < 0 && compareFractions(endSlot, boundaryFrac) > 0) {
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
          currentSlotOffset = addFractions(currentSlotOffset, weight);
        }

        // Pad if measure is short (validation)
        if (
          measure.measureRepeat === undefined &&
          measure.multiRest === undefined &&
          !fractionsEqual(currentSlotOffset, divisionsFrac)
        ) {
          ast.errors.push({
            line: measure.sourceLine || 0,
            column: 1,
            message: `Track \`${trackLine.track}\` measure ${measureInParagraph + 1} has invalid duration: used ${currentSlotOffset.numerator}/${currentSlotOffset.denominator} slots, expected ${divisions}`,
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
