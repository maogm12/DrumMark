/// <reference lib="webworker" />

import { buildMusicXml, buildNormalizedScore } from "./dsl";

type ScoreWorkerRequest = {
  id: number;
  dsl: string;
  hideVoice2Rests: boolean;
};

type ScoreWorkerResponse = {
  id: number;
  score: ReturnType<typeof buildNormalizedScore>;
  xml: string;
};

self.onmessage = (event: MessageEvent<ScoreWorkerRequest>) => {
  const { id, dsl, hideVoice2Rests } = event.data;
  const score = buildNormalizedScore(dsl);
  const xml = buildMusicXml(score, hideVoice2Rests);
  const response: ScoreWorkerResponse = { id, score, xml };
  self.postMessage(response);
};

export {};
