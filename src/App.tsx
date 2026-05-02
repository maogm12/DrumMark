import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type UIEvent } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { PDFDocument as PDFLibDocument } from "pdf-lib";
import { buildMusicXml, buildNormalizedScore, type ParseError } from "./dsl";
import { type NormalizedScore } from "./dsl";
import { renderScorePagesToSvgs, type VexflowRenderOptions, DEFAULT_RENDER_OPTIONS } from "./vexflow";
import { drumMarkEditorTheme, drumMarkLanguage, drumMarkSyntaxHighlighting } from "./drummark";

const legacySeedDsl = `tempo 96
time 4/4
divisions 16

HH |: x - x - o - x - | x - x:close - X - x - :|
SD |  - - d:cross - d - | D:rim - [2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC |  - - x:bell - - - - - | - - - - x - - - |
ST |  [2: R L R] - - -     | R - L - R - L - |`;

const seedDsl = `title DrumMark Spec Tour
subtitle Coverage Demo
composer OpenAI Codex
tempo 112
time 4/4
divisions 8
grouping 1+1+1+1

|: x+s p - - RC{d:bell d:choke} SD:d:rim - :|
HH | x:open - x:half-open - x:close - X - |
SD | d:cross - g - d:flam - d:drag - |
BD | b - b2 - b:roll - B:dead - |
HF | - - p:close - - - p - |
T1 | [1: d d d] - - - - - - - |
ST | R - L - R - L - |

| @segno C - RC2:d:bell - SPL - CHN:d:choke - | @fine % |1. C2 - CB - WB - CL - | @to-coda --2-- |.

| t4 - r2 - c2 - cl - *2 | %% |`;

type PagePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const pdfPageWidth = 612;
const pdfPageHeight = 792;
const pdfMargin = 0; // Padding is already handled inside the SVG renderer

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

