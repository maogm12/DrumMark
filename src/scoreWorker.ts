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
  useLezerParser?: boolean;
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
  parserUsed: "regex" | "lezer";
};

type XmlResponse = {
  type: "xml";
  id: number;
  xml: string;
};

type ScoreWorkerResponse = ParseResponse | XmlResponse;

let lastScore: ReturnType<typeof buildNormalizedScore> | null = null;

function doParse(dsl: string, useLezerParser?: boolean): { score: ReturnType<typeof buildNormalizedScore>; parserUsed: "regex" | "lezer" } {
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
  return { score, parserUsed };
}

self.onmessage = (event: MessageEvent<ScoreWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "parse") {
    const { id, dsl, useLezerParser } = msg;
    const { score, parserUsed } = doParse(dsl, useLezerParser);
    lastScore = score;
    const response: ParseResponse = { type: "parse", id, score, parserUsed };
    self.postMessage(response);
  } else if (msg.type === "generateXml") {
    const { id, hideVoice2Rests } = msg;
    if (!lastScore) {
      // Should not happen — XML is only requested after a parse
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
