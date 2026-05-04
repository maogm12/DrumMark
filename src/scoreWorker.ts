/// <reference lib="webworker" />

import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { parseDocumentSkeletonFromLezer } from "./dsl/lezer_skeleton";
import { buildScoreAst } from "./dsl/ast";
import { normalizeScoreAst } from "./dsl/normalize";

type ScoreWorkerRequest = {
  id: number;
  dsl: string;
  hideVoice2Rests: boolean;
  useLezerParser?: boolean;
};

type ScoreWorkerResponse = {
  id: number;
  score: ReturnType<typeof buildNormalizedScore>;
  xml: string;
  parserUsed: "regex" | "lezer";
};

self.onmessage = (event: MessageEvent<ScoreWorkerRequest>) => {
  const { id, dsl, hideVoice2Rests, useLezerParser } = event.data;

  let score;
  let parserUsed: "regex" | "lezer";
  try {
    if (useLezerParser) {
      const skeleton = parseDocumentSkeletonFromLezer(dsl);
      const ast = buildScoreAst(skeleton);
      score = normalizeScoreAst(ast);
      score.ast = ast;
      parserUsed = "lezer";
    } else {
      score = buildNormalizedScore(dsl);
      parserUsed = "regex";
    }
  } catch (e) {
    console.error("[scoreWorker] parse error:", e);
    score = buildNormalizedScore(dsl);
    parserUsed = "regex";
  }
  const xml = buildMusicXml(score, hideVoice2Rests);
  const response: ScoreWorkerResponse = { id, score, xml, parserUsed };
  self.postMessage(response);
};

export {};
