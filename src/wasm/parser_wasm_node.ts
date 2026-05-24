import { createRequire } from "node:module";
import { setParserRuntime } from "./parser_runtime";

type ParserWasmNodeModule = {
  parse(source: string): unknown;
  build_normalized_score(source: string): unknown;
  build_music_xml(source: string, hideVoice2Rests: boolean): unknown;
};

const require = createRequire(import.meta.url);
let parserModule: ParserWasmNodeModule | null = null;

export async function initParserWasmNode(): Promise<void> {
  if (!parserModule) {
    parserModule = require("./parser-pkg-node/drummark_core.js") as ParserWasmNodeModule;
    setParserRuntime({
      parse: parserModule.parse,
      buildNormalizedScore: parserModule.build_normalized_score,
      buildMusicXml: parserModule.build_music_xml,
    });
  }
}

export function isParserWasmNodeReady(): boolean {
  return parserModule !== null;
}

export function parseWithParserWasmNode(source: string): unknown {
  if (!parserModule) {
    throw new Error("Parser WASM is not initialized.");
  }
  return parserModule.parse(source);
}

export function buildNormalizedScoreWithParserWasmNode(source: string): unknown {
  if (!parserModule) {
    throw new Error("Parser WASM is not initialized.");
  }
  return parserModule.build_normalized_score(source);
}

export function buildMusicXmlWithParserWasmNode(source: string, hideVoice2Rests = false): unknown {
  if (!parserModule) {
    throw new Error("Parser WASM is not initialized.");
  }
  return parserModule.build_music_xml(source, hideVoice2Rests);
}
