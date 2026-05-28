/// <reference lib="webworker" />

import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { initParserWasmBrowser } from "./wasm/parser_wasm_browser";

const wasmInit = initParserWasmBrowser();

type ParseRequest = {
  type: "parse";
  id: number;
  sourceRevision: number;
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
  source: string;
  sourceRevision: number;
  score: ReturnType<typeof buildNormalizedScore>;
};

type XmlResponse = {
  type: "xml";
  id: number;
  xml: string;
};

let lastScore: ReturnType<typeof buildNormalizedScore> | null = null;
let lastSource: string | null = null;

function parseErrorScore(message: string): ReturnType<typeof buildNormalizedScore> {
  return {
    version: "1",
    header: {},
    tracks: [],
    repeatSpans: [],
    measures: [],
    errors: [{ line: 1, column: 1, message }],
  };
}

function postParseResponse(
  id: number,
  dsl: string,
  sourceRevision: number,
  score: ReturnType<typeof buildNormalizedScore>,
) {
  lastScore = score;
  lastSource = dsl;
  const response: ParseResponse = {
    type: "parse",
    id,
    source: dsl,
    sourceRevision,
    score,
  };
  self.postMessage(response);
}

function handleMessage(msg: ScoreWorkerRequest) {
  if (msg.type === "parse") {
    const { id, dsl, sourceRevision } = msg;
    try {
      postParseResponse(id, dsl, sourceRevision, buildNormalizedScore(dsl));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      postParseResponse(id, dsl, sourceRevision, parseErrorScore(message));
    }
  } else if (msg.type === "generateXml") {
    const { id, hideVoice2Rests } = msg;
    if (!lastScore || lastSource === null) {
      const response: XmlResponse = { type: "xml", id, xml: "" };
      self.postMessage(response);
      return;
    }
    const output = buildMusicXml(lastSource, hideVoice2Rests);
    const response: XmlResponse = { type: "xml", id, xml: output.xml };
    self.postMessage(response);
  }
}

self.onmessage = async (event: MessageEvent<ScoreWorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "parse") {
      await wasmInit;
    }
    handleMessage(msg);
  } catch (error) {
    if (msg.type !== "parse") {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    postParseResponse(msg.id, msg.dsl, msg.sourceRevision, parseErrorScore(message));
  }
};

export {};
