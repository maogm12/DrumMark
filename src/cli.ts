import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerFont } from "canvas";
import { buildNormalizedScore } from "./dsl/normalize";
import { renderScoreToSvg } from "./vexflow/renderer";
import { buildMusicXml } from "./dsl/musicxml";

// --- JSDOM Environment Setup (Copied from render-cli.ts) ---
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
  pretendToBeVisual: true,
});
global.window = dom.window as any;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLAnchorElement = dom.window.HTMLAnchorElement;
global.HTMLDivElement = dom.window.HTMLDivElement;
global.SVGElement = dom.window.SVGElement;
global.Image = dom.window["Image"] as any;
global.DOMParser = dom.window.DOMParser as any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.resolve(__dirname, "../public/fonts");
const bravuraPath = path.join(fontsDir, "bravura.otf");
if (fs.existsSync(bravuraPath)) {
    try { registerFont(bravuraPath, { family: "Bravura" }); } catch (e) {}
}
if (!global.fetch) {
    (global as any).fetch = () => Promise.reject("Fetch not available in Node.");
}

async function main() {
  const args = process.argv.slice(2);
  const params = {
    input: "",
    format: "ir" as "ir" | "svg" | "xml",
    output: "" as string | null
  };

  // Simple arg parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--format" && args[i+1]) {
      params.format = args[i+1] as any;
      i++;
    } else if (arg === "--output" && args[i+1]) {
      params.output = args[i+1];
      i++;
    } else if (!arg.startsWith("-")) {
      params.input = arg;
    }
  }

  if (!params.input) {
    console.error("Usage: npm run debug-tool <input-file> [--format ir|svg|xml] [--output path]");
    process.exit(1);
  }

  const source = fs.readFileSync(path.resolve(params.input), "utf-8");
  const score = buildNormalizedScore(source);

  let result = "";
  if (params.format === "ir") {
    // Strip the AST for cleaner JSON if requested, or keep it
    const output = { ...score };
    delete (output as any).ast; // Optional: AST is very large
    result = JSON.stringify(output, null, 2);
  } else if (params.format === "xml") {
    result = buildMusicXml(score);
  } else if (params.format === "svg") {
    result = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 20, right: 20, bottom: 20, left: 20 },
      pageScale: 1.0,
      titleTopPadding: 20,
      titleSubtitleGap: 10,
      titleStaffGap: 40,
      systemSpacing: 1.0,
      hideVoice2Rests: false
    });
  }

  if (params.output) {
    fs.writeFileSync(path.resolve(params.output), result);
    console.log(`Saved ${params.format} to ${params.output}`);
  } else {
    console.log(result);
  }
}

main().catch(console.error);
