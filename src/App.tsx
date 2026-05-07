import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type UIEvent, type WheelEvent as ReactWheelEvent } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers, keymap } from "@codemirror/view";
import { history, historyKeymap } from "@codemirror/commands";
import { linter, type Diagnostic } from "@codemirror/lint";
import { buildNormalizedScore, type ParseError } from "./dsl";
import { type NormalizedScore } from "./dsl";
import { renderScorePagesToSvgs, type VexflowRenderOptions } from "./vexflow";
import { drumMarkEditorTheme, drumMarkLanguage, drumMarkSyntaxHighlighting } from "./drummark";

const legacySeedDsl = `tempo 96
time 4/4
note 1/16

HH |: x - x - o - x - | x - x:close - X - x - :|
SD |  - - d:cross - d - | D:rim - [2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC |  - - x:bell - - - - - | - - - - x - - - |
ST |  [2: R L R] - - -     | R - L - R - L - |`;

const seedDsl = `title "Advanced Funk"
subtitle "Performance Study"
composer "G. Mao"
tempo 120
time 4/4
note 1/16
grouping 2+2

HH |: x x x x x x x x :| x x x x x x o x |
HF | - - - - - - p - | - - - - - - p - |
SD | - - d - - - D - | - - d - - - d - |
BD | b - - - b - - - | b - - - B - - - |

| d d d d *2 |

ST | R - L - [2: R L R] - | R - L - R - L - |
RC | r r r r r r r r | r r r r r r r r |
C  | - - - - - - - c | - - - - - - - C |

| @segno c2 - cl - *2 | %% | @fine |`;

type PagePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const pdfPageWidth = 612;
const pdfPageHeight = 792;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  downloadBlob(filename, new Blob([content], { type: mimeType }));
}

function safeExportBasename(title: string | undefined) {
  const filename = title ? title : "drummark";
  return filename
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "drummark";
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

function SearchPlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function SearchMinusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect height="8" width="12" x="6" y="14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stepPrecision(step: number) {
  const stepText = step.toString();
  const decimal = stepText.indexOf(".");
  return decimal >= 0 ? stepText.length - decimal - 1 : 0;
}

function normalizeSteppedValue(value: number, min: number, max: number, step: number) {
  const precision = stepPrecision(step);
  const clamped = clampNumber(value, min, max);
  return Number(clamped.toFixed(precision));
}

function NumericSettingControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const inputMode = stepPrecision(step) > 0 ? "decimal" : "numeric";
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyValue = (next: number) => {
    onChange(normalizeSteppedValue(next, min, max, step));
  };

  const handleRangePointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    const input = rangeRef.current;
    if (!input) return;

    event.preventDefault();
    const startX = event.clientX;
    const startValue = value;
    input.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = input.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaRatio = (moveEvent.clientX - startX) / rect.width;
      const rawValue = startValue + deltaRatio * (max - min);
      const steppedValue = min + Math.round((rawValue - min) / step) * step;
      applyValue(steppedValue);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      input.removeEventListener("pointermove", handlePointerMove);
      input.removeEventListener("pointerup", handlePointerUp);
      input.removeEventListener("pointercancel", handlePointerUp);
    };

    setIsDragging(true);
    input.addEventListener("pointermove", handlePointerMove);
    input.addEventListener("pointerup", handlePointerUp);
    input.addEventListener("pointercancel", handlePointerUp);
  };

  const handleRangeWheel = (event: ReactWheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    applyValue(value + direction * step);
  };

  return (
    <div className="setting-row numeric-setting-row">
      <div className="setting-label">
        <span>{label}</span>
      </div>
      <input
        ref={rangeRef}
        className={isDragging ? "setting-range is-dragging" : "setting-range"}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => applyValue(parseFloat(e.target.value))}
        onPointerDown={handleRangePointerDown}
        onWheel={handleRangeWheel}
      />
      <div className="setting-stepper">
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => applyValue(value - step)}
        >
          -
        </button>
        <input
          className="setting-stepper-input"
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const next = parseFloat(e.target.value);
            if (!Number.isNaN(next)) {
              applyValue(next);
            }
          }}
        />
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => applyValue(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function CollapseAllIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="10" y1="14" x2="21" y2="3" />
      <line x1="3" y1="21" x2="14" y2="10" />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function DrumIcon() {
  return (
    <svg aria-hidden="true" className="app-logo" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 22V6C19 6 24 7 24 12" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="22" r="7" stroke="var(--text-main)" strokeWidth="2"/>
      <circle cx="12" cy="22" r="8.5" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.4"/>
      <circle cx="12" cy="13.5" r="1" fill="var(--text-main)"/>
      <circle cx="12" cy="30.5" r="1" fill="var(--text-main)"/>
      <circle cx="3.5" cy="22" r="1" fill="var(--text-main)"/>
      <circle cx="20.5" cy="22" r="1" fill="var(--text-main)"/>
      <line x1="7" y1="20" x2="17" y2="20" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.6"/>
      <line x1="7" y1="22" x2="17" y2="22" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.6"/>
      <line x1="7" y1="24" x2="17" y2="24" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.6"/>
    </svg>
  );
}

const linterCompartment = new Compartment();

function DslEditor({ value, onChange, errors }: { value: string; onChange: (value: string) => void; errors: ParseError[] }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          keymap.of(historyKeymap),
          EditorState.tabSize.of(2),
          EditorView.contentAttributes.of({
            spellcheck: "false",
            autocorrect: "off",
            autocapitalize: "off",
            "data-gramm": "false",
          }),
          drumMarkLanguage,
          drumMarkSyntaxHighlighting,
          drumMarkEditorTheme,
          linterCompartment.of(
            linter((v) => {
              return errors.map((err) => {
                const lineNum = Math.min(Math.max(1, err.line), v.state.doc.lines);
                const line = v.state.doc.line(lineNum);
                const pos = Math.min(line.from + Math.max(0, err.column - 1), line.to);
                return {
                  from: pos,
                  to: Math.min(pos + 1, line.to),
                  severity: "error",
                  message: err.message,
                } as Diagnostic;
              });
            }),
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: hostRef.current,
    });

    viewRef.current = view;

    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: linterCompartment.reconfigure(
        linter((v) => {
          return errors.map((err) => {
            const lineNum = Math.min(Math.max(1, err.line), v.state.doc.lines);
            const line = v.state.doc.line(lineNum);
            const pos = Math.min(line.from + Math.max(0, err.column - 1), line.to);
            return {
              from: pos,
              to: Math.min(pos + 1, line.to),
              severity: "error",
              message: err.message,
            } as Diagnostic;
          });
        }),
      ),
    });
  }, [errors]);

  return (
    <div className="editor-shell">
      <div className="editor-container" ref={hostRef} />
    </div>
  );
}

