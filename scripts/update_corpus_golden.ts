import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLayoutSceneFromSourceNode, renderSourcePagesToSvgsNode } from "../src/renderer/svgRendererNode";
import { EXAMPLE_CORPUS_FILES } from "../src/dsl/example_corpus";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = ROOT;

function sceneSummary(scene: any) {
  const itemRoles: Record<string, number> = {};
  const compositeKinds: Record<string, number> = {};
  const fragmentKinds: Record<string, number> = {};
  let systems = 0;
  let measures = 0;
  let items = 0;
  let composites = 0;

  for (const page of scene.pages || []) {
    systems += page.systems?.length || 0;
    const pageItems = [
      ...(page.header?.items ?? []),
      ...(page.systems ?? []).flatMap((system) => system.items ?? []),
    ];
    const pageMeasures = (page.systems ?? []).flatMap((system) => system.measures ?? []);
    const pageComposites = [
      ...(page.header?.composites ?? []),
      ...(page.systems ?? []).flatMap((system) => system.composites ?? []),
    ];
    measures += pageMeasures.length;
    items += pageItems.length;
    composites += pageComposites.length;
    for (const item of pageItems) {
      itemRoles[item.role] = (itemRoles[item.role] || 0) + 1;
    }
    for (const composite of pageComposites) {
      compositeKinds[composite.kind] = (compositeKinds[composite.kind] || 0) + 1;
      fragmentKinds[`${composite.kind}:${composite.fragment}`] = (fragmentKinds[`${composite.kind}:${composite.fragment}`] || 0) + 1;
    }
  }

  return { pages: scene.pages?.length || 0, systems, measures, items, composites, itemRoles, compositeKinds, fragmentKinds };
}

function countRole(svg: string, role: string): number {
  return (svg.match(new RegExp(`data-role="${role}"`, "g")) || []).length;
}

function svgSemanticSummary(svg: string) {
  const semanticTextTokens = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m: RegExpMatchArray) => m[1].trim())
    .filter((t: string) => t.length > 0 && /[A-Za-z0-9@>%\u4e00-\u9fff]/.test(t))
    .sort();

  return {
    lineCount: (svg.match(/<line /g) || []).length,
    rectCount: (svg.match(/<rect /g) || []).length,
    textCount: (svg.match(/<text /g) || []).length,
    polylineCount: (svg.match(/<polyline /g) || []).length,
    openingBarlines: countRole(svg, "opening-barline"),
    genericBarlines: countRole(svg, "barline"),
    finalBarlineThin: countRole(svg, "final-barline-thin"),
    finalBarlineThick: countRole(svg, "final-barline-thick"),
    doubleBarlineLeft: countRole(svg, "double-barline-left"),
    doubleBarlineRight: countRole(svg, "double-barline-right"),
    noteheads: countRole(svg, "notehead"),
    stems: countRole(svg, "stem"),
    rests: countRole(svg, "rest"),
    measureRepeats: countRole(svg, "measure-repeat"),
    multiRestBars: countRole(svg, "multi-rest-bar"),
    multiRestCounts: countRole(svg, "multi-rest-count"),
    navStarts: countRole(svg, "nav-start"),
    navEnds: countRole(svg, "nav-end"),
    hairpinTop: countRole(svg, "hairpin-top"),
    hairpinBottom: countRole(svg, "hairpin-bottom"),
    repeatSpanLines: countRole(svg, "repeat-span-line"),
    voltaLines: countRole(svg, "volta-line"),
    sticking: countRole(svg, "sticking"),
    accents: countRole(svg, "accent"),
    semanticTextTokens: semanticTextTokens.join(" || "),
  };
}

const REPRESENTATIVE_SCENE_FILES = [
  "docs/examples/headers.drum",
  "docs/examples/repeats.drum",
  "docs/examples/hairpins.drum",
  "docs/examples/multi-rest.drum",
  "docs/examples/modifiers.drum",
  "docs/examples/sticking.drum",
  "docs/examples/full-example.drum",
] as const;

async function main() {
  // Update corpus gate report
  const sceneReport: { file: string; summary: ReturnType<typeof sceneSummary> }[] = [];
  const svgSemanticReport: { file: string; summary: ReturnType<typeof svgSemanticSummary> }[] = [];

  for (const file of EXAMPLE_CORPUS_FILES) {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    const scene = await buildLayoutSceneFromSourceNode(source, { staffSpacePt: 10.0, pageWidth: 612, showTitle: true });
    sceneReport.push({ file, summary: sceneSummary(scene) });

    const svg = (await renderSourcePagesToSvgsNode(source, { staffSpacePt: 10.0, pageWidth: 612, showTitle: true })).join("\n");
    svgSemanticReport.push({ file, summary: svgSemanticSummary(svg) });
  }

  const reportPath = join(REPO_ROOT, "docs", "layout-corpus", "corpus_gate_report.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  report.sceneReport = sceneReport;
  report.svgSemanticReport = svgSemanticReport;
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log("Updated corpus_gate_report.json");

  // Update scene snapshots
  for (const file of REPRESENTATIVE_SCENE_FILES) {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    const scene = await buildLayoutSceneFromSourceNode(source, { staffSpacePt: 10.0, pageWidth: 612, showTitle: true });
    const snapshotPath = join(
      REPO_ROOT,
      "docs",
      "layout-corpus",
      "scene-snapshots",
      `${file.split("/").pop()?.replace(".drum", "")}.layout-scene.json`,
    );
    writeFileSync(snapshotPath, JSON.stringify(scene, null, 2));
    console.log(`Updated ${file}`);
  }
  console.log("Done.");
}

main().catch(console.error);
