import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";
import { EXAMPLE_CORPUS_FILES } from "./example_corpus";
import type { NormalizedScore } from "./types";

type CorpusReportEntry = {
  file: string;
  comparison: "match" | "lezer_bug" | "mismatch";
  wasm: unknown;
};

type CorpusReport = {
  generatedAt: string;
  corpus: CorpusReportEntry[];
};

const REPORT_PATH = join(process.cwd(), "docs/parser-cutover/example_corpus_report.json");
const REPORT = JSON.parse(readFileSync(REPORT_PATH, "utf8")) as CorpusReport;

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

describe("example corpus coverage", () => {
  it("keeps the explicit corpus list aligned with the checked-in report", () => {
    expect(REPORT.corpus.map((entry) => entry.file)).toEqual([...EXAMPLE_CORPUS_FILES]);
    expect(REPORT.corpus.every((entry) => entry.comparison !== "mismatch")).toBe(true);
  });

  for (const entry of REPORT.corpus) {
    it(`matches the checked-in WASM summary for ${entry.file}`, () => {
      const source = readFileSync(join(process.cwd(), entry.file), "utf8");
      expect(summarizeScore(buildNormalizedScore(source))).toEqual(entry.wasm);
    });
  }
});
