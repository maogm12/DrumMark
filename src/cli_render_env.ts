import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import { registerFont } from "canvas";

let renderEnvironmentReady = false;
let fileReaderInstalled = false;

type CliRenderEnvironmentOptions = {
  installFileReader?: boolean;
};

class MockFileReader {
  onloadend: (() => void) | null = null;
  result: string | null = null;

  readAsDataURL(): void {
    this.onloadend?.();
  }
}

export function ensureCliRenderEnvironment(
  options: CliRenderEnvironmentOptions = {},
): void {
  const globals = globalThis as typeof globalThis & Record<string, unknown>;

  if (renderEnvironmentReady) {
    if (options.installFileReader && !fileReaderInstalled) {
      globals.FileReader = MockFileReader;
      fileReaderInstalled = true;
    }
    return;
  }

  const dom = new JSDOM(
    "<!DOCTYPE html><html><body><div id=\"container\"></div></body></html>",
    { pretendToBeVisual: true },
  );

  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.HTMLElement = dom.window.HTMLElement;
  globals.HTMLAnchorElement = dom.window.HTMLAnchorElement;
  globals.HTMLDivElement = dom.window.HTMLDivElement;
  globals.SVGElement = dom.window.SVGElement;
  globals.Image = dom.window.Image;
  globals.DOMParser = dom.window.DOMParser;
  globals.XMLSerializer = dom.window.XMLSerializer;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fontsDir = path.resolve(__dirname, "../public/fonts");
  const bravuraPath = path.join(fontsDir, "bravura.otf");
  if (fs.existsSync(bravuraPath)) {
    try {
      registerFont(bravuraPath, { family: "Bravura" });
    } catch {
      // Ignore duplicate or unsupported font registration failures in CLI mode.
    }
  }

  if (!globalThis.fetch) {
    globals.fetch = () => Promise.reject(new Error("Fetch not available in Node."));
  }

  if (options.installFileReader) {
    globals.FileReader = MockFileReader;
    fileReaderInstalled = true;
  }

  renderEnvironmentReady = true;
}