const PagePreview = memo(function PagePreview({
  score,
  pagePadding,
  staffScale,
  headerHeight,
  headerStaffSpacing,
  systemSpacing,
  stemLength,
  voltaSpacing,
  hairpinOffsetY,
  hideVoice2Rests,
  tempoOffsetX,
  tempoOffsetY,
  measureNumberOffsetX,
  measureNumberOffsetY,
  measureNumberFontSize,
  durationSpacingCompression,
  measureWidthCompression,
  active,
}: {
  score: NormalizedScore | null;
  pagePadding: PagePadding;
  staffScale: number;
  headerHeight: number;
  headerStaffSpacing: number;
  systemSpacing: number;
  stemLength: number;
  voltaSpacing: number;
  hairpinOffsetY: number;
  hideVoice2Rests: boolean;
  tempoOffsetX: number;
  tempoOffsetY: number;
  measureNumberOffsetX: number;
  measureNumberOffsetY: number;
  measureNumberFontSize: number;
  durationSpacingCompression: number;
  measureWidthCompression: number;
  active: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef({ top: 0, left: 0 });
  const [renderedMarkup, setRenderedMarkup] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    scrollPosRef.current = {
      top: e.currentTarget.scrollTop,
      left: e.currentTarget.scrollLeft,
    };
  }

  useEffect(() => {
    if (!active || !score) return;

    const targetTop = scrollPosRef.current.top;
    const targetLeft = scrollPosRef.current.left;
    setIsRendering(true);

    const opts: VexflowRenderOptions = {
      pagePadding,
      staffScale,
      pageWidth: pdfPageWidth,
      pageHeight: pdfPageHeight,
      headerHeight,
      headerStaffSpacing,
      systemSpacing,
      stemLength,
      voltaSpacing,
      hairpinOffsetY,
      hideVoice2Rests,
      tempoOffsetX,
      tempoOffsetY,
      measureNumberOffsetX,
      measureNumberOffsetY,
      measureNumberFontSize,
      durationSpacingCompression,
      measureWidthCompression,
    };

    renderScorePagesToSvgs(score, opts)
      .then((pages) => {
        const markup = pages.map((svg, i) => `<section class="staff-preview-page" data-page="${i+1}">${svg}</section>`).join("");
        setRenderedMarkup(markup);
        setIsRendering(false);

        if (shellRef.current) {
          shellRef.current.scrollTop = targetTop;
          shellRef.current.scrollLeft = targetLeft;
        }

        setError(null);
      })
      .catch((renderError) => {
        setIsRendering(false);
        const msg = renderError instanceof Error ? renderError.message : String(renderError);
        console.error("VexFlow render error:", renderError);
        setError(msg || "Could not render staff preview.");
      });
  }, [score, systemSpacing, stemLength, voltaSpacing, hairpinOffsetY, headerStaffSpacing, headerHeight, active, hideVoice2Rests, pagePadding, staffScale, tempoOffsetX, tempoOffsetY, measureNumberOffsetX, measureNumberOffsetY, measureNumberFontSize, durationSpacingCompression, measureWidthCompression]);

  if (!score) {
    return (
      <div className="staff-preview-shell" ref={shellRef} onScroll={handleScroll}>
        <div className="staff-printable-frame">
          <div className="staff-printable">
            <div className="staff-preview page-view">
              <section className="staff-preview-page" data-page="1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-preview-shell" ref={shellRef} onScroll={handleScroll}>
      {error ? <div className="staff-error">{error}</div> : null}
      {isRendering && !renderedMarkup ? (
        <div className="staff-rendering">Rendering…</div>
      ) : null}
      <div className="staff-printable-frame">
        <div className="staff-printable">
          <div className="staff-preview page-view" dangerouslySetInnerHTML={{ __html: renderedMarkup }} />
        </div>
      </div>
    </div>
  );
});

function MusicXmlPreview({ xml, collapsed, toggle }: {
  xml: string;
  collapsed: Set<string>;
  toggle: (path: string) => void;
}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const parseError = doc.querySelector("parsererror");

  if (parseError) {
    return (
      <div className="xml-preview" aria-label="MusicXML preview">
        <pre>{xml}</pre>
      </div>
    );
  }

  return (
    <div className="xml-preview" aria-label="MusicXML preview">
      {renderXmlTreeLines(doc.documentElement, 0, "", collapsed, toggle, 0)}
    </div>
  );
}

function renderXmlTreeLines(node: Node, depth: number, path: string, collapsed: Set<string>, toggle: (path: string) => void, index: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return (
      <div key={`t-${index}`} className="xml-line" style={{ paddingLeft: depth * 16 }}>
        <span className="xml-text">{text}</span>
      </div>
    );
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tagName = el.nodeName;
  const nodePath = path ? `${path}/${tagName}` : tagName;
  const isCollapsed = collapsed.has(nodePath);

  const childNodes = Array.from(el.childNodes);
  const childElements = childNodes.filter((n) => n.nodeType === Node.ELEMENT_NODE);
  const textContent = childNodes
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join("");

  const attrs = Array.from(el.attributes).map((attr) => (
    <span key={attr.name} className="xml-attr">
      <span className="xml-attr-name">{attr.name}</span>
      <span className="xml-attr-eq">="</span>
      <span className="xml-attr-value">{attr.value}</span>
      <span className="xml-attr-eq">"</span>
    </span>
  ));

  // Leaf element: text content only, no child elements → inline
  if (childElements.length === 0 && textContent) {
    return (
      <div key={`e-${index}`} className="xml-line" style={{ paddingLeft: depth * 16 }}>
        <span className="xml-toggle xml-toggle-placeholder"/>
        <span className="xml-bracket">{"<"}</span>
        <span className="xml-tag">{tagName}</span>
        {attrs}
        <span className="xml-bracket">{">"}</span>
        <span className="xml-text">{textContent}</span>
        <span className="xml-bracket">{"</"}{tagName}{">"}</span>
      </div>
    );
  }

  const hasChildren = childElements.length > 0;

  return (
    <div key={`e-${index}`}>
      <div className="xml-line" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <span className="xml-toggle" onClick={() => toggle(nodePath)}>
            <span className="xml-arrow">{isCollapsed ? "▶" : "▼"}</span>
          </span>
        ) : (
          <span className="xml-toggle xml-toggle-placeholder"/>
        )}
        <span className="xml-bracket">{"<"}</span>
        <span className="xml-tag">{tagName}</span>
        {attrs}
        <span className="xml-bracket">{isCollapsed && hasChildren ? "> [...]" : (hasChildren ? ">" : "/>")}</span>
      </div>
      {hasChildren && !isCollapsed && childElements.map((child, i) =>
        renderXmlTreeLines(child, depth + 1, `${nodePath}/${i}`, collapsed, toggle, i),
      )}
      {hasChildren && !isCollapsed && (
        <div className="xml-line" style={{ paddingLeft: depth * 16 }}>
          <span className="xml-bracket">{"</"}{tagName}{">"}</span>
        </div>
      )}
    </div>
  );
}


