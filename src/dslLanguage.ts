import { EditorView } from "@codemirror/view";
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

type HeaderField = "title" | "subtitle" | "composer" | "tempo" | "time" | "divisions" | "grouping";
type LineMode = "unknown" | "header" | "track";
type TrackName = "HH" | "HF" | "DR" | "SD" | "BD" | "T1" | "T2" | "T3" | "RC" | "C" | "ST";

type DslState = {
  lineMode: LineMode;
  lineInitialized: boolean;
  headerField: HeaderField | null;
  trackName: TrackName | null;
};

const headerFields: readonly HeaderField[] = ["title", "subtitle", "composer", "tempo", "time", "divisions", "grouping"];
const trackNames: readonly TrackName[] = ["HH", "HF", "DR", "SD", "BD", "T1", "T2", "T3", "RC", "C", "ST"];
const modifiers = ["open", "close", "choke", "rim", "cross", "bell", "flam"] as const;

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

  const track = matchWord(stream, trackNames);
  if (track) {
    state.lineInitialized = true;
    state.lineMode = "track";
    state.trackName = track;
    if (track === "DR") {
      return "track-sugar";
    }
    if (track === "ST") {
      return "track-sticking";
    }
    return "track";
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

  if (stream.match("|:")) {
    return "repeat";
  }

  if (stream.match(":|")) {
    return "repeat";
  }

  if (stream.match(/^x\d+/)) {
    return "repeat-count";
  }

  if (stream.match("|")) {
    return "barline";
  }

  if (stream.match("[")) {
    return "group-bracket";
  }

  if (stream.match("]")) {
    return "group-bracket";
  }

  if (stream.match(/^\d+/)) {
    return "group-count";
  }

  if (stream.match(":")) {
    return "punctuation";
  }

  if (matchWord(stream, modifiers)) {
    return "modifier";
  }

  if (stream.match("-")) {
    return "rest";
  }

  if (stream.match(/^(?:t1|T1|t2|T2|t3|T3)/)) {
    const val = stream.current();
    if (track === "DR" && /^[T123]/.test(val)) {
      return "dr-accent";
    }
    return "dr-tom";
  }

  if (stream.match(/^[RL]/)) {
    return "sticking-note";
  }

  if (stream.match(/^[SD]/)) {
    return track === "DR" ? "dr-accent" : "note-accent";
  }

  if (stream.match(/^X/)) {
    return "cymbal-accent";
  }

  if (stream.match(/^g/)) {
    return "ghost-note";
  }

  if (stream.match(/^O/)) {
    return "open-accent";
  }

  if (stream.match(/^o/)) {
    return "open-sugar";
  }

  if (stream.match(/^C/)) {
    return "crash-accent";
  }

  if (stream.match(/^c/)) {
    return "crash-sugar";
  }

  if (stream.match(/^s/)) {
    return track === "DR" ? "dr-note" : "note";
  }

  if (stream.match(/^[xdpP]/)) {
    const glyph = stream.current();
    if (glyph === "x") {
      return "cymbal-note";
    }
    if (glyph === "p") {
      return track === "HF" ? "foot-note" : "kick-note";
    }
    return glyph === "P" ? "note-accent" : "note";
  }

  if (stream.match(/^[A-Za-z0-9]+/)) {
    return "identifier";
  }

  return null;
}

const drumDslParser: StreamParser<DslState> = {
  name: "drum-dsl",
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
    "track-sugar": tags.className,
    "track-sticking": tags.attributeName,
    repeat: [tags.separator, tags.controlOperator],
    "repeat-count": [tags.number, tags.annotation],
    barline: tags.separator,
    "group-bracket": tags.squareBracket,
    "group-count": tags.integer,
    punctuation: tags.punctuation,
    modifier: tags.modifier,
    rest: tags.null,
    "dr-tom": tags.typeName,
    "sticking-note": tags.attributeValue,
    "dr-note": tags.atom,
    "dr-accent": [tags.atom, tags.strong],
    note: tags.atom,
    "note-accent": [tags.atom, tags.strong],
    "ghost-note": tags.emphasis,
    "cymbal-note": tags.tagName,
    "cymbal-accent": [tags.tagName, tags.strong],
    "open-accent": [tags.tagName, tags.inserted, tags.strong],
    "open-sugar": [tags.tagName, tags.inserted],
    "crash-accent": [tags.tagName, tags.special(tags.atom), tags.strong],
    "crash-sugar": [tags.tagName, tags.special(tags.atom)],
    "foot-note": tags.bool,
    "kick-note": tags.bool,
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
  { tag: tags.className, color: "#b45309", fontWeight: "700" },
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
  { tag: tags.emphasis, color: "#64748b", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "800" },
  { tag: tags.inserted, color: "#059669" },
  { tag: tags.special(tags.atom), color: "#b91c1c", fontWeight: "700" },
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
