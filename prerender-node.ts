import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildNormalizedScore } from "./src/dsl/index";
import { renderScoreToSvg } from "./src/vexflow/index";
import { highlightDslStatic } from "./src/drummark";
import { registerFont } from "canvas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Setup JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
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

if (!global.fetch) {
    (global as any).fetch = () => Promise.reject("Fetch not available in Node.");
}

// 2. Register local fonts
const fontsDir = path.resolve(__dirname, "public/fonts");
const bravuraPath = path.join(fontsDir, "bravura.otf");
if (fs.existsSync(bravuraPath)) {
    try {
        registerFont(bravuraPath, { family: "Bravura" });
    } catch (e) {
        console.warn(`Could not register Bravura font: ${e}`);
    }
}

async function processFile(filePath: string) {
  console.log(`Processing ${filePath}...`);
  const html = fs.readFileSync(filePath, "utf-8");
  const fileDom = new JSDOM(html);
  const doc = fileDom.window.document;

  const cards = doc.querySelectorAll(".docs-section-card");
  for (const card of cards) {
    const codeBlock = card.querySelector(".dsl-code-block");
    const container = card.querySelector(".staff-preview-container");

    if (codeBlock && container) {
      const dsl = codeBlock.textContent?.trim() || "";
      if (!dsl) continue;

      // 1. Apply Syntax Highlighting
      codeBlock.innerHTML = highlightDslStatic(dsl);

      // 2. Render Score to SVG
      try {
        const score = buildNormalizedScore(dsl);
        const svg = await renderScoreToSvg(score, {
          mode: "preview",
          pagePadding: { top: 10, right: 10, bottom: 10, left: 10 },
          pageScale: 0.8,
          titleTopPadding: 0,
          titleSubtitleGap: 0,
          titleStaffGap: 0,
          systemSpacing: 1.0,
          hideVoice2Rests: false,
        });
        container.innerHTML = `<div class="staff-preview">${svg}</div>`;
      } catch (e) {
        console.error(`Failed to render DSL in ${filePath}:`, e);
        container.innerHTML = '<div class="staff-error">Render Error</div>';
      }
    }
  }

  // Save the result
  fs.writeFileSync(filePath, fileDom.serialize());
  console.log(`Saved ${filePath}`);
}

async function run() {
  await processFile("docs.html");
  await processFile("docs_zh.html");
  console.log("PRERENDER (NODE) SUCCESSFUL");
}

run();
