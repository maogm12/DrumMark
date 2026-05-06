/// <reference lib="webworker" />

import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { parseDocumentSkeletonFromLezer } from "./dsl/lezer_skeleton";
import { buildScoreAst } from "./dsl/ast";
import { normalizeScoreAst } from "./dsl/normalize";

type ParseRequest = {
  type: "parse";
  id: number;
  dsl: string;
  hideVoice2Rests: boolean;
};

type GenerateXmlRequest = {
  type: "generateXml";
  id: number;
  hideVoice2Rests: boolean;
};

type ScoreWorkerRequest = ParseRequest | GenerateXmlRequest;

type ParseResponse = {
  type: "parse";
  id: number;
  score: ReturnType<typeof buildNormalizedScore>;
};

type XmlResponse = {
  type: "xml";
  id: number;
  xml: string;
};

type ScoreWorkerResponse = ParseResponse | XmlResponse;

let lastScore: ReturnType<typeof buildNormalizedScore> | null = null;

function doParse(dsl: string): ReturnType<typeof buildNormalizedScore> {
  const skeleton = parseDocumentSkeletonFromLezer(dsl);
  const ast = buildScoreAst(skeleton);
  const score = normalizeScoreAst(ast);
  score.ast = ast;
  return score;
}

self.onmessage = (event: MessageEvent<ScoreWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "parse") {
    const { id, dsl } = msg;
    let score: ReturnType<typeof buildNormalizedScore>;
    try {
      score = doParse(dsl);
    } catch (e) {
      console.error("[scoreWorker] lezer parse error, falling back to regex:", e);
      score = buildNormalizedScore(dsl);
    }
    lastScore = score;
    const response: ParseResponse = { type: "parse", id, score };
    self.postMessage(response);
  } else if (msg.type === "generateXml") {
    const { id, hideVoice2Rests } = msg;
    if (!lastScore) {
      const response: XmlResponse = { type: "xml", id, xml: "" };
      self.postMessage(response);
      return;
    }
    const xml = buildMusicXml(lastScore, hideVoice2Rests);
    const response: XmlResponse = { type: "xml", id, xml };
    self.postMessage(response);
  }
};

export {};
