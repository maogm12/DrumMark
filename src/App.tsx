import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { TRACKS, type MeasureToken, type Modifier, type NormalizedScore, type ScoreMeasure, type ScoreTrackParagraph, type TrackName } from "./dsl";

const seedDsl = `tempo 96
time 4/4
divisions 16

HH |: x - x - o - x - | x - x:close - X - x - :|x3
SD |  - - d:cross - g - | D:rim - [2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC |  - - x:bell - - - - - | - - - - x - - - |
ST |  [2: R L R] - - -     | R - L - R - L - |`;

type PreviewMode = "grid" | "staff" | "xml";
const staffPaperWidth = 900;
const pdfCjkFontName = "SourceHanSansCN";
const pdfCjkFontUrl = "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/Variable/TTF/Subset/SourceHanSansCN-VF.ttf";

let pdfCjkFontBytes: Uint8Array | null = null;

const trackLabel: Record<TrackName, string> = {
  HH: "HH",
  HF: "HF",
  SD: "SD",
  BD: "BD",
  T1: "T1",
  T2: "T2",
  T3: "T3",
  RC: "RC",
  C: "C",
  ST: "ST",
};

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
  const filename = title ? title : "drum-notation";
  return filename
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "drum-notation";
}

function svgSize(svg: SVGSVGElement) {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
  const viewBoxWidth = viewBox && viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : 0;
  const viewBoxHeight = viewBox && viewBox.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3] : 0;
  const attrWidth = Number.parseFloat(svg.getAttribute("width") ?? "");
  const attrHeight = Number.parseFloat(svg.getAttribute("height") ?? "");
  const rect = svg.getBoundingClientRect();

  return {
    width: viewBoxWidth || attrWidth || rect.width || 900,
    height: viewBoxHeight || attrHeight || rect.height || 240,
  };
}

function hasCjkText(value: string | undefined): boolean {
  return Boolean(value && /[^\u0000-\u00ff]/.test(value));
}

async function loadPdfCjkFont() {
  if (pdfCjkFontBytes) {
    return pdfCjkFontBytes;
  }

  const response = await fetch(pdfCjkFontUrl);
  if (!response.ok) {
    throw new Error(`Could not load PDF font: ${response.status}`);
  }

  pdfCjkFontBytes = new Uint8Array(await response.arrayBuffer());
  return pdfCjkFontBytes;
}

