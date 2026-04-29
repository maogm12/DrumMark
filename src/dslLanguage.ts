import { EditorView } from "@codemirror/view";
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { TRACKS, MODIFIERS } from "./dsl/types";

type HeaderField = "title" | "subtitle" | "composer" | "tempo" | "time" | "divisions" | "grouping";
type LineMode = "unknown" | "header" | "track";
type TrackName = typeof TRACKS[number];

type DslState = {
  lineMode: LineMode;
  lineInitialized: boolean;
  headerField: HeaderField | null;
  trackName: TrackName | null;
};

const headerFields: readonly HeaderField[] = ["title", "subtitle", "composer", "tempo", "time", "divisions", "grouping"];
const modifiers = [...MODIFIERS] as const;

function startState(): DslState {
  return {
    lineMode: "unknown",
    lineInitialized: false,
    headerField: null,
    trackName: null,
  };
}

function resetLineState(state: DslState) {
  state.lineMode = "unknown";
  state.lineInitialized = false;
  state.headerField = null;
  state.trackName = null;
}

function matchWord<T extends string>(stream: StringStream, words: readonly T[]): T | null {
  for (const word of words) {
    if (stream.match(word)) {
      return word;
    }
  }

  return null;
}

function initializeLine(stream: StringStream, state: DslState): string | null {
  if (state.lineInitialized) {
    return null;
  }

  const header = matchWord(stream, headerFields);
  if (header) {
    state.lineInitialized = true;
    state.lineMode = "header";
    state.headerField = header;
    return header === "title" || header === "subtitle" || header === "composer" ? "header-meta" : "header-struct";
  }

  const track = matchWord(stream, TRACKS);
  if (track) {
    state.lineInitialized = true;
    state.lineMode = "track";
    state.trackName = track;
    if (track === "ST") {
      return "track-sticking";
    }
    return "track";
  }

  // Measure repeat indicator
  if (stream.match("|.|") || stream.match("|*|")) {
    state.lineInitialized = true;
    return "measure-repeat";
  }

  state.lineInitialized = true;
  return null;
}

function readToLineEnd(stream: StringStream): string {
  const rest = stream.string.slice(stream.pos);
  stream.skipToEnd();
  return rest;
}

