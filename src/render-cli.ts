import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { buildNormalizedScore } from "./dsl/normalize";
import { renderScoreToSvg } from "./vexflow/renderer";

// 1. Setup JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
  pretendToBeVisual: true,
});

// Mock browser globals
global.window = dom.window as any;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLAnchorElement = dom.window.HTMLAnchorElement;
global.HTMLDivElement = dom.window.HTMLDivElement;
global.SVGElement = dom.window.SVGElement;
global.Image = dom.window["Image"] as any;
global.DOMParser = dom.window.DOMParser as any;

// 2. Register local fonts for Canvas in Node
import { registerFont } from "canvas";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.resolve(__dirname, "../public/fonts");

const bravuraPath = path.join(fontsDir, "bravura.otf");
if (fs.existsSync(bravuraPath)) {
    try {
        console.log(`Registering font: ${bravuraPath}`);
        registerFont(bravuraPath, { family: "Bravura" });
    } catch (e) {
        console.warn(`Could not register Bravura font, SVG might have zero-width text: ${e}`);
    }
}

// 3. Mock font loading for Node environment
// VexFlow 5 will try to fetch fonts, which fails in Node without a fetch mock or absolute paths.
// Since we want the SVG structure, we can sometimes bypass actual font loading
// if we don't care about precise text measurement in this CLI pass,
// OR we can tell VexFlow where the fonts are.

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("Usage: npm run render-cli <input-file> [output-file]");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]!);
  const outputPath = args[1] ? path.resolve(args[1]) : inputPath.replace(/\.[^/.]+$/, "") + ".svg";

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const dslSource = fs.readFileSync(inputPath, "utf-8");

  try {
    console.log(`Parsing DSL from ${inputPath}...`);
    const score = buildNormalizedScore(dslSource);

    if (score.errors.length > 0) {
      console.warn("Parser warnings/errors:");
      score.errors.forEach(e => console.warn(`Line ${e.line}, Col ${e.column}: ${e.message}`));
    }

    console.log("Rendering to SVG...");
    
    // Note: ensureVexFlowFonts in renderer.ts might need a mock for fetch in Node
    // We provide a basic one if needed
    if (!global.fetch) {
        (global as any).fetch = () => Promise.reject("Fetch not available in Node. Use absolute paths for fonts.");
    }

    const svg = await renderScoreToSvg(score, {
      mode: "preview",
      pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
      pageScale: 1.0,
      titleTopPadding: 20,
      titleSubtitleGap: 10,
      titleStaffGap: 40,
      systemSpacing: 1.0,
      hideVoice2Rests: false
    });

    fs.writeFileSync(outputPath, svg);
    console.log(`Successfully saved SVG to ${outputPath}`);
  } catch (err) {
    console.error("Rendering failed:", err);
    process.exit(1);
  }
}

main();
