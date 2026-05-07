export type AppTheme = "light" | "dark";

export function normalizeExplicitTheme(value: string | null | undefined): AppTheme | null {
  if (value === "light" || value === "dark") {
    return value;
  }
  return null;
}

export function resolveThemeFromSignals(explicitTheme: string | null | undefined, prefersDark: boolean): AppTheme {
  return normalizeExplicitTheme(explicitTheme) ?? (prefersDark ? "dark" : "light");
}

export function resolveDocumentTheme(doc: Document = document, win: Window = window): AppTheme {
  const explicitTheme = doc.documentElement.getAttribute("data-theme");
  const prefersDark = win.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveThemeFromSignals(explicitTheme, prefersDark);
}

export function subscribeToThemeChanges(listener: () => void, doc: Document = document, win: Window = window): () => void {
  const mediaQuery = win.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => listener();
  const observer = new MutationObserver(handleChange);

  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleChange);
    };
  }

  mediaQuery.addListener(handleChange);
  return () => {
    observer.disconnect();
    mediaQuery.removeListener(handleChange);
  };
}