function readHeaderValue(stream: StringStream, state: DslState): string | null {
  switch (state.headerField) {
    case "title":
    case "subtitle":
    case "composer":
      readToLineEnd(stream);
      return "header-text";
    case "tempo":
    case "divisions":
      if (stream.match(/^\d+/)) {
        return "header-number";
      }
      break;
    case "time":
      if (stream.match(/^\d+/)) {
        return "header-number";
      }
      if (stream.match("/")) {
        return "header-divider";
      }
      break;
    case "grouping":
      if (stream.match(/^\d+/)) {
        return "header-number";
      }
      if (stream.match("+")) {
        return "header-operator";
      }
      break;
    default:
      break;
  }

  if (stream.match(/[^\s#]+/)) {
    return "header-text";
  }

  return null;
}

function readTrackToken(stream: StringStream, state: DslState): string | null {
  const track = state.trackName;

  // Comments
  if (stream.match("%%")) {
    stream.skipToEnd();
    return "comment";
  }

  // Repeat start: |:
  if (stream.match("|:")) {
    return "repeat";
  }

  // Repeat end: :|
  if (stream.match(":+|")) {
    return "repeat";
  }

  // Repeat count: xN or *N
  if (stream.match(/^[x*]\d+/)) {
    return "repeat-count";
  }

  // Barline: single |
  if (stream.match(/\|\s*(?![*:])/)) {
    return "barline";
  }

  // Inline repeat end: %
  if (stream.match(/^\s*%/)) {
    return "inline-repeat-end";
  }

  // Volta / repeat count: --N--
  if (stream.match(/^--\d+--/)) {
    return "repeat-count";
  }

  // Jump markers: @segno @fine @to-coda @coda
  if (stream.match(/^@(segno|fine|to-coda|coda)\b/)) {
    return "jump-marker";
  }

  // Group tokens: [ ... ]
  if (stream.match("[")) {
    return "group-bracket";
  }

  if (stream.match("]")) {
    return "group-bracket";
  }

  // Group count (inside [N: ... ])
  if (stream.match(/^\d+/)) {
    return "group-count";
  }

  // Track override: {track:glyph}
  if (stream.match(/\{\s*/)) {
    return "punctuation";
  }

  if (stream.match(/\}/)) {
    return "punctuation";
  }

  // Modifier separator
  if (stream.match(":")) {
    return "punctuation";
  }

  // Duration modifiers: dots (.) and halves (/ or halved)
  if (stream.match(/^[./]+/)) {
    return "duration-modifier";
  }

  // Music markup modifiers
  const mod = matchWord(stream, modifiers);
  if (mod) {
    return "modifier";
  }

  // Rest
  if (stream.match("-")) {
    return "rest";
  }

  // Sticking notes: L, R and variants L2, R2, L3, R3
  if (stream.match(/^[LR]\d*/)) {
    return "sticking-note";
  }

  // Tom tokens: t1-T4
  if (stream.match(/^(?:t[1-4]|T[1-4])/)) {
    return "tom-note";
  }

  // BD2 accent
  if (stream.match(/^BD2\b/)) {
    return "drum-accent";
  }

  // Accent tokens: X, P, G, D, S, B (uppercase hit tokens with accent semantics)
  if (stream.match(/^[XPDGSB]\d*/)) {
    return "accent-note";
  }

  // Lowercase basic glyphs
  if (stream.match(/^[xdp]/)) {
    const glyph = stream.current();
    if (glyph === "x") {
      return track === "ST" ? "sticking-note" : "cymbal-note";
    }
    if (glyph === "p") {
      return track === "HF" ? "foot-note" : "kick-note";
    }
    return "note";
  }

  // c/o/C/O for cymbal family
  if (stream.match(/^[cCoO]\d*/)) {
    return "cymbal-note";
  }

  // s/S for snare
  if (stream.match(/^[sS]\d*/)) {
    return track === "ST" ? "sticking-note" : "note";
  }

  // b/B for bass drum
  if (stream.match(/^[bB]\d*/)) {
    return "kick-note";
  }

  // r/R for ride cymbal
  if (stream.match(/^[rR]\d*/)) {
    return "ride-note";
  }

  // Identifiers (fallback)
  if (stream.match(/^[A-Za-z0-9]+/)) {
    return "identifier";
  }

  return null;
}

const drumDslParser: StreamParser<DslState> = {
  name: "drummark",
  startState: () => startState(),
  copyState: (state) => ({ ...state }),
  token(stream, state) {
    if (stream.sol()) {
      resetLineState(state);
    }

    if (stream.eatSpace()) {
      return null;
    }

    if (stream.peek() === "#") {
      stream.skipToEnd();
      return "comment";
    }

    const lineToken = initializeLine(stream, state);
    if (lineToken) {
      return lineToken;
    }

    if (state.lineMode === "header") {
      const headerToken = readHeaderValue(stream, state);
      if (headerToken) {
        return headerToken;
      }
    }

    if (state.lineMode === "track") {
      const trackToken = readTrackToken(stream, state);
      if (trackToken) {
        return trackToken;
      }
    }

    if (stream.match(/[^\s#]+/)) {
      return "identifier";
    }

    stream.next();
    return null;
  },
  tokenTable: {
    comment: tags.lineComment,
    "header-meta": tags.heading,
    "header-struct": tags.keyword,
    "header-text": tags.string,
    "header-number": tags.integer,
    "header-divider": tags.punctuation,
    "header-operator": tags.arithmeticOperator,
    track: tags.labelName,
    "track-sticking": tags.attributeName,
    "measure-repeat": [tags.separator, tags.annotation],
    repeat: [tags.separator, tags.controlOperator],
    "repeat-count": [tags.number, tags.annotation],
    barline: tags.separator,
    "inline-repeat-end": tags.controlOperator,
    "jump-marker": tags.modifier,
    "group-bracket": tags.squareBracket,
    "group-count": tags.integer,
    punctuation: tags.punctuation,
    modifier: tags.modifier,
    "duration-modifier": tags.arithmeticOperator,
    rest: tags.null,
    "tom-note": tags.typeName,
    "sticking-note": tags.attributeValue,
    "accent-note": [tags.atom, tags.strong],
    "drum-accent": [tags.atom, tags.strong],
    note: tags.atom,
    "cymbal-note": tags.tagName,
    "ride-note": tags.tagName,
    "kick-note": tags.bool,
    "foot-note": tags.bool,
    identifier: tags.name,
  },
};

export const drumDslLanguage = StreamLanguage.define(drumDslParser);

export const drumDslHighlightStyle = HighlightStyle.define([
  { tag: tags.lineComment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.heading, color: "#0f766e", fontWeight: "700" },
  { tag: tags.keyword, color: "#0284c7", fontWeight: "600" },
  { tag: tags.string, color: "#0f172a" },
  { tag: tags.integer, color: "#059669" },
  { tag: tags.arithmeticOperator, color: "#0f766e", fontWeight: "600" },
  { tag: tags.punctuation, color: "#94a3b8" },
  { tag: tags.labelName, color: "#0f172a", fontWeight: "700" },
  { tag: tags.attributeName, color: "#0f766e", fontWeight: "700" },
  { tag: tags.attributeValue, color: "#2563eb", fontWeight: "600" },
  { tag: tags.typeName, color: "#7c3aed", fontWeight: "600" },
  { tag: tags.separator, color: "#f43f5e", fontWeight: "700" },
  { tag: tags.controlOperator, color: "#e11d48", fontWeight: "700" },
  { tag: tags.annotation, color: "#be123c" },
  { tag: tags.squareBracket, color: "#fb7185", fontWeight: "700" },
  { tag: tags.modifier, color: "#7c3aed", fontStyle: "italic" },
  { tag: tags.null, color: "#cbd5e1" },
  { tag: tags.atom, color: "#1e293b" },
  { tag: tags.tagName, color: "#0369a1" },
  { tag: tags.bool, color: "#0f766e" },
  { tag: tags.strong, fontWeight: "800" },
  { tag: tags.name, color: "#475569" },
]);

export const drumDslEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#ffffff",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-mono)",
    lineHeight: "1.7",
  },
  ".cm-content, .cm-gutterElement": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.7",
  },
  ".cm-content": {
    padding: "20px 150px 20px 0",
    minHeight: "100%",
    whiteSpace: "pre",
  },
  ".cm-line": {
    padding: "0 0 0 16px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-sidebar)",
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border-subtle)",
  },
  ".cm-lineNumbers": {
    minWidth: "48px",
  },
  ".cm-gutterElement": {
    padding: "0 12px 0 0",
    fontSize: "0.8rem",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(2, 132, 199, 0.05)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text-main)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(14, 165, 233, 0.16) !important",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor.cm-focused": {
    outline: "none",
  },
}, { dark: false });

export const drumDslSyntaxHighlighting = syntaxHighlighting(drumDslHighlightStyle);
