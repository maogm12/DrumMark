import { describe, expect, it } from "vitest";
import { normalizeExplicitTheme, resolveThemeFromSignals } from "./theme";

describe("theme resolution", () => {
  it("accepts explicit light and dark overrides only", () => {
    expect(normalizeExplicitTheme("light")).toBe("light");
    expect(normalizeExplicitTheme("dark")).toBe("dark");
    expect(normalizeExplicitTheme("system")).toBeNull();
    expect(normalizeExplicitTheme("")).toBeNull();
    expect(normalizeExplicitTheme(null)).toBeNull();
  });

  it("prefers explicit root override over system preference", () => {
    expect(resolveThemeFromSignals("light", true)).toBe("light");
    expect(resolveThemeFromSignals("dark", false)).toBe("dark");
  });

  it("falls back to system preference when no explicit override exists", () => {
    expect(resolveThemeFromSignals(null, true)).toBe("dark");
    expect(resolveThemeFromSignals(undefined, false)).toBe("light");
    expect(resolveThemeFromSignals("foo", true)).toBe("dark");
    expect(resolveThemeFromSignals("foo", false)).toBe("light");
  });
});
