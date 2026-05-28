## Addendum v1.0: Internationalization (i18n) Support

### Motivation

The application currently has ~50 user-facing English strings hardcoded in TSX files. Adding Chinese (and potentially other languages) requires an i18n foundation.

### Scope

| Included | Excluded |
|----------|----------|
| UI chrome: tabs, buttons, tooltips, aria-labels | Debug section labels (developer-only) |
| Status bar messages | Music notation terms (Fine, D.C., D.S. — standard Italian) |
| Settings panel labels and section headers | Parser/diagnostic error messages (v2, needs structured message codes) |
| Preview state messages (Rendering…, fallback errors) | CLI output |
| Print/export/zoom toolbar labels | Docs page (separate static template, already has 中文文档 link) |
| Theme toggle aria-label | |

### Architecture

#### 1. Translation Files

`src/i18n/en.json` and `src/i18n/zh.json`, flat key-value with `{{param}}` placeholders:

```jsonc
// en.json
{
  "tabs.editor": "Editor",
  "tabs.page": "Page",
  "tabs.xml": "XML",
  "tabs.preview": "Preview",

  "status.valid": "✓ Valid",
  "status.errors_one": "{{count}} diagnostic issue found",
  "status.errors_other": "{{count}} diagnostic issues found",
  "status.lines": "{{count}} measures",
  "status.repeats": "{{count}} repeats",

  "settings.pageLayout": "Page Layout",
  "settings.notes": "Notes",
  "settings.staffLayout": "Staff & Layout",
  "settings.topMargin": "Top Margin",
  "settings.bottomMargin": "Bottom Margin",
  "settings.leftMargin": "Left Margin",
  "settings.rightMargin": "Right Margin",
  "settings.hideVoice2Rests": "Hide secondary voice rests",
  "settings.stemLength": "Note Stem Length",
  "settings.staffSize": "Staff Size",
  "settings.systemSpacing": "System Spacing",
  "settings.titleHeight": "Title Area Height",
  "settings.titleGap": "Title Gap",
  "settings.voltaOffset": "Volta Offset",
  "settings.hairpinOffset": "Hairpin Vertical Offset",

  "preview.rendering": "Rendering…",
  "preview.error": "Could not render staff preview",

  "toolbar.zoom": "Zoom {{percent}}%",
  "toolbar.fitWidth": "Fit Width",
  "toolbar.print": "Print Score",
  "toolbar.settings": "Settings",
  "toolbar.collapseAll": "Collapse All",
  "toolbar.expandAll": "Expand All",
  "toolbar.export": "Export MusicXML",
  "toolbar.generating": "Generating MusicXML…",

  "xml.generating": "Generating MusicXML…",
  "xml.switchPrompt": "Switch to XML tab to generate",

  "errorPanel.title": "Errors",
  "errorPanel.close": "Close",

  "alert.printPopup": "Please allow popups to use the print feature.",

  "theme.toggle": "Toggle theme",

  "brand.subtitle": "Text-first notation"
}
```

#### 2. Runtime Hook

```ts
// src/i18n/context.tsx
import { createContext, useContext } from "react";

export type Locale = "en" | "zh";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue>(null!);
export const useT = () => useContext(I18nContext);
```

The context provider loads the JSON bundle for the active locale. The `t()` function is a simple key lookup with `{{param}}` substitution.

#### 3. Language Detection & Persistence

Priority order:
1. User explicit toggle (saved to `localStorage` key `drummark-locale`)
2. Browser `navigator.language` (only if it matches an available locale)
3. Default `"en"`

#### 4. File Layout

```
src/
  i18n/
    en.json
    zh.json
    context.tsx        # I18nProvider + useT hook
```

### Non-Goals

- No pluralization engine — use `key_one` / `key_other` convention (max 2 forms needed for target languages)
- No extraction tooling — keys are manually curated in JSON files
- No string interpolation beyond `{{param}}` — no ICU MessageFormat
- No translation of parser error messages (requires message code system first)
- Debug labels (`"Tempo X"`, `"Coordinate Offsets"`, `"Experimental"`) remain hardcoded English

### Implementation Plan Outline

1. Create `src/i18n/en.json` and `src/i18n/zh.json` with all keys
2. Create `src/i18n/context.tsx` with `I18nProvider` and `useT` hook
3. Add language toggle to `App.tsx` header (a small `EN`/`中文` pill button next to theme toggle)
4. Wire `I18nProvider` around the app root in `App.tsx`
5. Replace hardcoded strings in `SettingsPanel.tsx`, `App.tsx`, status bar, toolbar, etc. with `t()` calls
6. Update tests to wrap components in `I18nProvider`

