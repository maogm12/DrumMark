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

// Isolated DOM for VexFlow measurement
const mockDom = new JSDOM('<!DOCTYPE html><html><body><div id="vd-container"></div></body></html>', {
  pretendToBeVisual: true,
});
global.window = mockDom.window as any;
global.document = mockDom.window.document;
global.HTMLElement = mockDom.window.HTMLElement;
global.HTMLAnchorElement = mockDom.window.HTMLAnchorElement;
global.HTMLDivElement = mockDom.window.HTMLDivElement;
global.SVGElement = mockDom.window.SVGElement;
global.Image = mockDom.window["Image"] as any;
global.DOMParser = mockDom.window.DOMParser as any;

if (!global.fetch) {
    (global as any).fetch = () => Promise.reject("Fetch not available in Node.");
}

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
  console.log(`Processing ${filePath} (Strict Surgical String Mode)...`);
  const originalHtml = fs.readFileSync(filePath, "utf-8");
  
  // Use JSDOM ONLY for discovery (not for serialization)
  const extractorDom = new JSDOM(originalHtml);
  const cards = Array.from(extractorDom.window.document.querySelectorAll(".docs-section-card"));

  let outputHtml = originalHtml;

  for (const card of cards) {
    const cardId = card.id;
    // Get raw DSL from the original DOM
    const codeBlock = card.querySelector(".dsl-code-block");
    if (!codeBlock || !cardId) continue;

    const dsl = codeBlock.textContent?.trim() || "";
    if (!dsl) continue;

    console.log(`  -> Rendering: ${cardId}`);

    // 1. Highlight
    const highlightedDsl = highlightDslStatic(dsl);

    // 2. SVG
    let renderedSvg = "";
    try {
      mockDom.window.document.body.innerHTML = '<div id="vd-container"></div>';
      const score = buildNormalizedScore(dsl);
      renderedSvg = await renderScoreToSvg(score, {
        mode: "preview",
        pagePadding: { top: 10, right: 10, bottom: 10, left: 10 },
        pageScale: 0.8,
        titleTopPadding: 0,
        titleSubtitleGap: 0,
        titleStaffGap: 0,
        systemSpacing: 1.0,
        hideVoice2Rests: false,
      });
    } catch (e) {
      console.error(`     Error in ${cardId}:`, e.message);
      renderedSvg = '<div class="staff-error">Render Error</div>';
    }

    // 3. String replacement
    // We look for the <pre class="dsl-code-block"> and <div class="staff-preview-container">
    // WITHIN the specific <article id="${cardId}"> block.
    
    const articleStartTag = new RegExp(`<article[^>]*id="${cardId}"[^>]*>`, 'i');
    const startMatch = outputHtml.match(articleStartTag);
    if (!startMatch) continue;
    
    const startIndex = startMatch.index!;
    // Find the closing </article> after this start tag
    const endIndex = outputHtml.indexOf('</article>', startIndex);
    if (endIndex === -1) continue;

    let articleHtml = outputHtml.substring(startIndex, endIndex + 10);
    
    // Replace DSL
    articleHtml = articleHtml.replace(
        /(<pre class="dsl-code-block">)([\s\S]*?)(<\/pre>)/i,
        `$1${highlightedDsl}$3`
    );
    
    // Replace SVG container
    articleHtml = articleHtml.replace(
        /(<div class="staff-preview-container">)([\s\S]*?)(<\/div>)/i,
        `$1<div class="staff-preview">${renderedSvg}</div>$3`
    );

    // Patch back
    outputHtml = outputHtml.substring(0, startIndex) + articleHtml + outputHtml.substring(endIndex + 10);
  }

  // ABSOLUTELY NO DOM SERIALIZATION HERE.
  // The outputHtml was built by stitching original template strings.
  
  fs.writeFileSync(filePath, outputHtml);
  console.log(`Surgically saved ${filePath}`);
}

async function run() {
  await processFile("docs.html");
  await processFile("docs_zh.html");
  console.log("SUCCESS: Documentation updated surgically.");
}

run();
