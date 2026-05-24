import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildMusicXml } from "../src/dsl/musicxml";
import { initParserWasmNode } from "../src/wasm/parser_wasm_node";

const INPUT_DIR = "docs/musicxml-corpus/inputs";
const GOLDEN_DIR = "docs/musicxml-corpus/goldens";
const EXTRA_CASES = [
  {
    input: "docs/examples/musicxml.drum",
    golden: "docs-example-musicxml.musicxml",
  },
] as const;

await initParserWasmNode();
mkdirSync(GOLDEN_DIR, { recursive: true });

for (const file of readdirSync(INPUT_DIR).filter((name) => name.endsWith(".drum")).sort()) {
  const inputPath = join(INPUT_DIR, file);
  const source = readFileSync(inputPath, "utf8");
  const { xml } = buildMusicXml(source);
  const outputPath = join(GOLDEN_DIR, basename(file, ".drum") + ".musicxml");
  writeFileSync(outputPath, xml.endsWith("\n") ? xml : xml + "\n");
}

for (const extra of EXTRA_CASES) {
  const source = readFileSync(extra.input, "utf8");
  const { xml } = buildMusicXml(source);
  const outputPath = join(GOLDEN_DIR, extra.golden);
  writeFileSync(outputPath, xml.endsWith("\n") ? xml : xml + "\n");
}