### Review Round 1

**Reviewer**: Architect review of i18n proposal against current codebase (`App.tsx`, `SettingsPanel.tsx`, `NumericSettingControl.tsx`, `settings-panel.test.tsx`).

---

#### 1. Missing Keys (Coverage Gaps)

The proposal's JSON snapshot omits several hardcoded strings present in the current codebase:

| Line | File | Current String | Status |
|------|------|---------------|--------|
| `App.tsx:1026` | Header link | `"Docs"` | **Missing** — no `nav.docs` or similar key |
| `App.tsx:477,484,1133,1139` | XML preview `aria-label` | `"MusicXML preview"` | **Missing** — should be `xml.previewAria` or similar |
| `App.tsx:1079` | Zoom popover reset button | `"100%"` | **Missing** (arguably universal, but should be either explicitly excluded or given a key) |
| `App.tsx:1170` | Status bar valid text | Current: `"✓ DSL Valid"` → Proposed: `"✓ Valid"` | **Change unstated** — removing "DSL" changes the message. Is this intentional? If so, document the rationale. |

Additionally, the proposal lists `toolbar.generating: "Generating MusicXML…"` and `xml.generating: "Generating MusicXML…"` as separate keys with identical English values. Are these semantically distinct (one is a button `title`, the other is a status span)? If so, they may diverge in translation — but having two keys with identical source text is a maintenance hazard. Consider merging into a single `generating.musicxml` key, or clearly document that they differ in context.

---

#### 2. NumericSettingControl `aria-label` Gap (Most Critical Missing Coverage)

`NumericSettingControl.tsx:45,69` generates dynamic `aria-label` strings:
```tsx
aria-label={`Decrease ${label}`}
aria-label={`Increase ${label}`}
```

With i18n, `label` becomes `t("settings.topMargin")` — e.g., `"上边距"` in Chinese. The resulting aria-label would be `"Decrease 上边距"` (mixed English/Chinese). This is a localization defect.

**Required action**: Add keys for the verb/proposition patterns:
```json
"settings.decrease": "Decrease {{label}}",
"settings.increase": "Increase {{label}}"
```
And update `NumericSettingControl` to either:
- Accept pre-computed `ariaLabelDecrease` / `ariaLabelIncrease` props from the parent, OR
- Receive a `t` function and construct aria-labels internally.

The proposal must also address the `"-"` and `"+"` button text content (currently hardcoded characters). While these are arguably universal symbols, CJK typography sometimes localizes these (e.g., fullwidth `＋`/`－`). At minimum, document the decision.

---

#### 3. Language Toggle Button Missing `aria-label`

Implementation Plan step 3 says: "a small `EN`/`中文` pill button". No i18n key exists for its `aria-label`. The button needs an accessible label like "Switch language" / "切换语言" (or "Switch to English" / "切换为中文" depending on the current locale). The proposal should include a key, e.g. `"lang.toggle"`.

---

#### 4. Status Bar Right-Side Composition Underspecified

The current code (`App.tsx:1173`) emits a single composed string:
```tsx
{score.ast.paragraphs.length} lines • {score.ast.repeats.length} repeats
```

The proposal provides two individual keys (`status.lines` / `status.repeats`) with `{{count}}` placeholders, but does **NOT** specify how they are composed. The `•` separator is a hardcoded character — fine, but the composition pattern (e.g., `` `${t("status.lines", ...)} • ${t("status.repeats", ...)}` ``) should be made explicit. 

**Edge case**: In Chinese, the expected order might be "N 个小节 • N 个反复" (measures first, repeats second). The proposal's current design is order-agnostic at the composition site. Clarify that the composite order is intentional and acceptable.

---

#### 5. Pluralization Convention — Caller Responsibility Not Documented

The proposal uses `key_one`/`key_other` convention (Non-Goals: "No pluralization engine"). This means the **caller** must select the correct key:
```tsx
// Current: score.errors.length === 1 ? "" : "s"
// Proposed: score.errors.length === 1 ? "status.errors_one" : "status.errors_other"
```

