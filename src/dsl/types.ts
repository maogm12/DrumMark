export const HEADER_FIELDS = ["title", "subtitle", "composer", "tempo", "time", "divisions", "grouping"] as const;

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
export type SourceTrackName = TrackName;

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

export type RepeatEnd = {
  kind: "repeat_end";
  times: number;
};

export type MeasureBoundary =
  | { kind: "barline" }
  | { kind: "repeat_start" }
  | RepeatEnd;

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

export type TokenGlyph =
  | { kind: "basic"; value: BasicGlyph; dots: number; halves: number; modifiers: Modifier[]; trackOverride?: string }
  | { kind: "group"; count: number; span: number; items: TokenGlyph[] }
  | { kind: "combined"; items: TokenGlyph[] }
  | { kind: "braced"; track: string; items: TokenGlyph[] };

export type MeasureToken = TokenGlyph;

export type SourceLocation = {
  line: number;
  column: number;
  offset: number;
};

export type PreprocessedLineKind = "blank" | "comment" | "content";

export type PreprocessedLine = {
  kind: PreprocessedLineKind;
  lineNumber: number;
  raw: string;
  content: string;
  comment?: string;
  startOffset: number;
};

export type ParseError = {
  line: number;
  column: number;
  message: string;
};

export type ParsedMeasure = {
  content: string;
  tokens: MeasureToken[];
  repeatStart: boolean;
  repeatEnd: boolean;
  repeatTimes?: number;
  repeatCount?: number;
  multiRestCount?: number;
};

export type ParsedTrackLine = {
  track: SourceTrackName | "ANONYMOUS";
  lineNumber: number;
  measures: ParsedMeasure[];
  source: PreprocessedLine;
};

export type TempoHeader = {
  field: "tempo";
  value: number;
  line: number;
};

export type MetadataHeader = {
  field: "title" | "subtitle" | "composer";
  value: string;
  line: number;
};

export type TimeHeader = {
  field: "time";
  beats: number;
  beatUnit: number;
  line: number;
};

export type DivisionsHeader = {
  field: "divisions";
  value: number;
  line: number;
};

export type GroupingHeader = {
  field: "grouping";
  values: number[];
  line: number;
};

export type ParsedHeaders = {
  title?: MetadataHeader;
  subtitle?: MetadataHeader;
  composer?: MetadataHeader;
  tempo: TempoHeader;
  time: TimeHeader;
  divisions: DivisionsHeader;
  grouping: GroupingHeader;
};

export type TrackParagraph = {
  startLine: number;
  lines: ParsedTrackLine[];
};

export type DocumentSkeleton = {
  headers: ParsedHeaders;
  paragraphs: TrackParagraph[];
  errors: ParseError[];
};

export type ScoreMeasure = ParsedMeasure & {
  generated: boolean;
  globalIndex: number;
  sourceLine?: number;
};

export type ScoreTrackParagraph = {
  track: TrackName | "ANONYMOUS";
  measures: ScoreMeasure[];
  generated: boolean;
  lineNumber?: number;
};

export type ScoreParagraph = {
  startLine: number;
  measureCount: number;
  tracks: ScoreTrackParagraph[];
  groups: (TrackName | "ANONYMOUS")[][];
};

export type RepeatSpan = {
  startBar: number;
  endBar: number;
  times: number;
};

export type ScoreAst = {
  headers: ParsedHeaders;
  paragraphs: ScoreParagraph[];
  repeatSpans: RepeatSpan[];
  errors: ParseError[];
};

export type Fraction = {
  numerator: number;
  denominator: number;
};

export type NormalizedEventKind =
  | "hit"
  | "accent"
  | "pedal"
  | "sticking";

export type NormalizedEvent = {
  track: TrackName;
  paragraphIndex: number;
  measureIndex: number;
  measureInParagraph: number;
  start: Fraction;
  duration: Fraction;
  kind: NormalizedEventKind;
  glyph: Exclude<BasicGlyph, "-">;
  modifier?: Modifier;
  tuplet?: {
    actual: number;
    normal: number;
  };
};

export type NormalizedMeasure = {
  globalIndex: number;
  paragraphIndex: number;
  measureInParagraph: number;
  sourceLine: number;
  events: NormalizedEvent[];
  generated?: boolean;
  multiRestCount?: number;
};

export type NormalizedScore = {
  ast: ScoreAst;
  measures: NormalizedMeasure[];
  errors: ParseError[];
};