function parseSvgSize(svgMarkup: string) {
  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const svg = doc.documentElement;
  const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  if (viewBox && viewBox.length === 4) {
    const v2 = viewBox[2];
    const v3 = viewBox[3];
    if (v2 !== undefined && v3 !== undefined && Number.isFinite(v2) && Number.isFinite(v3)) {
      return { width: v2, height: v3 };
    }
  }

  const parseLength = (value: string | null) => {
    if (!value) {
      return 0;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    width: parseLength(svg.getAttribute("width")) || 900,
    height: parseLength(svg.getAttribute("height")) || 900,
  };
}

async function svgToPngBytes(svgMarkup: string, scale = 2) {
  const { width, height } = parseSvgSize(svgMarkup);
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not rasterize staff SVG."));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create PDF image canvas.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Could not encode staff image."));
        }
      }, "image/png");
    });

    return {
      bytes: await pngBlob.arrayBuffer(),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function xmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmpDate(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildXmpMetadata({
  title,
  author,
  composer,
  subject,
  keywords,
  createdAt,
}: {
  title: string;
  author: string;
  composer?: string;
  subject: string;
  keywords: string[];
  createdAt: Date;
}) {
  const keywordText = keywords.join(", ");
  const date = xmpDate(createdAt);

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:music="https://drum-notation.local/ns/1.0/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${xmlText(title)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${xmlText(author)}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${xmlText(subject)}</rdf:li>
        </rdf:Alt>
      </dc:description>
      <pdf:Keywords>${xmlText(keywordText)}</pdf:Keywords>
      <xmp:CreatorTool>Drum Notation</xmp:CreatorTool>
      <xmp:CreateDate>${date}</xmp:CreateDate>
      <xmp:ModifyDate>${date}</xmp:ModifyDate>
      <music:Composer>${xmlText(composer ?? author)}</music:Composer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function applyPdfMetadata(
  pdf: PDFLibDocument,
  core: Pick<typeof import("pdf-lib"), "PDFHexString" | "PDFName">,
  metadata: {
    title: string;
    author: string;
    composer?: string;
    subject: string;
    keywords: string[];
    createdAt: Date;
  },
) {
  const { PDFHexString, PDFName } = core;

  pdf.setTitle(metadata.title, { showInWindowTitleBar: true });
  pdf.setAuthor(metadata.author);
  pdf.setSubject(metadata.subject);
  pdf.setKeywords(metadata.keywords);
  pdf.setCreationDate(metadata.createdAt);
  pdf.setModificationDate(metadata.createdAt);
  pdf.setCreator("Drum Notation");
  pdf.setProducer("Drum Notation");

  const infoDict = (pdf as unknown as { getInfoDict: () => { set: (key: unknown, value: unknown) => void } }).getInfoDict();
  infoDict.set(PDFName.of("Composer"), PDFHexString.fromText(metadata.composer ?? metadata.author));

  const xmp = buildXmpMetadata(metadata);
  const metadataStream = pdf.context.stream(xmp, {
    Type: "Metadata",
    Subtype: "XML",
  });
  const metadataRef = pdf.context.register(metadataStream);
  pdf.catalog.set(PDFName.of("Metadata"), metadataRef);
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

    if (attrs) {
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
    }

    nodes.push(
      <span className="xml-punctuation" key={`${lineIndex}-${match.index}-close`}>
        {close}
      </span>,
    );
  }

  return nodes;
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

function SettingsIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: value },
    });
  }, [value]);

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
  titleStaffGap,
  systemSpacing,
  stemLength,
  voltaGap,
  hideVoice2Rests,
  active,
}: {
  score: NormalizedScore | null;
  pagePadding: PagePadding;
  staffScale: number;
  headerHeight: number;
  titleStaffGap: number;
  systemSpacing: number;
  stemLength: number;
  voltaGap: number;
  hideVoice2Rests: boolean;
  active: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef({ top: 0, left: 0 });
  const [renderedMarkup, setRenderedMarkup] = useState("");
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

    const opts: VexflowRenderOptions = {
      mode: "preview",
      pagePadding,
      staffScale,
      pageWidth: pdfPageWidth,
      pageHeight: pdfPageHeight,
      headerHeight,
      titleStaffGap,
      systemSpacing,
      stemLength,
      voltaGap,
      hideVoice2Rests,
      tempoShiftX: DEFAULT_RENDER_OPTIONS.tempoShiftX,
      tempoShiftY: DEFAULT_RENDER_OPTIONS.tempoShiftY,
    };

    renderScorePagesToSvgs(score, opts)
      .then((pages) => {
        const markup = pages.map((svg, i) => `<section class="staff-preview-page" data-page="${i+1}">${svg}</section>`).join("");
        setRenderedMarkup(markup);

        if (shellRef.current) {
          shellRef.current.scrollTop = targetTop;
          shellRef.current.scrollLeft = targetLeft;
        }

        setError(null);
      })
      .catch((renderError) => {
        const msg = renderError instanceof Error ? renderError.message : String(renderError);
        console.error("VexFlow render error:", renderError);
        setError(msg || "Could not render staff preview.");
      });
  }, [score, systemSpacing, stemLength, voltaGap, titleStaffGap, headerHeight, active, hideVoice2Rests, pagePadding, staffScale]);

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
      <div className="staff-printable-frame">
        <div className="staff-printable">
          <div className="staff-preview page-view" dangerouslySetInnerHTML={{ __html: renderedMarkup }} />
        </div>
      </div>
    </div>
  );
});

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

function renderPdfPageSvgs(
  score: NormalizedScore,
  layout: {
    pagePadding: PagePadding;
    staffScale: number;
    headerHeight: number;
    titleStaffGap: number;
    systemSpacing: number;
    stemLength: number;
    voltaGap: number;
    hideVoice2Rests: boolean;
  },
) {
  const opts: VexflowRenderOptions = {
    mode: "pdf",
    pagePadding: layout.pagePadding,
    pageWidth: pdfPageWidth,
    pageHeight: pdfPageHeight,
    staffScale: layout.staffScale,
    headerHeight: layout.headerHeight,
    titleStaffGap: layout.titleStaffGap,
    systemSpacing: layout.systemSpacing,
    stemLength: layout.stemLength,
    voltaGap: layout.voltaGap,
    hideVoice2Rests: layout.hideVoice2Rests,
    tempoShiftX: DEFAULT_RENDER_OPTIONS.tempoShiftX,
  };

  return renderScorePagesToSvgs(score, opts);
}

