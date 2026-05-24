import type { NormalizedScore, ParseError } from "./dsl/types";

export type CliOutputFormat = "ast" | "ir" | "svg" | "xml";

export type ParserAstOutput = {
  version: "drummark-parser-ast/v1";
  headers: unknown;
  paragraphs: unknown[];
  errors: ParseError[];
};

export function formatParserAstJson(ast: ParserAstOutput): string {
  return JSON.stringify(ast, null, 2);
}

export function formatIrJson(score: NormalizedScore): string {
  return JSON.stringify(score, null, 2);
}
