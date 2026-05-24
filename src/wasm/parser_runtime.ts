type ParserRuntime = {
  parse(source: string): unknown;
  buildNormalizedScore(source: string): unknown;
  buildMusicXml(source: string, hideVoice2Rests: boolean): unknown;
};

let runtime: ParserRuntime | null = null;

export function setParserRuntime(nextRuntime: ParserRuntime): void {
  runtime = nextRuntime;
}

export function isParserRuntimeReady(): boolean {
  return runtime !== null;
}

export function parseWithParserRuntime(source: string): unknown {
  if (!runtime) {
    throw new Error("WASM parser not ready. Call initWasm() first.");
  }
  return runtime.parse(source);
}

export function buildNormalizedScoreWithParserRuntime(source: string): unknown {
  if (!runtime) {
    throw new Error("WASM parser not ready. Call initWasm() first.");
  }
  return runtime.buildNormalizedScore(source);
}

export function buildMusicXmlWithParserRuntime(source: string, hideVoice2Rests = false): unknown {
  if (!runtime) {
    throw new Error("WASM parser not ready. Call initWasm() first.");
  }
  return runtime.buildMusicXml(source, hideVoice2Rests);
}