The proposal's `t()` function signature accepts only `(key, params?)` — it has no knowledge of plural forms. This is fine for English (2 forms) and Chinese (1 form — both keys could map to the same template). But the convention should be documented as a usage rule, not just implied by the key names. The proposal should state: "Callers are responsible for selecting `*_one` vs `*_other` based on count."

---

#### 6. Context Type — Hardcoded Union Limits Extensibility

```ts
export type Locale = "en" | "zh";
```

This requires a source-code change to add a third language. A more extensible pattern would be:
```ts
export type Locale = string; // validated at runtime against available bundles
```
or derive the type from the actual JSON filenames at build time. For a 2-language system this is low-priority, but the current design bakes a closed set into the type system. If the team intends to add languages frequently, this is a friction point.

---

#### 7. Async Bundle Loading — No Loading/Fallback State

The `I18nContextValue` interface has `locale` and `setLocale` but no `isLoading` or error state. The proposal says the provider "loads the JSON bundle" but doesn't specify if this is:
- **Synchronous** (e.g., `import en from "./en.json"` — bundled with the app, always available)
- **Asynchronous** (dynamic `import()` or `fetch()` — needs loading/error UI)

If synchronous (bundled into the main chunk), the existing ~50 keys add negligible bytes (~2 KB gzipped for 2 languages). This is acceptable. **But the proposal must state this explicitly**: "All JSON bundles are imported synchronously at build time via static import. No async loading." Otherwise, an implementor might choose lazy imports and introduce a flash of untranslated content.

---

#### 8. `t()` Parameter Interpolation — Implementation Not Specified

The proposal says "simple key lookup with `{{param}}` substitution" but doesn't specify:
- What happens when a key is missing? Return the key itself? Return empty string? Log a warning?
- What happens when a param is missing? Leave `{{param}}` literal in output, or replace with empty string?
- Is the lookup O(1) (direct property access) or iterative scan?

These are implementation details, but the **missing-key behavior** directly affects production UX — a missing translation that silently displays `"settings.stemLength"` as raw text is worse than falling back to English. The proposal should mandate: "If a key is not found, log a console warning and return the key string itself as a fallback."

---

#### 9. Test Impact — More Than Just Provider Wrapping

`settings-panel.test.tsx:58-61` asserts against raw text content:
```ts
expect(container.innerHTML).toContain("Notes");
expect(container.innerHTML).toContain("Page Layout");
expect(container.innerHTML).toContain("Staff &amp; Layout");
```

After i18n, these will return translated strings. The tests need to either:
1. Wrap in `I18nProvider` with `locale="en"` and assert English strings (simplest), OR
2. Use test IDs (`data-testid`) instead of text matching (more robust long-term).

The proposal says "Update tests to wrap components in `I18nProvider`" but doesn't mention that `openAccordionItem` (line 34-44) also matches by text content (`triggerText` parameter). Simply wrapping won't fix the `openAccordionItem("Notes")` call — the trigger's text content will be translated.

---

#### 10. `docs.html` / `docs_zh.html` Interaction

The scope excludes the docs pages. These are static HTML files generated by `build-docs.ts` from templates. The proposal correctly excludes them, but note: `docs.html:26` has a "Docs" link in the app header that navigates to `docs.html`. If the locale is `"zh"`, should the header link point to `docs_zh.html` instead? This is a UX question — the proposal should either:
- State that the docs link is locale-agnostic (always `docs.html`), OR
- Add a `nav.docsUrl` key or equivalent routing logic.

---

#### 11. Naming Convention Audit

The key namespace convention appears to be `<domain>.<component>` (e.g., `settings.topMargin`, `toolbar.print`). Minor inconsistencies:

- `tabs.editor` / `tabs.page` / `tabs.xml` / `tabs.preview` — but "Preview" is the **pane header** (`App.tsx:1051`), not a tab. This is a minor naming collision: should it be `panes.preview`? The proposal calls it `tabs.preview`, which is acceptable if we treat the pane-header as a tab label.
- `status.valid` and `status.errors_one` use `status.*`, but the status bar footer also emits composed content. A `status.` prefix is fine.
- `xml.switchPrompt` — the word "switchPrompt" is implementation-leaking. Better: `xml.notGenerated` or `xml.emptyState`.

---

#### 12. Architecture Simplicity Assessment

The flat-JSON + `{{param}}` + manual key selection approach is the right level of complexity for ~50 keys and 2 languages. Adding react-i18next, ICU, or a code-generation step would be premature. The `useT()` hook pattern mirrors React conventions.