async function addSubsetCjkMetadata(
  pdfBytes: ArrayBuffer,
  metadata: { title: string; subtitle?: string; composer?: string },
  layout: { margin: number; contentWidth: number; pageWidth: number },
) {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit.default ?? fontkit);
  pdfDoc.setTitle(metadata.title);
  const font = await pdfDoc.embedFont(await loadPdfCjkFont(), {
    subset: true,
    customName: pdfCjkFontName,
  });
  const firstPage = pdfDoc.getPage(0);
  const { height } = firstPage.getSize();
  let y = height - layout.margin;

  function drawPdfText(
    text: string,
    {
      size,
      align,
    }: {
      size: number;
      align: "center" | "right";
    },
  ) {
    const lineHeight = size * 1.3;
    let fontSize = size;
    let textWidth = font.widthOfTextAtSize(text, fontSize);
    if (textWidth > layout.contentWidth) {
      fontSize = Math.max(8, size * (layout.contentWidth / textWidth));
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }

    const x = align === "center"
      ? (layout.pageWidth - textWidth) / 2
      : layout.pageWidth - layout.margin - textWidth;
    firstPage.drawText(text, {
      x,
      y: y - fontSize,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }

  drawPdfText(metadata.title, { size: 22, align: "center" });
  if (metadata.subtitle) {
    drawPdfText(metadata.subtitle, { size: 13, align: "center" });
  }
  if (metadata.composer) {
    drawPdfText(metadata.composer, { size: 11, align: "right" });
  }

  return pdfDoc.save({
    useObjectStreams: true,
  });
}

async function downloadStaffPdf(markup: string, filename: string) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "900px";
  container.style.background = "white";
  container.style.color = "black";
  container.style.visibility = "hidden";
  container.innerHTML = markup;
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true, putOnlyUsedFonts: true });
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;
    const contentBottom = pageHeight - margin;
    let y = margin;

    const title = container.querySelector<HTMLElement>(".staff-score-title")?.textContent?.trim();
    const subtitle = container.querySelector<HTMLElement>(".staff-score-subtitle")?.textContent?.trim();
    const composer = container.querySelector<HTMLElement>(".staff-score-composer")?.textContent?.trim();
    const useCjkFont = hasCjkText(title) || hasCjkText(subtitle) || hasCjkText(composer);

    function addPdfText(
      text: string,
      {
        size,
        align,
        style = "normal",
      }: {
        size: number;
        align: "left" | "center" | "right";
        style?: "normal" | "bold" | "italic";
      },
    ) {
      const lineHeight = size * 1.3;
      pdf.setFont("helvetica", style);
      pdf.setFontSize(size);

      let fontSize = size;
      const textWidth = useCjkFont ? 0 : pdf.getTextWidth(text);
      if (textWidth > contentWidth) {
        fontSize = Math.max(8, size * (contentWidth / textWidth));
        pdf.setFontSize(fontSize);
      }

      const textX = align === "center" ? pageWidth / 2 : align === "right" ? pageWidth - margin : margin;
      if (!useCjkFont) {
        pdf.text(text, textX, y + fontSize, { align });
      }
      y += lineHeight;
    }

    const pdfTitle = title || "Drum Notation";
    pdf.setProperties({ title: pdfTitle });
    addPdfText(pdfTitle, {
      size: 22,
      align: "center",
      style: "bold",
    });

    if (subtitle) {
      addPdfText(subtitle, {
        size: 13,
        align: "center",
        style: "italic",
      });
    }

    if (composer) {
      addPdfText(composer, {
        size: 11,
        align: "right",
      });
      y += 8;
    } else {
      y += 12;
    }

    const svgs = [...container.querySelectorAll<SVGSVGElement>(".staff-preview svg")];
    if (svgs.length === 0) {
      throw new Error("Staff preview is not ready yet.");
    }

    for (const svg of svgs) {
      const size = svgSize(svg);
      const scale = Math.min(contentWidth / size.width, (contentBottom - margin) / size.height);
      const renderWidth = size.width * scale;
      const renderHeight = size.height * scale;

      if (y + renderHeight > contentBottom) {
        pdf.addPage();
        y = margin;
      }

      await svg2pdf(svg, pdf, {
        x: margin + (contentWidth - renderWidth) / 2,
        y,
        width: renderWidth,
        height: renderHeight,
      });
      y += renderHeight + 12;
    }

    if (useCjkFont) {
      const subsetPdfBytes = await addSubsetCjkMetadata(
        pdf.output("arraybuffer"),
        {
          title: pdfTitle,
          subtitle,
          composer,
        },
        {
          margin,
          contentWidth,
          pageWidth,
        },
      );
      const subsetPdfBuffer = subsetPdfBytes.buffer.slice(
        subsetPdfBytes.byteOffset,
        subsetPdfBytes.byteOffset + subsetPdfBytes.byteLength,
      ) as ArrayBuffer;
      downloadBlob(filename, new Blob([subsetPdfBuffer], { type: "application/pdf" }));
    } else {
      pdf.save(filename);
    }
  } finally {
    document.body.removeChild(container);
  }
}
function parsePreviewMode(value: string | null): PreviewMode {
  return value === "staff" || value === "xml" ? value : "grid";
}

function beautifyXml(xml: string): string {
  const lines = xml
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let depth = 0;

  return lines.map((line) => {
    if (/^<\/.+>$/.test(line)) {
      depth = Math.max(depth - 1, 0);
    }

    const formatted = `${"  ".repeat(depth)}${line}`;

    if (
      /^<[^!?/][^>]*>$/.test(line) &&
      !/^<[^>]+\/>$/.test(line) &&
      !/^<[^>]+>.*<\/[^>]+>$/.test(line)
    ) {
      depth += 1;
    }

    return formatted;
  }).join("\n");
}

