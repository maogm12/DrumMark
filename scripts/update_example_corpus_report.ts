import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildNormalizedScore } from "../src/dsl/normalize";
import { EXAMPLE_CORPUS_FILES } from "../src/dsl/example_corpus";
import { initParserWasmNode } from "../src/wasm/parser_wasm_node";
import type { NormalizedScore } from "../src/dsl/types";

type CorpusReportEntry = {
  file: string;
  comparison: "match";
  wasm: unknown;
};

function summarizeScore(score: NormalizedScore): unknown {
  return JSON.parse(JSON.stringify({
    header: score.header,
    tracks: score.tracks,
    errors: score.errors,
    measures: score.measures.map((measure) => ({
      paragraphIndex: measure.paragraphIndex,
      measureInParagraph: measure.measureInParagraph,
      noteValue: measure.noteValue,
      barline: measure.barline,
      startNav: measure.startNav,
      endNav: measure.endNav,
      volta: measure.volta,
      measureRepeat: measure.measureRepeat,
      multiRest: measure.multiRest,
      hairpins: measure.hairpins,
      events: measure.events.map((event) => ({
        track: event.track,
        glyph: event.glyph,
        kind: event.kind,
        start: event.start,
        duration: event.duration,
        voice: event.voice,
        modifiers: event.modifiers,
      })),
    })),
  }));
}

const REPORT_PATH = join(process.cwd(), "docs/parser-cutover/example_corpus_report.json");
const REPORT = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

await initParserWasmNode();

for (const entry of REPORT.corpus) {
  const source = readFileSync(join(process.cwd(), entry.file), "utf8");
  entry.wasm = summarizeScore(buildNormalizedScore(source));
}

writeFileSync(REPORT_PATH, JSON.stringify(REPORT, null, 2) + "\n");
console.log("Updated example_corpus_report.json");
