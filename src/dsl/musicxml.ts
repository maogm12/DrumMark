import type { ParseError } from "./types";
import { buildMusicXmlWithParserRuntime } from "../wasm/parser_runtime";

export type MusicXmlOutput = {
  xml: string;
  errors: ParseError[];
};

export function buildMusicXml(source: string, hideVoice2Rests = false): MusicXmlOutput {
  return buildMusicXmlWithParserRuntime(source, hideVoice2Rests) as MusicXmlOutput;
}