function highlightDsl(source: string): ReactNode[] {
  const pattern = /(#[^\n]*|\b(?:title|subtitle|composer|tempo|time|divisions|grouping)\b|\b(?:HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)\b|:\|x\d+|\|:|:\||[|[\]]|\b(?:open|close|choke|rim|cross|bell|flam)\b|[A-Za-z]\w*|\d+(?:\/\d+|\+\d+)*|-|:)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }

    const value = match[0];
    let className = "dsl-token";

    if (value.startsWith("#")) {
      className += " dsl-comment";
    } else if (/^(title|subtitle|composer|tempo|time|divisions|grouping)$/.test(value)) {
      className += " dsl-header";
    } else if (/^(HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)$/.test(value)) {
      className += " dsl-track";
    } else if (/^(:\|x\d+|\|:|:\||\|)$/.test(value)) {
      className += " dsl-barline";
    } else if (/^[[\]]$/.test(value)) {
      className += " dsl-group";
    } else if (/^(open|close|choke|rim|cross|bell|flam)$/.test(value)) {
      className += " dsl-modifier";
    } else if (/^\d/.test(value)) {
      className += " dsl-number";
    } else if (value === "-") {
      className += " dsl-rest";
    } else if (value === ":") {
      className += " dsl-punctuation";
    } else {
      className += " dsl-note";
    }

    nodes.push(
      <span className={className} key={`${match.index}-${value}`}>
        {value}
      </span>,
    );
    cursor = match.index + value.length;
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }

  return nodes;
}

function highlightXmlLine(line: string, lineIndex: number): ReactNode[] {
  const pattern = /(<\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?>)|(<\?[^>]*\?>|<![^>]*>)|([^<]+)/g;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match[5]) {
      nodes.push(
        <span className="xml-punctuation" key={`${lineIndex}-${match.index}-decl`}>
          {match[5]}
        </span>,
      );
      continue;
    }

    if (match[6]) {
      nodes.push(
        <span className="xml-text" key={`${lineIndex}-${match.index}-text`}>
          {match[6]}
        </span>,
      );
      continue;
    }

    const [, open, tagName, attrs, close] = match;
    nodes.push(
      <span className="xml-punctuation" key={`${lineIndex}-${match.index}-open`}>
        {open}
      </span>,
      <span className="xml-tag" key={`${lineIndex}-${match.index}-tag`}>
        {tagName}
      </span>,
    );

    const attrPattern = /(\s+)([A-Za-z_:][\w:.-]*)(=)("[^"]*")/g;
    let attrCursor = 0;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      if (attrMatch.index > attrCursor) {
        nodes.push(attrs.slice(attrCursor, attrMatch.index));
      }

      nodes.push(
        attrMatch[1],
        <span className="xml-attr" key={`${lineIndex}-${match.index}-${attrMatch.index}-attr`}>
          {attrMatch[2]}
        </span>,
        <span className="xml-punctuation" key={`${lineIndex}-${match.index}-${attrMatch.index}-eq`}>
          {attrMatch[3]}
        </span>,
        <span className="xml-string" key={`${lineIndex}-${match.index}-${attrMatch.index}-value`}>
          {attrMatch[4]}
        </span>,
      );
      attrCursor = attrMatch.index + attrMatch[0].length;
    }

    if (attrCursor < attrs.length) {
      nodes.push(attrs.slice(attrCursor));
    }

    nodes.push(
      <span className="xml-punctuation" key={`${lineIndex}-${match.index}-close`}>
        {close}
      </span>,
    );
  }

  return nodes;
}

