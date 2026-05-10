// TypeScript type definitions for drummark-core WASM module
// Generated manually — mirrors Rust AST types in crates/drummark-core/src/ast.rs

export interface ParseResult {
  headers: HeaderSection;
  paragraphs: Paragraph[];
  errors: ParseError[];
}

export interface HeaderSection {
  title?: string;
  subtitle?: string;
  composer?: string;
  tempo?: number;
  time?: [number, number];
  grouping?: number[];
  note?: [number, number];
  divisions?: number;
}

export interface Paragraph {
  note?: [number, number];
  lines: TrackLine[];
}

export interface TrackLine {
  track?: string;
  measures: MeasureSection[];
}

export interface MeasureSection {
  barline: Barline;
  tokens: TokenNode[];
}

export type Barline =
  | { type: "|" }
  | { type: "||" }
  | { type: "|:" }
  | { type: ":|" }
  | { type: "|." }
  | { type: "||." }
  | { type: "|:." }
  | { type: "volta"; prefix: string; numbers: number[] };

export type TokenNode =
  | { kind: "basic"; glyph: string; dots?: number; halves?: number; stars?: number; modifiers?: string[] }
  | { kind: "summoned"; track: string; glyph: string; dots?: number; halves?: number; stars?: number; modifiers?: string[] }
  | { kind: "routedBraced"; track: string; content: TokenNode[] }
  | { kind: "inlineBraced"; content: TokenNode[] }
  | { kind: "group"; n?: number; items: TokenNode[]; modifiers?: string[] }
  | { kind: "combinedHit"; hits: CombinedHitNode[] }
  | { kind: "measureRepeat"; count: number }
  | { kind: "multiRest"; count: number }
  | { kind: "inlineRepeat"; times: number }
  | { kind: "crescendo" }
  | { kind: "decrescendo" }
  | { kind: "hairpinEnd" }
  | { kind: "navMarker"; name: string }
  | { kind: "navJump"; name: string };

export interface CombinedHitNode {
  glyph: string;
  dots?: number;
  halves?: number;
  stars?: number;
  modifiers?: string[];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
}