One improvement: consider exporting a **typed key union** (or at least a `const` array) so TypeScript can catch typos:
```ts
// src/i18n/keys.ts
export const I18N_KEYS = [
  "tabs.editor", "tabs.page", // ...
] as const;
export type I18nKey = typeof I18N_KEYS[number];
```
With `t: (key: I18nKey, ...) => string`, misspelled keys become compile-time errors. This is low-effort, high-value for a manually-curated key system.

---

#### Summary

The proposal is substantially correct and well-scoped. The identified gaps are:

| Severity | Issue |
|----------|-------|
| **CRITICAL** | NumericSettingControl aria-labels will emit mixed-language strings (Section 2) |
| **HIGH** | Missing keys: `"Docs"` link, `"MusicXML preview"` aria-label, language toggle aria-label (Section 1, 3) |
| **MEDIUM** | Status bar composition not specified (Section 4) |
| **MEDIUM** | Plural key selection responsibility not documented (Section 5) |
| **MEDIUM** | Missing-key fallback behavior not specified (Section 8) |
| **MEDIUM** | Test impact deeper than provider wrapping — text-based selectors break (Section 9) |
| **LOW** | `Locale` type is a closed union (Section 6) |
| **LOW** | Duplicate `Generating MusicXML…` keys (Section 1) |
| **LOW** | `xml.switchPrompt` naming leaks implementation (Section 11) |

**STATUS: CHANGES_REQUESTED**

The critical issue (Section 2) must be resolved before implementation. All HIGH and MEDIUM items need documented decisions in an Author Response.

### Author Response

**Section 1 (Missing Keys):**

- `"Docs"` link key: Added as `nav.docs: "Docs"`.
- `"MusicXML preview"` aria-label: Added as `xml.previewAria: "MusicXML preview"`.
- `"100%"` zoom reset: Not translated (universal numeric symbol). Documented in non-goals.
- `"✓ DSL Valid"` → `"✓ Valid"`: Intentional. "DSL" is jargon; the checkmark already communicates validity. The full message is just `"✓ Valid"`.
- Duplicate `Generating MusicXML…` keys: Merged into a single `generating.musicxml` key. The toolbar button `title` and the status span use the same string — same key, same translation.

**Section 2 (NumericSettingControl aria-label):**

Agreed. Add two pattern keys:
```json
"settings.decrease": "Decrease {{label}}",
"settings.increase": "Increase {{label}}"
```
`NumericSettingControl` will receive a `t` function (or pre-computed aria-label strings via `ariaLabelDecrease`/`ariaLabelIncrease` props) to construct localized aria-labels. The `-` and `+` button text characters remain universal — documented decision.

**Section 3 (Language toggle aria-label):**

Added key `lang.toggle: "Switch language"`.

**Section 4 (Status bar composition):**

The composite pattern is: `` `${t("status.lines", {count})} • ${t("status.repeats", {count})}` ``. Order is `lines` then `repeats` — standard left-to-right layout, acceptable for both EN and ZH. Documented.

**Section 5 (Pluralization convention):**

Documented: "*_one / *_other key selection is caller responsibility. For Chinese, both map to the same template (Chinese has no plural morphology).*"

**Section 6 (Locale type):**

Keep closed union `type Locale = "en" | "zh"` for now. Adding a third language is a deliberate decision (new JSON file + type update), not something that happens frequently. Will revisit if language count exceeds 5.

**Section 7 (Async loading):**

Clarified: "All JSON bundles are imported synchronously at build time via static `import`. No async loading, no loading state." The ~50 keys add negligible bundle size.

**Section 8 (Missing-key fallback):**

Specified: "If a key is not found, `console.warn('Missing i18n key: ${key}')` and return the key string itself. Missing params leave `{{param}}` literal in output (should not happen with typed params)."

**Section 9 (Test impact):**

Tests will wrap in `I18nProvider` with `locale="en"` and continue matching against English strings. `openAccordionItem` still works since triggers and their text content are translated together. No change to the test assertion approach — text matching with locale pinned to `"en"` is deterministic.

**Section 10 (Docs link):**

The docs link is locale-agnostic (always `docs.html`). Chinese users navigate via the language switcher on the docs page itself. Noted.

**Section 11 (Naming):**

- `tabs.preview` → renamed to `panes.preview`.
- `xml.switchPrompt` → renamed to `xml.emptyState`.