type MainTab = "editor" | "page" | "xml";

interface AppSettings {
  hideVoice2Rests: boolean;
  pagePadding: PagePadding;
  pageScale: number;
  staffScale: number;
  headerStaffSpacing: number;
  systemSpacing: number;
  stemLength: number;
  voltaSpacing: number;
  hairpinOffsetY: number;
  headerHeight: number;
  activeTab: MainTab;
  tempoOffsetX: number;
  tempoOffsetY: number;
  measureNumberOffsetX: number;
  measureNumberOffsetY: number;
  measureNumberFontSize: number;
  durationSpacingCompression: number;
  measureWidthCompression: number;
}

const defaultSettings: AppSettings = {
  hideVoice2Rests: false,
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  pageScale: 0.8,
  staffScale: 0.75,
  headerStaffSpacing: 60,
  headerHeight: 50,
  systemSpacing: 30,
  stemLength: 31,
  voltaSpacing: -15,
  hairpinOffsetY: -15,
  activeTab: "page",
  tempoOffsetX: 0,
  tempoOffsetY: 0,
  measureNumberOffsetX: 0,
  measureNumberOffsetY: 8,
  measureNumberFontSize: 10,
  durationSpacingCompression: 0.6,
  measureWidthCompression: 0.75,
};

export function App() {
  const [dsl, setDsl] = useState(() => {
    const saved = localStorage.getItem("drummark-dsl");
    if (!saved || saved === legacySeedDsl) {
      return seedDsl;
    }
    return saved;
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("drummark-settings");
    if (!saved) return defaultSettings;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.pageScale === undefined || parsed.pageScale < 0.2 || parsed.pageScale > 5) {
        parsed.pageScale = 1.0;
      }
      if (parsed.stemLength === undefined || parsed.stemLength < 20 || parsed.stemLength > 40) {
        parsed.stemLength = 31;
      }
      if (parsed.voltaSpacing === undefined || parsed.voltaSpacing < -16 || parsed.voltaSpacing > 16) {
        parsed.voltaSpacing = -15;
      }
      if (parsed.hairpinOffsetY === undefined || parsed.hairpinOffsetY < -40 || parsed.hairpinOffsetY > 40) {
        parsed.hairpinOffsetY = -15;
      }
      if (parsed.headerHeight === undefined) {
        parsed.headerHeight = 50;
      }
      if (parsed.durationSpacingCompression === undefined || parsed.durationSpacingCompression < 0 || parsed.durationSpacingCompression > 1.5) {
        parsed.durationSpacingCompression = 0.6;
      }
      if (parsed.measureWidthCompression === undefined || parsed.measureWidthCompression < 0 || parsed.measureWidthCompression > 1.5) {
        parsed.measureWidthCompression = 0.75;
      }
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  });

  const [settingsVisible, setSettingsVisible] = useState(true);
  const [pageZoomMenuOpen, setPageZoomMenuOpen] = useState(false);
  const pageZoomMenuRef = useRef<HTMLDivElement>(null);
  const [xmlCollapsed, setXmlCollapsed] = useState<Set<string>>(new Set());
  const debugMode = new URLSearchParams(window.location.search).has("debug");

  const xmlToggle = (path: string) => {
    setXmlCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const xmlIsAllCollapsed = xmlCollapsed.size > 0;
  const xmlToggleAll = () => {
    if (xmlIsAllCollapsed) {
      setXmlCollapsed(new Set());
    } else {
      setXmlCollapsed(new Set(["score-partwise", "part-list", "part"]));
    }
  };

  // Close settings panel when switching away from page tab
  useEffect(() => {
    if (settings.activeTab !== "page") {
      setSettingsVisible(false);
    }
  }, [settings.activeTab]);

  useEffect(() => {
    if (!pageZoomMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (pageZoomMenuRef.current && !pageZoomMenuRef.current.contains(e.target as Node)) {
        setPageZoomMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pageZoomMenuOpen]);
  
  const [showErrors, setShowErrors] = useState(false);
  
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem("drummark-editor-width");
    return saved ? parseInt(saved, 10) : 600;
  });
  const isResizingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestHandledRequestIdRef = useRef(0);
  const [isScorePending, setIsScorePending] = useState(false);
  const [analysis, setAnalysis] = useState(() => {
    const initialScore = buildNormalizedScore(dsl);
    return { score: initialScore };
  });
  const [staffXml, setStaffXml] = useState<string | null>(null);
  const [isXmlPending, setIsXmlPending] = useState(false);
  const xmlRequestIdRef = useRef(0);
  const latestXmlIdRef = useRef(0);
  const pendingExportRef = useRef(false);
  const exportBasenameRef = useRef(safeExportBasename(undefined));

  const score = analysis.score;
  const hasRenderableScore = useMemo(
    () => score.ast.paragraphs.some((paragraph) => paragraph.measureCount > 0 && paragraph.tracks.length > 0),
    [score],
  );
  const analysisInput = useMemo(
    () => ({
      dsl,
      hideVoice2Rests: settings.hideVoice2Rests,
    }),
    [dsl, settings.hideVoice2Rests],
  );
  const debouncedAnalysisInput = useDebouncedValue(
    analysisInput,
    120,
  );
  const canExport = !isScorePending && hasRenderableScore && score.errors.length === 0;

  useEffect(() => {
    const worker = new Worker(new URL("./scoreWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ type: string; id: number; score?: NormalizedScore; xml?: string }>) => {
      const { type, id, score: nextScore, xml: nextXml } = event.data;

      if (type === "parse" && nextScore) {
        if (id < latestHandledRequestIdRef.current) return;
        latestHandledRequestIdRef.current = id;
        setAnalysis({ score: nextScore });
        setIsScorePending(id !== requestIdRef.current);
      } else if (type === "xml" && nextXml !== undefined) {
        if (id < latestXmlIdRef.current) return;
        latestXmlIdRef.current = id;
        setStaffXml(nextXml);
        setIsXmlPending(false);
        if (pendingExportRef.current) {
          pendingExportRef.current = false;
          downloadTextFile(
            `${exportBasenameRef.current}.musicxml`,
            nextXml,
            "application/vnd.recordare.musicxml+xml",
          );
        }
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    const nextId = requestIdRef.current + 1;
    requestIdRef.current = nextId;
    setIsScorePending(true);
    worker.postMessage({
      type: "parse" as const,
      id: nextId,
      dsl: debouncedAnalysisInput.dsl,
      hideVoice2Rests: debouncedAnalysisInput.hideVoice2Rests,
    });
  }, [debouncedAnalysisInput]);

  // Request XML when switching to XML tab or when score changes while on XML tab
  const requestXml = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const id = ++xmlRequestIdRef.current;
    setIsXmlPending(true);
    worker.postMessage({
      type: "generateXml" as const,
      id,
      hideVoice2Rests: settings.hideVoice2Rests,
    });
  }, [settings.hideVoice2Rests]);

  useEffect(() => {
    if (settings.activeTab === "xml" && score && !isScorePending) {
      requestXml();
    }
  }, [settings.activeTab, score, isScorePending, requestXml]);

  useEffect(() => {
    exportBasenameRef.current = safeExportBasename(score.ast.headers.title?.value);
  }, [score]);

  useEffect(() => {
    localStorage.setItem("drummark-dsl", dsl);
  }, [dsl]);

  useEffect(() => {
    localStorage.setItem("drummark-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.activeTab !== "page" || Math.abs(settings.pageScale - 1) < 0.001) {
      setPageZoomMenuOpen(false);
    }
  }, [settings.pageScale, settings.activeTab]);

  useEffect(() => {
    localStorage.setItem("drummark-editor-width", String(editorWidth));
  }, [editorWidth]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updatePagePadding = (key: keyof PagePadding, value: number) => {
    setSettings((prev) => ({
      ...prev,
      pagePadding: { ...prev.pagePadding, [key]: value },
    }));
  };

  const handleMouseDown = useCallback(() => {
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      setEditorWidth(Math.max(320, Math.min(window.innerWidth - 320, e.clientX)));
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  function handleMusicXmlExport() {
    if (staffXml) {
      downloadTextFile(`${safeExportBasename(score.ast.headers.title?.value)}.musicxml`, staffXml, "application/vnd.recordare.musicxml+xml");
    } else if (!isXmlPending) {
      pendingExportRef.current = true;
      requestXml();
    }
  }

  function handlePrint() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.alert("Please allow popups to use the print feature.");
      return;
    }

    const title = score.ast.headers.title?.value ?? "DrumMark Score";
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map(el => el.outerHTML)
      .join("\n");

    const scoreHtml = document.querySelector(".staff-preview.page-view")?.innerHTML || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          ${styles}
          <style>
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; background: white; }
              .staff-printable-frame { margin: 0 !important; padding: 0 !important; }
              .staff-preview-page {
                margin: 0 !important;
                padding: 0 !important;
                page-break-after: always;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
              }
              .staff-preview-page:last-child { page-break-after: auto; }
              svg { width: 100% !important; height: auto !important; }
            }
            body { 
              margin: 0; 
              padding: 20px; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              background: #f0f2f5; 
            }
            .staff-preview-page {
              background: white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              margin-bottom: 20px;
              width: 100%;
              max-width: 800px;
            }
          </style>
        </head>
        <body>
          ${scoreHtml}
          <script>
            window.onload = () => {
              // Give some time for fonts/SVGs to stabilize
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const [fitWidth, setFitWidth] = useState(true);
  const pageZoomPercent = Math.round(settings.pageScale * 100);

  const pageSurfaceBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fitWidth || !pageSurfaceBodyRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Dynamic padding based on mobile vs desktop
        const isMobile = window.innerWidth <= 768;
        const padding = isMobile ? 0 : 80;
        const containerWidth = entry.contentRect.width - padding;
        const baseWidth = 800;
        const newScale = Math.max(0.2, Math.min(3.0, Math.round((containerWidth / baseWidth) * 20) / 20));

        // Direct DOM update for instant feedback
        pageSurfaceBodyRef.current?.style.setProperty("--page-scale", newScale.toString());
        setSettings(prev => ({ ...prev, pageScale: newScale }));
      }
    });

    observer.observe(pageSurfaceBodyRef.current);
    return () => observer.disconnect();
    }, [fitWidth]);

    // Keep DOM variable in sync with state for non-gesture updates
    useEffect(() => {
    pageSurfaceBodyRef.current?.style.setProperty("--page-scale", settings.pageScale.toString());
    }, [settings.pageScale]);

    function adjustPageScale(delta: number) {
    setFitWidth(false);
    setSettings((prev) => ({
      ...prev,
      pageScale: Math.max(0.2, Math.min(3.0, Math.round((prev.pageScale + delta) * 100) / 100)),
    }));
    }

    const touchStateRef = useRef({ distance: 0, initialScale: 1 });
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    useEffect(() => {
    const handleGlobalWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (settingsRef.current.activeTab === "page" && pageSurfaceBodyRef.current?.contains(event.target as Node)) {
          adjustPageScale(event.deltaY < 0 ? 0.1 : -0.1);
        }
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2 && pageSurfaceBodyRef.current?.contains(event.target as Node)) {
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        if (!t1 || !t2) return;
        const dx = t1.pageX - t2.pageX;
        const dy = t1.pageY - t2.pageY;
        touchStateRef.current = {
          distance: Math.sqrt(dx * dx + dy * dy),
          initialScale: settingsRef.current.pageScale
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && pageSurfaceBodyRef.current?.contains(event.target as Node)) {
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        if (!t1 || !t2) return;

        event.preventDefault(); 
        setFitWidth(false);

        const dx = t1.pageX - t2.pageX;
        const dy = t1.pageY - t2.pageY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (touchStateRef.current.distance > 0) {
          const ratio = distance / touchStateRef.current.distance;
          const newScale = Math.max(0.2, Math.min(3.0, touchStateRef.current.initialScale * ratio));

          // Direct DOM update - fast!
          pageSurfaceBodyRef.current?.style.setProperty("--page-scale", newScale.toString());
        }
      }
    };

    const handleTouchEnd = () => {
      if (touchStateRef.current.distance > 0) {
        // Sync final scale back to React state once gesture ends
        const currentScale = parseFloat(pageSurfaceBodyRef.current?.style.getPropertyValue("--page-scale") || "1");
        if (!isNaN(currentScale)) {
          setSettings(prev => ({ ...prev, pageScale: currentScale }));
        }
        touchStateRef.current.distance = 0;
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
    }, []); // Empty dependency array means listeners are stable and never re-bind

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-branding">
          <DrumIcon />
          <div>
            <h1>
              DrumMark
            </h1>
            <p>Text-first notation</p>
          </div>
        </div>
        <div className="header-actions">
          <a className="export-button" href="docs.html"><BookIcon /> Docs</a>
        </div>
      </header>

      <section className="workspace">
        <section className={`pane editor-pane${settings.activeTab === "editor" ? " active" : ""}`} style={{ width: editorWidth }}>
          <header className="pane-header">
            <span className="pane-title">Editor</span>
            <div className="preview-header-actions mobile-only-actions">
              <div className="preview-tabs" role="tablist">
                <button className={`preview-tab tab-editor${settings.activeTab === "editor" ? " active" : ""}`} onClick={() => updateSetting("activeTab", "editor")} type="button">Editor</button>
                <button className={`preview-tab${settings.activeTab === "page" ? " active" : ""}`} onClick={() => updateSetting("activeTab", "page")} type="button">Page</button>
                <button className={`preview-tab${settings.activeTab === "xml" ? " active" : ""}`} onClick={() => updateSetting("activeTab", "xml")} type="button">XML</button>
              </div>
            </div>
          </header>
          <DslEditor value={dsl} onChange={setDsl} errors={score.errors} />
        </section>

        <div className="resizer" onMouseDown={handleMouseDown} />

        <section className={`pane preview-pane${settings.activeTab !== "editor" ? " active" : ""}`} aria-label="Preview">
          <header className="pane-header">
            <span className="pane-title">Preview</span>
            <div className="preview-header-actions">
              <div className="preview-tabs" role="tablist">
                <button className={`preview-tab tab-editor${settings.activeTab === "editor" ? " active" : ""}`} onClick={() => updateSetting("activeTab", "editor")} type="button">Editor</button>
                <button className={`preview-tab${settings.activeTab === "page" ? " active" : ""}`} onClick={() => updateSetting("activeTab", "page")} type="button">Page</button>
                <button className={`preview-tab${settings.activeTab === "xml" ? " active" : ""}`} onClick={() => updateSetting("activeTab", "xml")} type="button">XML</button>
              </div>
            </div>
          </header>
          
          <div className="preview-container">
            <div className="preview-content">
              <div className={`preview-surface${settings.activeTab === "page" ? " active" : ""}`} aria-hidden={settings.activeTab !== "page"}>
                <div className="surface-toolbar page-surface-toolbar">
                  <div className="toolbar-group">
                    <div className="page-zoom-menu" ref={pageZoomMenuRef}>
                      <button aria-label="Zoom" className="surface-icon-button" onClick={() => setPageZoomMenuOpen((current) => !current)} type="button" title={`Zoom ${pageZoomPercent}%`}>
                        {Math.abs(settings.pageScale - 1.0) < 0.001 ? <SearchIcon /> : (settings.pageScale < 1 ? <SearchMinusIcon /> : <SearchPlusIcon />)}
                      </button>
                      {pageZoomMenuOpen ? (
                        <div className="page-zoom-popover">
                          <div className="page-zoom-readout">{fitWidth ? "Fit Width" : `${pageZoomPercent}%`}</div>
                          <div className="page-zoom-buttons">
                            <button className="page-zoom-action" onClick={() => adjustPageScale(-0.1)} type="button">-</button>
                            <button className="page-zoom-reset" onClick={() => { setFitWidth(false); updateSetting("pageScale", 1.0); setPageZoomMenuOpen(false); }} type="button">100%</button>
                            <button className="page-zoom-action" onClick={() => adjustPageScale(0.1)} type="button">+</button>
                            <button className="page-zoom-reset fit-width-button" onClick={() => setFitWidth(true)} type="button">Fit Width</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button className="surface-icon-button" onClick={handlePrint} type="button" title="Print Score">
                      <PrinterIcon />
                    </button>
                    <button className={`surface-icon-button${settingsVisible ? " active" : ""}`} onClick={() => setSettingsVisible(!settingsVisible)} type="button" title="Settings">
                      <SettingsIcon />
                    </button>
                  </div>
                </div>
                <div className="page-surface-body" ref={pageSurfaceBodyRef}>
                  {settings.activeTab === "page" ? (
                    <PagePreview
                      score={hasRenderableScore ? score : null}
                      pagePadding={settings.pagePadding}
                      staffScale={settings.staffScale}
                      headerHeight={settings.headerHeight}
                      headerStaffSpacing={settings.headerStaffSpacing}
                      systemSpacing={settings.systemSpacing}
                      stemLength={settings.stemLength}
                      voltaSpacing={settings.voltaSpacing}
                      hairpinOffsetY={settings.hairpinOffsetY}
                      hideVoice2Rests={settings.hideVoice2Rests}
                      tempoOffsetX={settings.tempoOffsetX}
                      tempoOffsetY={settings.tempoOffsetY}
                      measureNumberOffsetX={settings.measureNumberOffsetX}
                      measureNumberOffsetY={settings.measureNumberOffsetY}
                      measureNumberFontSize={settings.measureNumberFontSize}
                      durationSpacingCompression={settings.durationSpacingCompression}
                      measureWidthCompression={settings.measureWidthCompression}
                      active={true}
                    />
                  ) : null}
                </div>
              </div>
              <div className={`preview-surface${settings.activeTab === "xml" ? " active" : ""}`} aria-hidden={settings.activeTab !== "xml"}>
                <div className="surface-toolbar xml-surface-toolbar">
                  <div className="toolbar-group">
                    <button className="surface-icon-button" onClick={xmlToggleAll} type="button" title={xmlIsAllCollapsed ? "Expand All" : "Collapse All"}>
                      {xmlIsAllCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
                    </button>
                    <button className="surface-icon-button" disabled={!canExport || isXmlPending} onClick={handleMusicXmlExport} type="button" title={isXmlPending ? "Generating MusicXML…" : "Export MusicXML"}>
                      <SaveIcon />
                    </button>
                  </div>
                </div>
                {settings.activeTab === "xml" ? (
                  isXmlPending ? (
                    <div className="xml-preview xml-pending" aria-label="MusicXML preview">
                      <span>Generating MusicXML…</span>
                    </div>
                  ) : staffXml ? (
                    <MusicXmlPreview xml={staffXml} collapsed={xmlCollapsed} toggle={xmlToggle} />
                  ) : (
                    <div className="xml-preview xml-pending" aria-label="MusicXML preview">
                      <span>Switch to XML tab to generate</span>
                    </div>
                  )
                ) : null}
              </div>
              </div>

            <aside className={`settings-panel${settingsVisible ? " active" : ""}`}>
              <div className="settings-section">
                <h3 className="settings-section-title">Notation</h3>
                <label className="setting-row toggle">
                  <span>Hide lower-voice rests</span>
                  <div className="toggle-switch">
                    <input type="checkbox" checked={settings.hideVoice2Rests} onChange={(e) => updateSetting("hideVoice2Rests", e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
                  <div className="settings-section">
                    <h3 className="settings-section-title">Page Layout</h3>
                    <NumericSettingControl
                      label="Staff Size"
                      value={settings.staffScale}
                      min={0.3}
                      max={1.5}
                      step={0.05}
                      onChange={(value) => updateSetting("staffScale", value)}
                    />
                  <NumericSettingControl
                    label="Distance Between Systems"
                    value={settings.systemSpacing}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) => updateSetting("systemSpacing", value)}
                  />
                  <NumericSettingControl
                    label="Note Stem Length"
                    value={settings.stemLength}
                    min={15}
                    max={50}
                    step={1}
                    onChange={(value) => updateSetting("stemLength", value)}
                  />
                  <NumericSettingControl
                    label="Volta Distance from Notes"
                    value={settings.voltaSpacing}
                    min={-20}
                    max={20}
                    step={1}
                    onChange={(value) => updateSetting("voltaSpacing", value)}
                  />
                  <NumericSettingControl
                    label="Hairpin Vertical Position"
                    value={settings.hairpinOffsetY}
                    min={-40}
                    max={40}
                    step={1}
                    onChange={(value) => updateSetting("hairpinOffsetY", value)}
                  />
                  <div className="padding-grid-container">
                    <span className="setting-label-small">Page Margins</span>
                    <div className="padding-grid">
                      <NumericSettingControl
                        label="Top Margin"
                        value={settings.pagePadding.top}
                        min={0}
                        max={800}
                        step={1}
                        onChange={(value) => updatePagePadding("top", value)}
                      />
                      <div className="padding-grid-middle">
                        <NumericSettingControl
                          label="Left Margin"
                          value={settings.pagePadding.left}
                          min={0}
                          max={400}
                          step={1}
                          onChange={(value) => updatePagePadding("left", value)}
                        />
                        <NumericSettingControl
                          label="Right Margin"
                          value={settings.pagePadding.right}
                          min={0}
                          max={400}
                          step={1}
                          onChange={(value) => updatePagePadding("right", value)}
                        />
                      </div>
                      <NumericSettingControl
                        label="Bottom Margin"
                        value={settings.pagePadding.bottom}
                        min={0}
                        max={800}
                        step={1}
                        onChange={(value) => updatePagePadding("bottom", value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3 className="settings-section-title">Title Area</h3>
                  <NumericSettingControl
                    label="Title Area Height"
                    value={settings.headerHeight}
                    min={10}
                    max={300}
                    step={1}
                    onChange={(value) => updateSetting("headerHeight", value)}
                  />
                  <NumericSettingControl
                    label="Distance from Title Area to Staff"
                    value={settings.headerStaffSpacing}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) => updateSetting("headerStaffSpacing", value)}
                  />
                </div>
                {debugMode && (
                  <div className="settings-section debug">
                    <h3 className="settings-section-title">Debug: Tempo Marking</h3>
                    <NumericSettingControl
                      label="Tempo Marking Left/Right Position"
                      value={settings.tempoOffsetX}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateSetting("tempoOffsetX", value)}
                    />
                    <NumericSettingControl
                      label="Tempo Marking Up/Down Position"
                      value={settings.tempoOffsetY}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateSetting("tempoOffsetY", value)}
                    />
                  </div>
                )}
                {debugMode && (
                  <div className="settings-section debug">
                    <h3 className="settings-section-title">Debug: Measure Numbers</h3>
                    <NumericSettingControl
                      label="Measure Number Left/Right Position"
                      value={settings.measureNumberOffsetX}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateSetting("measureNumberOffsetX", value)}
                    />
                    <NumericSettingControl
                      label="Measure Number Up/Down Position"
                      value={settings.measureNumberOffsetY}
                      min={-100}
                      max={100}
                      step={1}
                      onChange={(value) => updateSetting("measureNumberOffsetY", value)}
                    />
                    <NumericSettingControl
                      label="Measure Number Size"
                      value={settings.measureNumberFontSize}
                      min={4}
                      max={24}
                      step={1}
                      onChange={(value) => updateSetting("measureNumberFontSize", value)}
                    />
                  </div>
                )}
                {debugMode && (
                  <div className="settings-section debug">
                    <h3 className="settings-section-title">Debug: Note Spacing</h3>
                    <NumericSettingControl
                      label="Duration Spacing Compression"
                      value={settings.durationSpacingCompression}
                      min={0}
                      max={1.5}
                      step={0.05}
                      onChange={(value) => updateSetting("durationSpacingCompression", value)}
                    />
                  </div>
                )}
                {debugMode && (
                  <div className="settings-section debug">
                    <h3 className="settings-section-title">Debug: Measure Widths</h3>
                    <NumericSettingControl
                      label="Measure Width Compression"
                      value={settings.measureWidthCompression}
                      min={0}
                      max={1.5}
                      step={0.05}
                      onChange={(value) => updateSetting("measureWidthCompression", value)}
                    />
                  </div>
                )}
              </aside>
          </div>
        </section>
      </section>

      <footer className="status-bar">
        <div className="status-left">
          {score.errors.length > 0 ? (
            <button 
              className={`status-error-toggle${showErrors ? " active" : ""}`}
              onClick={() => setShowErrors(!showErrors)}
              type="button"
            >
              {score.errors.length} diagnostic issue{score.errors.length === 1 ? "" : "s"} found
            </button>
          ) : (
            <span className="status-success">✓ DSL Valid</span>
          )}
        </div>
        <div className="status-right">{score.ast.paragraphs.length} lines • {score.ast.repeatSpans.length} repeats</div>
      </footer>

      {score.errors.length > 0 && showErrors && (
        <div className="error-list">
          <div className="error-list-header">
            <span>Errors</span>
            <button onClick={() => setShowErrors(false)}>Close</button>
          </div>
          <div className="error-list-content">
            {score.errors.map((error, index) => (
              <div className="error-item" key={`${error.line}-${error.column}-${index}`}>
                <span className="error-loc">[{error.line}:{error.column}]</span>
                <span>{error.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
