export const HEADER_FIELDS = ["title", "subtitle", "composer", "tempo", "time", "divisions", "note", "grouping"] as const;

export type HeaderField = (typeof HEADER_FIELDS)[number];

export const TRACKS = [
  "HH",
  "HF",
  "SD",
  "BD",
  "T1",
  "T2",
  "T3",
  "RC",
  "C",
  "ST",
  "BD2",
  "T4",
  "RC2",
  "C2",
  "SPL",
  "CHN",
  "CB",
  "WB",
  "CL",
] as const;

export type TrackName = (typeof TRACKS)[number];

export const MODIFIERS = [
  "accent",
  "open",
  "half-open",
  "close",
  "choke",
  "rim",
  "cross",
  "bell",
  "flam",
  "ghost",
  "drag",
  "roll",
  "dead",
] as const;

export type Modifier = (typeof MODIFIERS)[number];

export const DYNAMIC_LEVELS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"] as const;

export type DynamicLevel = (typeof DYNAMIC_LEVELS)[number];

export type BasicGlyph =
  | "-"
  | "x"
  | "X"
  | "d"
  | "D"
  | "p"
  | "P"
  | "R"
  | "L"
  | "o"
  | "O"
  | "c"
  | "C"
  | "c2"
  | "C2"
  | "s"
  | "S"
  | "b"
  | "B"
  | "b2"
  | "B2"
  | "r"
  | "R"
  | "r2"
  | "R2"
  | "t1"
  | "T1"
  | "t2"
  | "T2"
  | "t3"
  | "T3"
  | "t4"
  | "T4"
  | "g"
  | "G"
  | "spl"
  | "SPL"
  | "chn"
  | "CHN"
  | "cb"
  | "CB"
  | "wb"
  | "WB"
  | "cl"
  | "CL";

export type SourceLocation = {
  line: number;
  column: number;
  offset: number;
};

export type ParseError = {
  line: number;
  column: number;
  message: string;
};

export type RepeatSpan = {
  startBar: number;
  endBar: number;
  times: number;
};

export type Fraction = {
  numerator: number;
  denominator: number;
};

export type TrackFamily =
  | "cymbal"
  | "drum"
  | "pedal"
  | "percussion"
  | "auxiliary";

export type NormalizedEventKind =
  | "hit"
  | "rest"
  | "sticking";

export type TieState =
  | "start"
  | "stop"
  | "both";

export type BeamState =
  | "begin"
  | "continue"
  | "end"
  | "none";

export type BarlineType =
  | "regular"
  | "double"
  | "final"
  | "repeat-start"
  | "repeat-end"
  | "repeat-both";

export type StartNavKind =
  | "segno"
  | "coda";

export type EndNavKind =
  | "fine"
  | "dc"
  | "ds"
  | "dc-al-fine"
  | "dc-al-coda"
  | "ds-al-fine"
  | "ds-al-coda"
  | "to-coda";

export type TupletSpec = {
  actual: number;
  normal: number;
  span?: number;
  bracket?: boolean;
};

export type VoltaIntent = {
  indices: number[];
};

export type MeasureRepeatIntent = {
  slashes: number;
};

export type MultiRestIntent = {
  count: number;
};

export type HairpinIntent = {
  kind: "crescendo" | "decrescendo";
  start: Fraction;
  startMeasureIndex: number;
  end: Fraction;
  endMeasureIndex: number;
};

export type DynamicIntent = {
  level: DynamicLevel;
  at: Fraction;
};

export type NormalizedEvent = {
  track: TrackName;
  paragraphIndex: number;
  measureIndex: number;
  measureInParagraph: number;
  start: Fraction;
  duration: Fraction;
  visualDuration?: Fraction;
  kind: NormalizedEventKind;
  glyph: Exclude<BasicGlyph, "-">;
  modifiers: Modifier[];
  dotCount?: number;
  modifier?: Modifier;
  tuplet?: TupletSpec;
  tie?: TieState;
  voice?: 1 | 2;
  beam?: BeamState;
};

export type NormalizedMeasure = {
  index: number;
  globalIndex: number;
  paragraphIndex: number;
  measureInParagraph: number;
  sourceLine: number;
  events: NormalizedEvent[];
  generated?: boolean;
  barline?: BarlineType;
  repeatEndLocation?: SourceLocation;
  startNav?: StartNav;
  endNav?: EndNav;
  volta?: VoltaIntent;
  measureRepeat?: MeasureRepeatIntent;
  multiRest?: MultiRestIntent;
  multiRestCount?: number;
  hairpins?: HairpinIntent[];
  dynamics: DynamicIntent[];
  noteValue: number;
};

export type StartNav =
  | { kind: "coda"; anchor: "left-edge" }
  | { kind: "segno"; anchor: "left-edge" | { eventAfter: Fraction } };

export type EndNav =
  | { kind: "to-coda"; anchor: "right-edge" | { eventBefore: Fraction } }
  | { kind: "fine"; anchor: "right-edge" }
  | { kind: "dc"; anchor: "right-edge" }
  | { kind: "ds"; anchor: "right-edge" }
  | { kind: "dc-al-fine"; anchor: "right-edge" }
  | { kind: "dc-al-coda"; anchor: "right-edge" }
  | { kind: "ds-al-fine"; anchor: "right-edge" }
  | { kind: "ds-al-coda"; anchor: "right-edge" };

export type NormalizedHeader = {
  title?: string;
  subtitle?: string;
  composer?: string;
  tempo: number;
  timeSignature: {
    beats: number;
    beatUnit: number;
  };
  divisions: number;
  noteValue: number;
  grouping: number[];
};

export type NormalizedTrack = {
  id: TrackName;
  family: TrackFamily;
};

export type NormalizedScore = {
  version: string;
  header: NormalizedHeader;
  tracks: NormalizedTrack[];
  repeatSpans?: RepeatSpan[];
  measures: NormalizedMeasure[];
  errors: ParseError[];
};