async function buildPdf(
  score: NormalizedScore,
  _xml: string,
  layout: {
    pagePadding: PagePadding;
    staffScale: number;
    headerHeight: number;
    titleStaffGap: number;
    systemSpacing: number;
    stemLength: number;
    voltaGap: number;
    hideVoice2Rests: boolean;
  },
) {
  const [{ PDFDocument, PDFHexString, PDFName }] = await Promise.all([import("pdf-lib")]);
  const title = score.ast.headers.title?.value ?? "Drum Notation";
  const subtitle = score.ast.headers.subtitle?.value;
  const composer = score.ast.headers.composer?.value;
  const author = composer ?? "Drum Notation";
  const subject = subtitle ? `Drum notation - ${subtitle}` : "Drum notation";
  const keywords = ["drum notation", "drums", "musicxml", title, author];
  const createdAt = new Date();
  const pageSvgs = await renderPdfPageSvgs(score, layout);

  if (pageSvgs.length === 0) {
    throw new Error("Could not render staff pages for PDF.");
  }

  const pdf = await PDFDocument.create();
  applyPdfMetadata(pdf, { PDFHexString, PDFName }, { title, author, composer, subject, keywords, createdAt });

  for (const svg of pageSvgs) {
    const page = pdf.addPage([pdfPageWidth, pdfPageHeight]);
    const imageData = await svgToPngBytes(svg);
    const image = await pdf.embedPng(imageData.bytes);
    const contentWidth = pdfPageWidth - pdfMargin * 2;
    const contentHeight = pdfPageHeight - (pdfMargin * 2);
    
    const iw = imageData.width;
    const ih = imageData.height;
    const imageScale = Math.min(contentWidth / iw, contentHeight / ih);
    const imageWidth = iw * imageScale;
    const imageHeight = ih * imageScale;
    const imageY = pdfPageHeight - pdfMargin - imageHeight;

    page.drawImage(image, {
      x: (pdfPageWidth - imageWidth) / 2,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    });
  }

  return await pdf.save();
}

type MainTab = "editor" | "page" | "xml";

interface AppSettings {
  hideVoice2Rests: boolean;
  pagePadding: PagePadding;
  pageScale: number;
  staffScale: number;
  titleStaffGap: number;
  systemSpacing: number;
  stemLength: number;
  voltaGap: number;
  headerHeight: number;
  activeTab: MainTab;
}

const defaultSettings: AppSettings = {
  hideVoice2Rests: false,
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  pageScale: 0.8,
  staffScale: 0.75,
  titleStaffGap: 60,
  headerHeight: 50,
  systemSpacing: 30,
  stemLength: 31,
  voltaGap: -15,
  activeTab: "editor",
};

