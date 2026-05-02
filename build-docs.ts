
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildNormalizedScore } from "./src/dsl/index";
import { renderScoreToSvg } from "./src/vexflow/index";
import { highlightDslStatic } from "./src/drummark";
import { registerFont } from "canvas";
import { DEFAULT_RENDER_OPTIONS } from "./src/vexflow/types";

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
global.XMLSerializer = (mockDom.window as any).XMLSerializer;

if (!global.fetch) {
    (global as any).fetch = () => Promise.reject("Fetch not available in Node.");
}

class MockFileReader {
    onloadend: (() => void) | null = null;
    result: string | null = null;
    readAsDataURL() {
        if (this.onloadend) this.onloadend();
    }
}
(global as any).FileReader = MockFileReader;

const fontsDir = path.resolve(__dirname, "public/fonts");
const bravuraPath = path.join(fontsDir, "bravura.otf");
if (fs.existsSync(bravuraPath)) {
    try {
        registerFont(bravuraPath, { family: "Bravura" });
    } catch (e) {
        console.warn(`Could not register Bravura font: ${e}`);
    }
}

async function buildDocs(templatePath: string, outputPath: string) {
    console.log(`Building ${outputPath} from ${templatePath}...`);
    let html = fs.readFileSync(templatePath, 'utf8');
    const lang = outputPath.includes('_zh') ? 'zh' : 'en';

    const placeholderRegex = /<div class="example-inject" data-example="([^"]+)"><\/div>/g;
    
    let match;
    const replacements: { placeholder: string, content: string }[] = [];

    // We need to collect all matches first because async/await in replace is tricky
    const matches: string[] = [];
    const ids: string[] = [];
    while ((match = placeholderRegex.exec(html)) !== null) {
        matches.push(match[0]);
        ids.push(match[1]);
    }

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const placeholder = matches[i];
        console.log(`  -> Processing example: ${id}`);

        const drumFile = path.join(__dirname, 'docs', 'examples', `${id}.drum`);
        if (!fs.existsSync(drumFile)) {
            console.warn(`     Warning: Example file ${drumFile} not found.`);
            continue;
        }

        const dsl = fs.readFileSync(drumFile, 'utf8');
        const encodedDsl = encodeURIComponent(dsl);
        
        // 1. Highlight
        const highlightedDsl = highlightDslStatic(dsl);

        // 2. Render Score
        let renderedSvg = "";
        try {
            mockDom.window.document.body.innerHTML = '<div id="vd-container"></div>';
            const score = buildNormalizedScore(dsl);
            renderedSvg = await renderScoreToSvg(score, {
                ...DEFAULT_RENDER_OPTIONS,
            });
        } catch (e: any) {
            console.error(`     Error rendering ${id}:`, e.message);
            renderedSvg = `<div class="staff-error">Render Error: ${e.message}</div>`;
        }

        // 3. Construct HTML
        const exampleTitle = lang === 'zh' ? '示例' : 'Example';
        const copyLabel = lang === 'zh' ? '复制' : 'Copy';
        const resultTitle = lang === 'zh' ? '生成结果' : 'Score Result';
        
        const sectionBody = `
            <div class="docs-example-row">
                <div class="docs-section-pane">
                    <div class="docs-pane-title">${exampleTitle}</div>
                    <div class="docs-code-block">
                        <button
                            type="button"
                            class="docs-copy-button"
                            data-copy="${encodedDsl}"
                            data-copy-label="${copyLabel}"
                            aria-label="${copyLabel}"
                        >${copyLabel}</button>
                        <pre class="dsl-code-block">${highlightedDsl}</pre>
                    </div>
                </div>
                <div class="docs-section-pane">
                    <div class="docs-pane-title">${resultTitle}</div>
                    <div class="docs-preview-shell">
                        <div class="docs-preview-frame">
                            <div class="staff-preview-container">
                                <div class="staff-preview">${renderedSvg}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        
        replacements.push({ placeholder, content: sectionBody });
    }

    for (const r of replacements) {
        html = html.replace(r.placeholder, r.content);
    }

    fs.writeFileSync(outputPath, html);
    console.log(`Saved ${outputPath}`);
}

async function run() {
    await buildDocs('docs.template.html', 'docs.html');
    await buildDocs('docs_zh.template.html', 'docs_zh.html');
    console.log("Build complete.");
}

run().catch(console.error);
