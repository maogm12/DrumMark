import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");
const reportPath = path.join(distDir, "bundle-report.json");

if (!fs.existsSync(assetsDir)) {
  console.error("Bundle assets directory not found. Run `npm run build` first.");
  process.exit(1);
}

const assetFiles = fs.readdirSync(assetsDir).sort();
const jsAssets = assetFiles.filter((file) => file.endsWith(".js"));
const cssAssets = assetFiles.filter((file) => file.endsWith(".css"));

function assetInfo(file) {
  const fullPath = path.join(assetsDir, file);
  return {
    file,
    bytes: fs.statSync(fullPath).size,
  };
}

const jsInfo = jsAssets.map(assetInfo);
const cssInfo = cssAssets.map(assetInfo);
const entryAsset = jsInfo.find((asset) =>
  asset.file.startsWith("main-") || asset.file.startsWith("index-")
) ?? null;

const reachabilityTargets = [
  path.join(rootDir, "src"),
  path.join(rootDir, "build-docs.ts"),
  path.join(rootDir, "vite.config.ts"),
];

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const files = [];
  for (const entry of fs.readdirSync(target)) {
    files.push(...collectFiles(path.join(target, entry)));
  }
  return files;
}

const sourceFiles = reachabilityTargets.flatMap(collectFiles).filter((file, index, array) =>
  array.indexOf(file) === index
);

const sourceMentions = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("opensheetmusicdisplay")) {
    sourceMentions.push(path.relative(rootDir, file));
  }
}

const bundleMentions = [];
for (const asset of jsInfo) {
  const text = fs.readFileSync(path.join(assetsDir, asset.file), "utf8");
  if (text.includes("opensheetmusicdisplay")) {
    bundleMentions.push(asset.file);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  entryAsset,
  jsAssets: jsInfo,
  cssAssets: cssInfo,
  dependencyReachability: {
    opensheetmusicdisplay: {
      sourceMentions,
      bundleMentions,
      reachable: sourceMentions.length > 0 || bundleMentions.length > 0,
    },
  },
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${path.relative(rootDir, reportPath)}`);
if (entryAsset) {
  console.log(`Main JS bundle: ${entryAsset.file} (${entryAsset.bytes} bytes)`);
}
console.log(
  `opensheetmusicdisplay reachable: ${
    report.dependencyReachability.opensheetmusicdisplay.reachable ? "yes" : "no"
  }`,
);
