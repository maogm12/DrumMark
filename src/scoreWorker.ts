/// <reference lib="webworker" />

import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { parseDocumentSkeletonFromLezer } from "./dsl/lezer_skeleton";
import { buildScoreAst, normalizeScoreAst } from "./dsl/normalize";

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
};

self.onmessage = (event: MessageEvent<ScoreWorkerRequest>) => {
  const { id, dsl, hideVoice2Rests, useLezerParser } = event.data;

  let score;
  if (useLezerParser) {
    // Use lezer-based skeleton builder
    const skeleton = parseDocumentSkeletonFromLezer(dsl);
    // Build minimal AST from lezer skeleton
    const ast = buildScoreAst(dsl); // fallback
    score = normalizeScoreAst(ast);
    score.ast = ast; // Note: this won't be correct yet due to grammar issues
  } else {
    score = buildNormalizedScore(dsl);
  }
  const xml = buildMusicXml(score, hideVoice2Rests);
  const response: ScoreWorkerResponse = { id, score, xml };
  self.postMessage(response);
};

export {};
