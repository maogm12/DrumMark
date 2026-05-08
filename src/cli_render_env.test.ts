import { describe, expect, it } from "vitest";
import { ensureCliRenderEnvironment } from "./cli_render_env";

describe("ensureCliRenderEnvironment", () => {
  it("installs the shared DOM bootstrap contract and remains idempotent", () => {
    ensureCliRenderEnvironment({ installFileReader: true });
    const firstDocument = globalThis.document;
    const firstDomParser = globalThis.DOMParser;
    const firstXmlSerializer = globalThis.XMLSerializer;
    const firstWindow = globalThis.window;
    const firstImage = globalThis.Image;
    const firstFetch = globalThis.fetch;
    const firstFileReader = globalThis.FileReader;

    expect(firstDocument).toBeDefined();
    expect(firstDomParser).toBeDefined();
    expect(firstXmlSerializer).toBeDefined();
    expect(firstWindow).toBeDefined();
    expect(firstImage).toBeDefined();
    expect(firstFetch).toBeDefined();
    expect(firstFileReader).toBeDefined();

    ensureCliRenderEnvironment();

    expect(globalThis.document).toBe(firstDocument);
    expect(globalThis.DOMParser).toBe(firstDomParser);
    expect(globalThis.XMLSerializer).toBe(firstXmlSerializer);
    expect(globalThis.window).toBe(firstWindow);
    expect(globalThis.Image).toBe(firstImage);
    expect(globalThis.fetch).toBe(firstFetch);
    expect(globalThis.FileReader).toBe(firstFileReader);
  });
});