export function App() {
  const [dsl, setDsl] = useState(() => {
    const saved = localStorage.getItem("drum-notation-dsl");
    if (!saved || saved === legacySeedDsl) {
      return seedDsl;
    }
    return saved;
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("drum-notation-settings");
    if (!saved) return defaultSettings;
    try {
      const parsed = JSON.parse(saved);
      // Migration: Ensure pageScale is 1.0 if not defined or coming from old system
      if (parsed.pageScale === undefined || parsed.pageScale < 0.2 || parsed.pageScale > 5) {
        parsed.pageScale = 1.0;
      }
      if (parsed.stemLength === undefined || parsed.stemLength < 20 || parsed.stemLength > 40) {
        parsed.stemLength = 31;
      }
      if (parsed.voltaGap === undefined || parsed.voltaGap < -16 || parsed.voltaGap > 16) {
        parsed.voltaGap = -15;
      }
      if (parsed.headerHeight === undefined) {
        parsed.headerHeight = 50;
      }
      if (parsed.previewMode && !parsed.activeTab) {
        parsed.activeTab = parsed.previewMode === "xml" ? "xml" : "page";
      }
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  });

  const [pendingPdfExport, setPendingPdfExport] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(true);
  const [pageZoomMenuOpen, setPageZoomMenuOpen] = useState(false);
  
  const [showErrors, setShowErrors] = useState(false);
  
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem("drum-notation-editor-width");
    return saved ? parseInt(saved, 10) : 600;
  });
  const isResizingRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestHandledRequestIdRef = useRef(0);
  const [isScorePending, setIsScorePending] = useState(false);
  const [analysis, setAnalysis] = useState(() => {
    const initialScore = buildNormalizedScore(dsl);
    return {
      score: initialScore,
      xml: buildMusicXml(initialScore, settings.hideVoice2Rests),
    };
  });

  const score = analysis.score;
  const staffXml = analysis.xml;
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

    worker.onmessage = (event: MessageEvent<{ id: number; score: NormalizedScore; xml: string }>) => {
      const { id, score: nextScore, xml: nextXml } = event.data;
      if (id < latestHandledRequestIdRef.current) {
        return;
      }

      latestHandledRequestIdRef.current = id;
      setAnalysis({ score: nextScore, xml: nextXml });
      setIsScorePending(id !== requestIdRef.current);
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
      id: nextId,
      dsl: debouncedAnalysisInput.dsl,
      hideVoice2Rests: debouncedAnalysisInput.hideVoice2Rests,
    });
  }, [debouncedAnalysisInput]);

  useEffect(() => {
    localStorage.setItem("drum-notation-dsl", dsl);
  }, [dsl]);

  useEffect(() => {
    localStorage.setItem("drum-notation-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.activeTab !== "page" || Math.abs(settings.pageScale - 1) < 0.001) {
      setPageZoomMenuOpen(false);
    }
  }, [settings.pageScale, settings.activeTab]);

  useEffect(() => {
    localStorage.setItem("drum-notation-editor-width", String(editorWidth));
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
    downloadTextFile(`${safeExportBasename(score.ast.headers.title?.value)}.musicxml`, staffXml, "application/vnd.recordare.musicxml+xml");
  }

  async function handlePdfExport() {
    if (!canExport) return;
    setPendingPdfExport(true);
    try {
      const pdfBytes = await buildPdf(score, staffXml, {
        pagePadding: settings.pagePadding,
        staffScale: settings.staffScale,
        headerHeight: settings.headerHeight,
        titleStaffGap: settings.titleStaffGap,
        systemSpacing: settings.systemSpacing,
        stemLength: settings.stemLength,
        voltaGap: settings.voltaGap,
        hideVoice2Rests: settings.hideVoice2Rests,
      });
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      downloadBlob(`${safeExportBasename(score.ast.headers.title?.value)}.pdf`, new Blob([pdfBuffer], { type: "application/pdf" }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not export PDF.");
    } finally {
      setPendingPdfExport(false);
    }
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
            <h1>Drum Notation</h1>
            <p>Text-first notation</p>
          </div>
        </div>
        <div className="header-actions">
          <a className="export-button" href="docs.html">Docs</a>
          <button className="export-button" disabled={!canExport} onClick={handleMusicXmlExport} type="button">Export MusicXML</button>
          <button className="export-button primary" disabled={!canExport || pendingPdfExport} onClick={handlePdfExport} type="button">
            {pendingPdfExport ? "Exporting PDF..." : "Export PDF"}
          </button>
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
              <button className={`settings-toggle${settingsVisible ? " active" : ""}`} onClick={() => setSettingsVisible(!settingsVisible)} type="button" title="Toggle Settings"><SettingsIcon /></button>
            </div>
          </header>
          
          <div className="preview-container">
            <div className="preview-content">
              <div className={`preview-surface${settings.activeTab === "page" ? " active" : ""}`} aria-hidden={settings.activeTab !== "page"}>
                <div className="surface-toolbar page-surface-toolbar">
                  <div className="page-zoom-menu">
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
                </div>
                <div className="page-surface-body" ref={pageSurfaceBodyRef}>
                  {settings.activeTab === "page" ? (
                    <PagePreview
                      score={hasRenderableScore ? score : null}
                      pagePadding={settings.pagePadding}
                      pageScale={settings.pageScale}
                      staffScale={settings.staffScale}
                      headerHeight={settings.headerHeight}
                      titleStaffGap={settings.titleStaffGap}
                      systemSpacing={settings.systemSpacing}
                      stemLength={settings.stemLength}
                      voltaGap={settings.voltaGap}
                      hideVoice2Rests={settings.hideVoice2Rests}
                      active={true}
                    />
                  ) : null}
                </div>
              </div>
              <div className={`preview-surface${settings.activeTab === "xml" ? " active" : ""}`} aria-hidden={settings.activeTab !== "xml"}>
                {settings.activeTab === "xml" ? <MusicXmlPreview xml={staffXml} /> : null}
              </div>
            </div>

            <aside className={`settings-panel${settingsVisible ? " active" : ""}`}>
              <div className="settings-section">
                <h3 className="settings-section-title">Score View</h3>
                <label className="setting-row toggle">
                  <span>Hide Voice 2 Rests</span>
                  <div className="toggle-switch">
                    <input type="checkbox" checked={settings.hideVoice2Rests} onChange={(e) => updateSetting("hideVoice2Rests", e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
                  <div className="settings-section">
                    <h3 className="settings-section-title">Page Layout</h3>
                    <div className="setting-row">
                      <div className="setting-label"><span>Staff Scale</span><span className="setting-value">{(settings.staffScale * 100).toFixed(0)}%</span></div>
                      <input type="range" min="0.3" max="1.5" step="0.05" value={settings.staffScale} onChange={(e) => updateSetting("staffScale", parseFloat(e.target.value))} />
                    </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>System Spacing (pt)</span><span className="setting-value">{settings.systemSpacing.toFixed(0)}</span></div>
                    <input type="range" min="0" max="100" step="1" value={settings.systemSpacing} onChange={(e) => updateSetting("systemSpacing", parseFloat(e.target.value))} />
                  </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>Stem Length (pt)</span><span className="setting-value">{settings.stemLength}</span></div>
                    <input type="range" min="15" max="50" step="1" value={settings.stemLength} onChange={(e) => updateSetting("stemLength", parseInt(e.target.value, 10))} />
                  </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>Volta Gap (pt)</span><span className="setting-value">{settings.voltaGap}</span></div>
                    <input type="range" min="-20" max="20" step="1" value={settings.voltaGap} onChange={(e) => updateSetting("voltaGap", parseInt(e.target.value, 10))} />
                  </div>
                  <div className="padding-grid-container">
                    <span className="setting-label-small">Margins (pt)</span>
                    <div className="padding-grid">
                      {([["Top", "top", 800], ["Right", "right", 400], ["Bottom", "bottom", 800], ["Left", "left", 400]] as const).map(([label, key, limit]) => (
                        <div className="padding-input" key={key}>
                          <span>{label}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max={limit}
                            value={settings.pagePadding[key]}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              updatePagePadding(key, isNaN(val) ? 0 : Math.max(0, Math.min(val, limit)));
                            }}
                          />
                        </div>
                      ))}                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3 className="settings-section-title">Header Spacing</h3>
                  <div className="setting-row">
                    <div className="setting-label"><span>Header Height (pt)</span><span className="setting-value">{settings.headerHeight.toFixed(0)}</span></div>
                    <input type="range" min="10" max="300" step="1" value={settings.headerHeight} onChange={(e) => updateSetting("headerHeight", parseFloat(e.target.value))} />
                  </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>Header to Staff (pt)</span><span className="setting-value">{settings.titleStaffGap.toFixed(0)}</span></div>
                    <input type="range" min="0" max="100" step="1" value={settings.titleStaffGap} onChange={(e) => updateSetting("titleStaffGap", parseFloat(e.target.value))} />
                  </div>
                </div>
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