function modifierLabel(modifier: Modifier): string {
  switch (modifier) {
    case "open":
      return "open";
    case "close":
      return "close";
    case "choke":
      return "choke";
    case "rim":
      return "rim";
    case "cross":
      return "cross";
    case "bell":
      return "bell";
    case "flam":
      return "flam";
  }
}

function tokenText(token: MeasureToken): string {
  switch (token.kind) {
    case "basic":
      return token.value;
    case "modified":
      return `${token.value}:${token.modifier}`;
    case "group":
      return `[${token.count}/${token.span}: ${token.items.map(tokenText).join(" ")}]`;
  }
}

function tokenClassName(token: MeasureToken): string {
  if (token.kind === "group") {
    return "grid-token group";
  }

  const base = ["grid-token"];

  if (token.value === "-") {
    base.push("rest");
  }

  if (token.kind === "modified") {
    base.push("modified");
  }

  if (token.value === "X" || token.value === "D") {
    base.push("accent");
  }

  if (token.value === "g") {
    base.push("ghost");
  }

  if (token.value === "R" || token.value === "L") {
    base.push("sticking");
  }

  return base.join(" ");
}

function renderToken(token: MeasureToken, key: string) {
  if (token.kind === "group") {
    return (
      <span className={tokenClassName(token)} key={key}>
        <span className="group-meta">
          {token.count}/{token.span}
        </span>
        <span className="group-items">
          {token.items.map((item, index) => (
            <span className={tokenClassName(item)} key={`${key}-${index}`}>
              {tokenText(item)}
            </span>
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className={tokenClassName(token)} key={key} title={token.kind === "modified" ? modifierLabel(token.modifier) : undefined}>
      {tokenText(token)}
    </span>
  );
}

function DslEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const highlightedDsl = useMemo(() => highlightDsl(value), [value]);

  function syncHighlightScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  return (
    <div className="editor-shell">
      <pre className="editor-highlight" ref={highlightRef} aria-hidden="true">
        {highlightedDsl}
        {"\n"}
      </pre>
      <textarea
        className="editor-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncHighlightScroll}
        spellCheck={false}
      />
    </div>
  );
}

function Preview({ score }: { score: NormalizedScore }) {
  return (
    <div className="preview-content">
      <section className="score-summary" aria-label="Score summary">
        <span className="summary-badge">{score.ast.headers.tempo.value} BPM</span>
        <span className="summary-badge">
          {score.ast.headers.time.beats}/{score.ast.headers.time.beatUnit}
        </span>
        <span className="summary-badge">{score.ast.headers.divisions.value} DIV</span>
        <span className="summary-badge">{score.ast.repeatSpans.length} REPEATS</span>
      </section>
      {score.ast.paragraphs.map((paragraph, paragraphIndex) => {
        const tracks = TRACKS.filter((track) => paragraph.tracks.some((entry) => entry.track === track))
          .map((track) => paragraph.tracks.find((entry) => entry.track === track))
          .filter((entry): entry is ScoreTrackParagraph => entry !== undefined);

        return (
          <section className="grid-system" key={`paragraph-${paragraphIndex}`}>
            <header className="system-header">
              <span className="system-title">Line {paragraphIndex + 1}</span>
              <span className="system-title">{paragraph.measureCount} bars</span>
            </header>
            <div className="system-body">
              {tracks.map((track) => {
                const groups: ScoreMeasure[][] = [];
                let currentGroup: ScoreMeasure[] = [];
                let lastLine: number | undefined;

                for (const measure of track.measures) {
                  if (lastLine !== undefined && measure.sourceLine !== lastLine) {
                    groups.push(currentGroup);
                    currentGroup = [];
                  }
                  currentGroup.push(measure);
                  lastLine = measure.sourceLine;
                }
                if (currentGroup.length > 0) {
                  groups.push(currentGroup);
                }

                return (
                  <div className="track-row" key={`${paragraphIndex}-${track.track}`}>
                    <div className="track-label">{trackLabel[track.track]}</div>
                    <div className="track-measures">
                      {groups.flatMap((group, gi) => {
                        const groupKey = `${track.track}-group-${gi}`;
                        return [
                          <div key={groupKey} className="measure-group">
                            {group.map((measure) => (
                              <div className={`measure-card${measure.generated ? " generated" : ""}`} key={`${track.track}-${measure.globalIndex}`}>
                                <div className="measure-boundary">
                                  {measure.repeatStart ? <span className="repeat-flag">|:</span> : <span className="repeat-flag subtle">|</span>}
                                  {measure.repeatEnd ? (
                                    <span className="repeat-flag">
                                      :|{measure.repeatTimes && measure.repeatTimes > 2 ? `x${measure.repeatTimes}` : ""}
                                    </span>
                                  ) : (
                                    <span className="repeat-flag subtle">|</span>
                                  )}
                                </div>
                                <div className="measure-tokens">
                                  {measure.tokens.map((token, index) => renderToken(token, `${track.track}-${measure.globalIndex}-${index}`))}
                                </div>
                              </div>
                            ))}
                          </div>,
                        ];
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StaffScoreMetadata({ score }: { score: NormalizedScore }) {
  const title = score.ast.headers.title?.value ?? "Drum Notation";
  const subtitle = score.ast.headers.subtitle?.value;
  const composer = score.ast.headers.composer?.value;

  return (
    <header className="staff-score-metadata">
      <h2 className="staff-score-title">{title}</h2>
      {subtitle ? <p className="staff-score-subtitle">{subtitle}</p> : null}
      {composer ? <p className="staff-score-composer">{composer}</p> : null}
    </header>
  );
}

function StaffPreview({
  score,
  xml,
  paperWidth,
  onRendered,
}: {
  score: NormalizedScore;
  xml: string;
  paperWidth: boolean;
  onRendered: (markup: string | null, error: string | null) => void;
}) {
  const printableRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef({ top: 0, left: 0 });
  const [error, setError] = useState<string | null>(null);

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    scrollPosRef.current = {
      top: e.currentTarget.scrollTop,
      left: e.currentTarget.scrollLeft,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current || !shellRef.current) {
        return;
      }

      const targetTop = scrollPosRef.current.top;
      const targetLeft = scrollPosRef.current.left;

      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");

        if (cancelled) return;

        // 1. Create a hidden buffer container to render off-screen
        const buffer = document.createElement("div");
        const renderWidth = paperWidth ? staffPaperWidth : Math.max(containerRef.current.clientWidth, 320);
        buffer.style.width = `${renderWidth}px`;
        buffer.style.position = "absolute";
        buffer.style.visibility = "hidden";
        buffer.style.pointerEvents = "none";
        document.body.appendChild(buffer);

        const osmd = new OpenSheetMusicDisplay(buffer, {
          autoResize: false, // Manage resizing manually to avoid flickers
          drawTitle: false,
          drawingParameters: "compacttight",
          newSystemFromXML: true,
          drawTimeSignatures: true,
          drawMeasureNumbers: true,
          percussionOneLineCutoff: 0,
        });

        await osmd.load(xml);
        osmd.render();

        if (cancelled) {
          document.body.removeChild(buffer);
          return;
        }

        // 2. Atomic swap: Replace content and restore scroll in the same frame
        const markup = buffer.innerHTML;
        containerRef.current.innerHTML = markup;
        
        // Immediate scroll restoration
        shellRef.current.scrollTop = targetTop;
        shellRef.current.scrollLeft = targetLeft;

        document.body.removeChild(buffer);
        setError(null);
        onRendered(printableRef.current?.innerHTML ?? containerRef.current.innerHTML, null);

        // Double check scroll position after DOM settles
        requestAnimationFrame(() => {
          if (!cancelled && shellRef.current) {
            shellRef.current.scrollTop = targetTop;
            shellRef.current.scrollLeft = targetLeft;
          }
        });
      } catch (renderError) {
        if (!cancelled) {
          const message = renderError instanceof Error ? renderError.message : "Could not render staff preview.";
          setError(message);
          onRendered(null, message);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [paperWidth, xml]);

  return (
    <div className={`staff-preview-shell${paperWidth ? " paper-width" : ""}`} ref={shellRef} onScroll={handleScroll}>
      {error ? <div className="staff-error">{error}</div> : null}
      <div className={`staff-printable${paperWidth ? " paper-width" : ""}`} ref={printableRef}>
        <StaffScoreMetadata score={score} />
        <div className="staff-preview" ref={containerRef} />
      </div>
    </div>
  );
}

function MusicXmlPreview({ xml }: { xml: string }) {
  const formattedXml = useMemo(() => beautifyXml(xml), [xml]);
  const highlightedXml = useMemo(
    () => formattedXml.split("\n").map((line, index) => (
      <span className="xml-line" key={`${index}-${line}`}>
        {highlightXmlLine(line, index)}
        {"\n"}
      </span>
    )),
    [formattedXml],
  );

  return (
    <div className="xml-preview" aria-label="MusicXML preview">
      <pre>{highlightedXml}</pre>
    </div>
  );
}

export function App() {
  const [dsl, setDsl] = useState(() => localStorage.getItem("drum-notation-dsl") ?? seedDsl);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => parsePreviewMode(localStorage.getItem("drum-notation-preview-mode")));
  const [staffMarkup, setStaffMarkup] = useState<string | null>(null);
  const [staffRenderError, setStaffRenderError] = useState<string | null>(null);
  const [pendingPdfExport, setPendingPdfExport] = useState(false);
  const [hideVoice2Rests, setHideVoice2Rests] = useState(() => localStorage.getItem("drum-notation-hide-voice2-rests") === "true");
  const [staffPaperPreview, setStaffPaperPreview] = useState(() => localStorage.getItem("drum-notation-staff-paper-preview") === "true");
  
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem("drum-notation-editor-width");
    return saved ? parseInt(saved, 10) : 600;
  });
  const isResizingRef = useRef(false);

  const score = useMemo(() => buildNormalizedScore(dsl), [dsl]);
  const staffXml = useMemo(() => buildMusicXml(score, hideVoice2Rests), [hideVoice2Rests, score]);
  const canExport = score.errors.length === 0;

  useEffect(() => {
    localStorage.setItem("drum-notation-dsl", dsl);
  }, [dsl]);

  useEffect(() => {
    localStorage.setItem("drum-notation-preview-mode", previewMode);
  }, [previewMode]);

  useEffect(() => {
    localStorage.setItem("drum-notation-hide-voice2-rests", String(hideVoice2Rests));
  }, [hideVoice2Rests]);

  useEffect(() => {
    localStorage.setItem("drum-notation-staff-paper-preview", String(staffPaperPreview));
  }, [staffPaperPreview]);

  useEffect(() => {
    localStorage.setItem("drum-notation-editor-width", String(editorWidth));
  }, [editorWidth]);

  useEffect(() => {
    if (pendingPdfExport && staffRenderError) {
      window.alert(`Could not render PDF: ${staffRenderError}`);
      setPendingPdfExport(false);
      return;
    }

    if (!pendingPdfExport || !staffMarkup || staffRenderError) {
      return;
    }

    let cancelled = false;

    async function exportPdf() {
      try {
        await downloadStaffPdf(staffMarkup!, `${safeExportBasename(score.ast.headers.title?.value)}.pdf`);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not export PDF.";
          window.alert(message);
        }
      } finally {
        if (!cancelled) {
          setPendingPdfExport(false);
        }
      }
    }

    void exportPdf();

    return () => {
      cancelled = true;
    };
  }, [pendingPdfExport, score.ast.headers.title?.value, staffMarkup, staffRenderError]);

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
    downloadTextFile(`${safeExportBasename(score.ast.headers.title?.value)}.musicxml`, staffXml, "application/vnd.recordare.musicxml+xml");
  }

  function handlePdfExport() {
    if (!canExport) {
      return;
    }

    setStaffMarkup(null);
    setStaffRenderError(null);
    if (!staffPaperPreview) {
      setStaffPaperPreview(true);
    }
    if (previewMode !== "staff") {
      setPreviewMode("staff");
    }
    setPendingPdfExport(true);
  }

  function handleStaffPaperPreviewChange(value: boolean) {
    setStaffMarkup(null);
    setStaffRenderError(null);
    setStaffPaperPreview(value);
  }

  const handleStaffRendered = useCallback((markup: string | null, error: string | null) => {
    setStaffMarkup(markup);
    setStaffRenderError(error);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-branding">
          <h1>Drum Notation</h1>
          <p>Text-first notation</p>
        </div>
        <div className="header-actions">
          <button className="export-button" disabled={!canExport} onClick={handleMusicXmlExport} type="button">
            Export MusicXML
          </button>
          <button className="export-button primary" disabled={!canExport || pendingPdfExport} onClick={handlePdfExport} type="button">
            {pendingPdfExport ? "Exporting PDF" : "Export PDF"}
          </button>
        </div>
      </header>
      
      <section className="workspace">
        <section className="pane editor-pane" style={{ width: editorWidth }}>
          <header className="pane-header">
            <span className="pane-title">Editor</span>
          </header>
          <DslEditor value={dsl} onChange={setDsl} />
        </section>

        <div className="resizer" onMouseDown={handleMouseDown} />

        <section className="pane preview-pane" aria-label="Preview">
          <header className="pane-header">
            <span className="pane-title">Preview</span>
            <div className="preview-header-actions">
              <label className="preview-setting">
                <input
                  type="checkbox"
                  checked={hideVoice2Rests}
                  onChange={(e) => setHideVoice2Rests(e.target.checked)}
                />
                Hide V2 Rests
              </label>
              <label className="preview-setting">
                <input
                  type="checkbox"
                  checked={staffPaperPreview}
                  onChange={(e) => handleStaffPaperPreviewChange(e.target.checked)}
                />
                Paper Width
              </label>
              <div className="preview-tabs" role="tablist">
                <button
                  className={`preview-tab${previewMode === "grid" ? " active" : ""}`}
                  onClick={() => setPreviewMode("grid")}
                  type="button"
                >
                  Grid
                </button>
                <button
                  className={`preview-tab${previewMode === "staff" ? " active" : ""}`}
                  onClick={() => setPreviewMode("staff")}
                  type="button"
                >
                  Staff
                </button>
                <button
                  className={`preview-tab${previewMode === "xml" ? " active" : ""}`}
                  onClick={() => setPreviewMode("xml")}
                  type="button"
                >
                  XML
                </button>
              </div>
            </div>
          </header>
          {previewMode === "grid" ? (
            <Preview score={score} />
          ) : previewMode === "staff" ? (
            <StaffPreview
              score={score}
              xml={staffXml}
              paperWidth={staffPaperPreview}
              onRendered={handleStaffRendered}
            />
          ) : (
            <MusicXmlPreview xml={staffXml} />
          )}
        </section>
      </section>

      <footer className="status-bar">
        <div className="status-left">
          {score.errors.length > 0 ? (
            <span className="status-error">{score.errors.length} diagnostic issue{score.errors.length === 1 ? "" : "s"} found</span>
          ) : (
            <span className="status-success">✓ DSL Valid</span>
          )}
        </div>
        <div className="status-right">
          {score.ast.paragraphs.length} line{score.ast.paragraphs.length === 1 ? "" : "s"} • {score.ast.repeatSpans.length} repeat{score.ast.repeatSpans.length === 1 ? "" : "s"}
        </div>
      </footer>

      {score.errors.length > 0 && (
        <div className="error-list">
          {score.errors.map((error, index) => (
            <div className="error-item" key={`${error.line}-${error.column}-${index}`}>
              <span className="error-loc">[{error.line}:{error.column}]</span>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
