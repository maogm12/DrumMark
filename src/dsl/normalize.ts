import { buildScoreAst } from "./ast";
import type {
  EndNav,
  NormalizedMeasure,
  NormalizedScore,
  ParseError,
  StartNav,
} from "./types";
import { buildNormalizedScoreWithParserRuntime } from "../wasm/parser_runtime";

function parseErrorMessage(message: string): ParseError {
  const match = /^Line\s+(\d+)(?:,\s*Col\s+(\d+))?:\s*(.*)$/.exec(message);
  if (!match) {
    return { line: 1, column: 1, message };
  }
  return {
    line: Number(match[1]),
    column: match[2] ? Number(match[2]) : 1,
    message: match[3] || message,
  };
}

function normalizeStartNav(value: unknown): StartNav | undefined {
  if (!value) return undefined;
  if (typeof value !== "string") return value as StartNav;
  if (value === "segno" || value === "coda") {
    return { kind: value, anchor: "left-edge" };
  }
  return undefined;
}

function normalizeEndNav(value: unknown): EndNav | undefined {
  if (!value) return undefined;
  if (typeof value !== "string") return value as EndNav;
  const known = new Set([
    "to-coda",
    "fine",
    "dc",
    "ds",
    "dc-al-fine",
    "dc-al-coda",
    "ds-al-fine",
    "ds-al-coda",
  ]);
  if (!known.has(value)) return undefined;
  return { kind: value as EndNav["kind"], anchor: "right-edge" };
}

function adaptMeasure(raw: NormalizedMeasure & Record<string, unknown>): NormalizedMeasure {
  const measureRepeatSlashes = raw["measureRepeatSlashes"];
  const multiRestCount = raw["multiRestCount"];
  const events = (raw.events ?? []).map((event) => ({
    ...event,
    modifiers: event.modifiers ?? [],
  }));
  return {
    ...raw,
    events,
    startNav: normalizeStartNav(raw.startNav),
    endNav: normalizeEndNav(raw.endNav),
    measureRepeat:
      typeof measureRepeatSlashes === "number"
        ? { slashes: measureRepeatSlashes }
        : raw.measureRepeat,
    multiRest:
      typeof multiRestCount === "number"
        ? { count: multiRestCount }
        : raw.multiRest,
    dynamics: raw.dynamics ?? [],
  };
}

export function buildNormalizedScore(source: string): NormalizedScore {
  const raw = buildNormalizedScoreWithParserRuntime(source) as NormalizedScore & {
    errors?: Array<string | ParseError>;
  };
  const ast = buildScoreAst(source);
  return {
    ...raw,
    ast,
    repeatSpans: raw.repeatSpans ?? [],
    errors: (raw.errors ?? []).map((error) =>
      typeof error === "string" ? parseErrorMessage(error) : error,
    ),
    measures: (raw.measures ?? []).map((measure) =>
      adaptMeasure(measure as NormalizedMeasure & Record<string, unknown>),
    ),
  };
}

export function buildNormalizedScoreWasm(source: string): NormalizedScore {
  return buildNormalizedScore(source);
}

export function buildNormalizedScoreFromRegex(source: string): NormalizedScore {
  return buildNormalizedScore(source);
}
