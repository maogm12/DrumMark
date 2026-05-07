import type { NormalizedScore } from "./dsl/types";

export type CliOutputFormat = "ast" | "ir" | "svg" | "xml";

export function formatScoreJson(score: NormalizedScore, format: "ast" | "ir"): string {
  if (format === "ast") {
    return JSON.stringify(score.ast, null, 2);
  }

  const output = { ...score };
  delete (output as Partial<NormalizedScore>).ast;
  return JSON.stringify(output, null, 2);
}
