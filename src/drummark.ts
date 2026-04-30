import { EditorView } from "@codemirror/view";
import { HighlightStyle, StreamLanguage, syntaxHighlighting, StringStream, type StreamParser } from "@codemirror/language";
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
  explicitTrack: TrackName | null;
  pendingScopeTrack: TrackName | null;
  scopeTracks: TrackName[];
};

const headerFields: readonly HeaderField[] = ["title", "subtitle", "composer", "tempo", "time", "divisions", "grouping"];
const modifiers = [...MODIFIERS].sort((left, right) => right.length - left.length) as readonly string[];
const sortedTracks = [...TRACKS].sort((left, right) => right.length - left.length) as readonly TrackName[];
const jumpMarkers = [
  "@segno",
  "@coda",
  "@fine",
  "@to-coda",
  "@da-capo",
  "@dal-segno",
  "@dc-al-fine",
  "@dc-al-coda",
  "@ds-al-fine",
  "@ds-al-coda",
] as const;

function startState(): DslState {
  return {
    lineMode: "unknown",
    lineInitialized: false,
    headerField: null,
    trackName: null,
    explicitTrack: null,
    pendingScopeTrack: null,
    scopeTracks: [],
  };
}

function resetLineState(state: DslState) {
  state.lineMode = "unknown";
  state.lineInitialized = false;
  state.headerField = null;
  state.trackName = null;
  state.explicitTrack = null;
  state.pendingScopeTrack = null;
  state.scopeTracks = [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchWord<T extends string>(stream: StringStream, words: readonly T[]): T | null {
  for (const word of words) {
    if (stream.match(new RegExp(`^${escapeRegex(word)}(?![A-Za-z0-9-])`))) {
      return word;
    }
  }

  return null;
}

function peekNonSpace(stream: StringStream): string | null {
  for (let index = stream.pos; index < stream.string.length; index += 1) {
    const char = stream.string[index];
    if (char && !/\s/.test(char)) {
      return char;
    }
  }

  return null;
}

function currentScopeTrack(state: DslState): TrackName | null {
  return state.scopeTracks.at(-1) ?? null;
}

function effectiveTrack(state: DslState): TrackName | null {
  return state.explicitTrack ?? currentScopeTrack(state) ?? state.trackName;
}

function consumeGlyph(stream: StringStream, pattern: RegExp, tokenType: string, state: DslState): string | null {
  if (!stream.match(pattern)) {
    return null;
  }

  state.explicitTrack = null;
  return tokenType;
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
    const next = peekNonSpace(stream);
    state.lineInitialized = true;
    state.lineMode = "track";
    state.trackName = track;
    if (next === "{") {
      state.pendingScopeTrack = track;
    }
    if (track === "ST") {
      return "track-sticking";
    }
    return "track";
  }

  state.lineInitialized = true;
  if (stream.peek() === "|") {
    state.lineMode = "track";
    state.trackName = "HH";
  }
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
  const track = effectiveTrack(state);

  if (stream.match("|:")) {
    return "repeat";
  }

  if (stream.match(":|")) {
    return "repeat";
  }

  if (stream.match("||")) {
    return "barline";
  }

  if (stream.match("|.")) {
    return "barline";
  }

  if (stream.match(/^\|\d+(?:,\d+)*\./)) {
    return "repeat-count";
  }

  if (stream.match("|")) {
    return "barline";
  }

  if (stream.match(/^\*[-]?\d+/)) {
    return "repeat-count";
  }

  if (stream.match(/^%+/)) {
    return "measure-repeat";
  }

  if (stream.match(/^-+\s*\d+\s*-+/)) {
    return "repeat-count";
  }

  if (matchWord(stream, jumpMarkers)) {
    return "jump-marker";
  }

  const routedTrack = matchWord(stream, sortedTracks);
  if (routedTrack) {
    const next = peekNonSpace(stream);
    if (next === "{") {
      state.pendingScopeTrack = routedTrack;
      return routedTrack === "ST" ? "track-sticking" : "track";
    }
    if (next === ":") {
      state.explicitTrack = routedTrack;
      return routedTrack === "ST" ? "track-sticking" : "track";
    }
  }

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

  if (stream.match("+")) {
    state.explicitTrack = null;
    return "hit-combinator";
  }

  if (stream.match("{")) {
    if (state.pendingScopeTrack) {
      state.scopeTracks.push(state.pendingScopeTrack);
      state.pendingScopeTrack = null;
    }
    return "punctuation";
  }

  if (stream.match(/\}/)) {
    state.scopeTracks.pop();
    state.explicitTrack = null;
    return "punctuation";
  }

  if (stream.match(":")) {
    return "punctuation";
  }

  if (stream.match(/^[./]+/)) {
    return "duration-modifier";
  }

  const mod = matchWord(stream, modifiers);
  if (mod) {
    return "modifier";
  }

  if (stream.match("-")) {
    state.explicitTrack = null;
    return "rest";
  }

  if ((track === "ST") && consumeGlyph(stream, /^[LR](?![A-Za-z0-9])/, "sticking-note", state)) {
    return "sticking-note";
  }

  if (consumeGlyph(stream, /^(?:t[1-4]|T[1-4])/, "tom-note", state)) {
    return "tom-note";
  }

  if (consumeGlyph(stream, /^(?:D|S|B|B2|G)(?![A-Za-z0-9])/, "accent-note", state)) {
    return "accent-note";
  }

  if (stream.match(/^(?:X|x)(?![A-Za-z0-9])/)) {
    state.explicitTrack = null;
    const glyph = stream.current();
    if (glyph === "x") {
      return track === "ST" ? "sticking-note" : "cymbal-note";
    }
    return "accent-note";
  }

  if (consumeGlyph(stream, /^(?:p|P|b|B|b2)(?![A-Za-z0-9])/, "kick-note", state)) {
    return "kick-note";
  }

  if (consumeGlyph(stream, /^(?:o|O|c2|C2|c|C|spl|SPL|chn|CHN|cb|CB|wb|WB|cl|CL)(?![A-Za-z0-9])/, "cymbal-note", state)) {
    return "cymbal-note";
  }

  if (consumeGlyph(stream, /^(?:s|g)(?![A-Za-z0-9])/, "note", state)) {
    return "note";
  }

  if (consumeGlyph(stream, /^(?:r2|R2|r|R)(?![A-Za-z0-9])/, "ride-note", state)) {
    return "ride-note";
  }

  if (consumeGlyph(stream, /^(?:d)(?![A-Za-z0-9])/, "note", state)) {
    return "note";
  }

  if (stream.match(/^[A-Za-z0-9]+/)) {
    state.explicitTrack = null;
    return "identifier";
  }

  return null;
}