**Section 12 (Typed keys):**

Will add `src/i18n/keys.ts` with a `const` array and export `I18nKey` type. Low effort, prevents typos.

### Review Round 2

**Reviewer**: Verification of Author Response against all CRITICAL, HIGH, and MEDIUM issues from Round 1.

---

#### CRITICAL: Section 2 (NumericSettingControl aria-label) — ✅ RESOLVED

Pattern keys `settings.decrease` / `settings.increase` with `{{label}}` substitution added. Implementation choice (pass `t` function vs. pre-computed props) left to implementor — both valid. `-`/`+` characters documented as universal. The `settings.*` namespace for these action verbs is slightly incongruent (they describe UI behavior, not a setting value), but it's internally consistent within the module they're consumed in. No technical defect.

---

#### HIGH: Section 1 (Missing Keys) — ✅ RESOLVED

All four missing strings now accounted for:
- `nav.docs` — ✅
- `xml.previewAria` — ✅
- `"100%"` documented as intentionally untranslated — ✅
- `"✓ DSL Valid"` → `"✓ Valid"` rationale documented — ✅ (dropping jargon is correct per the AGENTS.md Content Design rules)

Duplicate `toolbar.generating` / `xml.generating` merged into single `generating.musicxml`. Consolidation removes a maintenance hazard.

---

#### HIGH: Section 3 (Language toggle aria-label) — ✅ RESOLVED

`lang.toggle: "Switch language"` added.

---

#### MEDIUM: Section 4 (Status bar composition) — ✅ RESOLVED

Composition pattern explicitly specified: `` `${t("status.lines", {count})} • ${t("status.repeats", {count})}` ``. Order (`lines` then `repeats`) documented as acceptable for both target languages.

---

#### MEDIUM: Section 5 (Pluralization convention) — ✅ RESOLVED

Caller responsibility for `*_one` / `*_other` key selection documented. Chinese behavior (both keys map to same template) noted.

---

#### MEDIUM: Section 7 (Async loading) — ✅ RESOLVED

Clarified: synchronous static `import`, no async, no loading state. This is the correct choice for ~50 keys.

---

#### MEDIUM: Section 8 (Missing-key fallback) — ✅ RESOLVED

Specific behavior mandated: `console.warn` + return key string. Missing params leave `{{param}}` literal — a visible-to-developer failure mode preferable to silent data loss.

---

#### MEDIUM: Section 9 (Test impact) — ✅ RESOLVED

Approach validated: `I18nProvider` with `locale="en"` pinning, text-based assertions remain deterministic. The `openAccordionItem` helper relies on `textContent?.includes(triggerText)` — with locale pinned to `"en"`, trigger text is English and matches continue to work. Verified by tracing through `SettingsPanel.tsx:62-64` (trigger renders `t("settings.notes")` → "Notes") and the test calls `openAccordionItem(container, "Notes")`. No gap.

---

#### LOW Items — Acknowledged

- Section 6 (Locale type): Decision to keep closed union — acceptable for current scale.
- Section 10 (Docs link): Locale-agnostic `docs.html` — acceptable, Chinese docs have their own language switcher.
- Section 11 (Naming): `tabs.preview` → `panes.preview`, `xml.switchPrompt` → `xml.emptyState` — both improvements. Noted that "Preview" is also a tab trigger in the mobile view, so `panes.*` is a slight mismatch in that context, but the meaning is unambiguous.
- Section 12 (Typed keys): Adopted — low effort, high value.

---

#### Cross-Cutting Checks

1. **No new contradictions introduced**: The renamed keys (`panes.preview`, `xml.emptyState`) and merged key (`generating.musicxml`) don't conflict with any other part of the proposal. The original JSON snapshot shows old names, but that's expected per the Linear Ledger Protocol — the Author Response supersedes and consolidation will unify.

2. **Implementation feasibility**: Every resolved item maps to a concrete action in the existing 6-step plan. The new keys fit the flat JSON structure. The `NumericSettingControl` change (pass `t` or pre-computed aria props) is a small refactor, not an architectural change.

3. **No gaps re-opened**: All 12 sections from Round 1 received a response. No issue was silently dropped.

---

#### Summary

All CRITICAL, HIGH, and MEDIUM issues are resolved with specific, implementable decisions. The LOW items received documented dispositions. The proposal is now implementation-ready.

**STATUS: APPROVED**