export const drumMarkStreamParser: StreamParser<DslState> = {
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
    repeat: [tags.separator, tags.controlOperator],
    "repeat-count": [tags.number, tags.annotation],
    barline: tags.separator,
    "measure-repeat": [tags.controlOperator, tags.annotation],
    "jump-marker": tags.modifier,
    "group-bracket": tags.squareBracket,
    "group-count": tags.integer,
    "hit-combinator": tags.operator,
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

export const drumMarkLanguage = StreamLanguage.define(drumMarkStreamParser);

export const drumMarkHighlightStyle = HighlightStyle.define([
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
  { tag: tags.operator, color: "#0284c7", fontWeight: "700" },
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

export const drumMarkEditorTheme = EditorView.theme({
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

export const drumMarkSyntaxHighlighting = syntaxHighlighting(drumMarkHighlightStyle);

export function highlightDslStatic(code: string): string {
  const state = drumMarkStreamParser.startState!();
  const lines = code.split("\n");
  let html = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stream = new StringStream(line, 2, {
      tabSize: 2,
      lineSeparator: undefined
    } as any);
    
    while (!stream.eol()) {
      if (stream.eatSpace()) {
        html += " ";
        continue;
      }

      const pos = stream.pos;
      const token = drumMarkStreamParser.token(stream, state);
      const content = line.slice(pos, stream.pos);

      if (token) {
        // 将 token 转换为 CSS 类，支持空格分隔的多个 token
        const classes = token.split(" ").map(t => `dsl-${t}`).join(" ");
        html += `<span class="${classes}">${escapeHtml(content)}</span>`;
      } else {
        html += escapeHtml(content);
      }
    }
    if (i < lines.length - 1) html += "\n";
  }

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
