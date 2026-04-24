import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type UIEvent } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { PDFDocument as PDFLibDocument } from "pdf-lib";
import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { type NormalizedScore } from "./dsl";
import { drumDslEditorTheme, drumDslLanguage, drumDslSyntaxHighlighting } from "./dslLanguage";

const seedDsl = `tempo 96
time 4/4
divisions 16

HH |: x - x - o - x - | x - x:close - X - x - :|x3
SD |  - - d:cross - g - | D:rim - [2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC |  - - x:bell - - - - - | - - - - x - - - |
ST |  [2: R L R] - - -     | R - L - R - L - |`;

type PagePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
const osmdDefaultFontFamily = "\"Noto Sans SC\", \"PingFang SC\", \"Microsoft YaHei\", \"Helvetica Neue\", Arial, sans-serif";
const pdfPageWidth = 612;
const pdfPageHeight = 792;
const pdfMargin = 36;
const pdfOsmdHeaderReservePx = 150;

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

function getStaffSvgMarkup(markup: string) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  const serializer = new XMLSerializer();
  return Array.from(host.querySelectorAll("svg"))
    .filter((svg) => !svg.parentElement?.closest("svg"))
    .map((svg) => {
      if (!svg.getAttribute("xmlns")) {
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      return serializer.serializeToString(svg);
    });
}

function parseSvgSize(svgMarkup: string) {
  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const svg = doc.documentElement;
  const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    return { width: viewBox[2], height: viewBox[3] };
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

function configureOsmdRules(osmd: OpenSheetMusicDisplay, mode: "preview" | "pdf") {
  const rules = osmd.EngravingRules as OpenSheetMusicDisplay["EngravingRules"] & {
    RenderTitle?: boolean;
    RenderSubtitle?: boolean;
    RenderComposer?: boolean;
    SheetTitleHeight?: number;
    SheetSubtitleHeight?: number;
    SheetComposerHeight?: number;
    SheetMinimumDistanceBetweenTitleAndSubtitle?: number;
    TitleTopDistance?: number;
    TitleBottomDistance?: number;
  };

  rules.PageTopMargin = 0;
  rules.PageBottomMargin = 5;
  rules.PageLeftMargin = 2;
  rules.PageRightMargin = 2;
  rules.SystemLeftMargin = 0;
  rules.SystemRightMargin = 0;
  rules.RenderTitle = true;
  rules.RenderSubtitle = true;
  rules.RenderComposer = true;
  rules.SheetTitleHeight = 3.4;
  rules.SheetSubtitleHeight = 2.1;
  rules.SheetComposerHeight = 1.8;
  rules.SheetMinimumDistanceBetweenTitleAndSubtitle = 1.2;
  rules.TitleTopDistance = 3.6;
  rules.TitleBottomDistance = 2.4;

  if (mode === "pdf") {
    rules.PageTopMargin = pdfOsmdHeaderReservePx;
    rules.MinimumDistanceBetweenSystems = 1.0;
    rules.MinSkyBottomDistBetweenSystems = 1.0;
    rules.StaffDistance = 4;
    rules.BetweenStaffDistance = 2;
    rules.SheetMaximumWidth = 32767;
  }
}

function readMusicXmlCredit(xml: string, type: "title" | "subtitle" | "composer") {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    return "";
  }

  const credits = Array.from(document.querySelectorAll("credit"));
  for (const credit of credits) {
    const page = credit.getAttribute("page");
    if (page !== null && page !== "1") {
      continue;
    }

    const creditType = credit.querySelector("credit-type")?.textContent?.trim().toLowerCase();
    if (creditType !== type) {
      continue;
    }

    const words = Array.from(credit.querySelectorAll("credit-words"))
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
    if (words) {
      return words;
    }
  }

  if (type === "title") {
    return document.querySelector("work > work-title")?.textContent?.trim() ?? "";
  }

  if (type === "composer") {
    return document.querySelector('identification > creator[type="composer"]')?.textContent?.trim() ?? "";
  }

  return "";
}

function applyOsmdHeaderMetadata(osmd: OpenSheetMusicDisplay, xml: string) {
  const sheet = osmd.Sheet as OpenSheetMusicDisplay["Sheet"] & {
    TitleString?: string;
    SubtitleString?: string;
    ComposerString?: string;
  };

  const title = readMusicXmlCredit(xml, "title");
  const subtitle = readMusicXmlCredit(xml, "subtitle");
  const composer = readMusicXmlCredit(xml, "composer");

  if (title) sheet.TitleString = title;
  if (subtitle) sheet.SubtitleString = subtitle;
  if (composer) sheet.ComposerString = composer;
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

function SettingsIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DslEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
          drumDslLanguage,
          drumDslSyntaxHighlighting,
          drumDslEditorTheme,
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

function StaffPreview({
  xml,
  pagePadding,
  pageScale,
  titleTopPadding,
  titleSubtitleGap,
  titleStaffGap,
  systemSpacing,
  active,
  onRendered,
}: {
  xml: string;
  pagePadding: PagePadding;
  pageScale: number;
  titleTopPadding: number;
  titleSubtitleGap: number;
  titleStaffGap: number;
  systemSpacing: number;
  active: boolean;
  onRendered: (markup: string | null, error: string | null) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef({ top: 0, left: 0 });
  const [error, setError] = useState<string | null>(null);
  const [renderedMarkup, setRenderedMarkup] = useState("");

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    scrollPosRef.current = {
      top: e.currentTarget.scrollTop,
      left: e.currentTarget.scrollLeft,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!active) return;
      
      const targetTop = scrollPosRef.current.top;
      const targetLeft = scrollPosRef.current.left;

      try {
        if (cancelled) return;

        const buffer = document.createElement("div");
        buffer.style.width = "900px";
        buffer.style.position = "absolute";
        buffer.style.visibility = "hidden";
        buffer.style.pointerEvents = "none";
        document.body.appendChild(buffer);

        const osmd = new OpenSheetMusicDisplay(buffer, {
          autoResize: false,
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          defaultFontFamily: osmdDefaultFontFamily,
          drawingParameters: "compacttight",
          newSystemFromXML: true,
          pageFormat: "Letter_P",
          drawTimeSignatures: true,
          drawMeasureNumbers: true,
          percussionOneLineCutoff: 0,
        });
        osmd.setOptions({ defaultColorTitle: "#111111" });
        configureOsmdRules(osmd, "preview");
        osmd.EngravingRules.MinimumDistanceBetweenSystems = systemSpacing;
        osmd.EngravingRules.MinSkyBottomDistBetweenSystems = systemSpacing;
        osmd.EngravingRules.TitleTopDistance = titleTopPadding;
        osmd.EngravingRules.SheetMinimumDistanceBetweenTitleAndSubtitle = titleSubtitleGap;
        osmd.EngravingRules.TitleBottomDistance = titleStaffGap;

        await osmd.load(xml);
        applyOsmdHeaderMetadata(osmd, xml);
        osmd.render();

        if (cancelled) {
          document.body.removeChild(buffer);
          return;
        }

        const markup = getStaffSvgMarkup(buffer.innerHTML)
          .map((svg, pageIndex) => `<section class="staff-preview-page" data-page="${pageIndex + 1}">${svg}</section>`)
          .join("");
        setRenderedMarkup(markup);
        
        if (shellRef.current) {
          shellRef.current.scrollTop = targetTop;
          shellRef.current.scrollLeft = targetLeft;
        }

        document.body.removeChild(buffer);
        setError(null);
        onRendered(`<div class="staff-preview page-view">${markup}</div>`, null);
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Could not render staff preview.");
        }
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [systemSpacing, titleStaffGap, titleSubtitleGap, titleTopPadding, xml, active]);

  const printableStyle = {
    "--staff-zoom-width": `${pageScale * 100}%`,
    "--page-padding-top": `${pagePadding.top}px`,
    "--page-padding-right": `${pagePadding.right}px`,
    "--page-padding-bottom": `${pagePadding.bottom}px`,
    "--page-padding-left": `${pagePadding.left}px`,
  } as CSSProperties;

  return (
    <div className="staff-preview-shell" ref={shellRef} onScroll={handleScroll}>
      {error ? <div className="staff-error">{error}</div> : null}
      <div className="staff-printable-frame" style={printableStyle}>
        <div className="staff-printable">
          <div className="staff-preview page-view" dangerouslySetInnerHTML={{ __html: renderedMarkup }} />
        </div>
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

async function renderPdfPageSvgs(
  xml: string,
  layout?: {
    titleTopPadding?: number;
    titleSubtitleGap?: number;
    titleStaffGap?: number;
    systemSpacing?: number;
  },
) {
  const buffer = document.createElement("div");
  buffer.style.width = "900px";
  buffer.style.position = "absolute";
  buffer.style.visibility = "hidden";
  buffer.style.pointerEvents = "none";
  document.body.appendChild(buffer);

  try {
    const osmd = new OpenSheetMusicDisplay(buffer, {
      autoResize: false,
      drawComposer: true,
      drawSubtitle: true,
      drawTitle: true,
      defaultFontFamily: osmdDefaultFontFamily,
      drawingParameters: "compacttight",
      newSystemFromXML: true,
      pageFormat: "Letter_P",
      drawTimeSignatures: true,
      drawMeasureNumbers: true,
      percussionOneLineCutoff: 0,
    });
    configureOsmdRules(osmd, "pdf");
    if (layout?.systemSpacing !== undefined) {
      osmd.EngravingRules.MinimumDistanceBetweenSystems = layout.systemSpacing;
      osmd.EngravingRules.MinSkyBottomDistBetweenSystems = layout.systemSpacing;
    }
    if (layout?.titleTopPadding !== undefined) {
      osmd.EngravingRules.TitleTopDistance = layout.titleTopPadding;
    }
    if (layout?.titleSubtitleGap !== undefined) {
      osmd.EngravingRules.SheetMinimumDistanceBetweenTitleAndSubtitle = layout.titleSubtitleGap;
    }
    if (layout?.titleStaffGap !== undefined) {
      osmd.EngravingRules.TitleBottomDistance = layout.titleStaffGap;
    }

    await osmd.load(xml);
    applyOsmdHeaderMetadata(osmd, xml);
    osmd.render();
    return getStaffSvgMarkup(buffer.innerHTML);
  } finally {
    document.body.removeChild(buffer);
  }
}

async function buildPdf(
  score: NormalizedScore,
  xml: string,
  layout?: {
    titleTopPadding?: number;
    titleSubtitleGap?: number;
    titleStaffGap?: number;
    systemSpacing?: number;
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
  const pageSvgs = await renderPdfPageSvgs(xml, layout);

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
    const imageScale = Math.min(contentWidth / imageData.width, contentHeight / imageData.height);
    const imageWidth = imageData.width * imageScale;
    const imageHeight = imageData.height * imageScale;
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
  titleStaffGap: number;
  systemSpacing: number;
  titleTopPadding: number;
  titleSubtitleGap: number;
  activeTab: MainTab;
}

const defaultSettings: AppSettings = {
  hideVoice2Rests: false,
  pagePadding: { top: 24, right: 18, bottom: 24, left: 18 },
  pageScale: 1.0,
  titleStaffGap: 2.8,
  systemSpacing: 1.4,
  titleTopPadding: 3.6,
  titleSubtitleGap: 1.2,
  activeTab: "editor",
};

export function App() {
  const [dsl, setDsl] = useState(() => localStorage.getItem("drum-notation-dsl") ?? seedDsl);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("drum-notation-settings");
    if (!saved) return defaultSettings;
    try {
      const parsed = JSON.parse(saved);
      // Migration: Ensure pageScale is 1.0 if not defined or coming from old system
      if (parsed.pageScale === undefined || parsed.pageScale < 0.2 || parsed.pageScale > 5) {
        parsed.pageScale = 1.0;
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

  const score = useMemo(() => buildNormalizedScore(dsl), [dsl]);
  const staffXml = useMemo(() => buildMusicXml(score, settings.hideVoice2Rests), [settings.hideVoice2Rests, score]);
  const canExport = score.errors.length === 0;

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
        titleTopPadding: settings.titleTopPadding,
        titleSubtitleGap: settings.titleSubtitleGap,
        titleStaffGap: settings.titleStaffGap,
        systemSpacing: settings.systemSpacing,
      });
      const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      downloadBlob(`${safeExportBasename(score.ast.headers.title?.value)}.pdf`, new Blob([pdfBuffer], { type: "application/pdf" }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not export PDF.");
    } finally {
      setPendingPdfExport(false);
    }
  }

  const handleStaffRendered = useCallback((_markup: string | null, _error: string | null) => {}, []);
  const isPageZoomed = Math.abs(settings.pageScale - 1) > 0.001;
  const pageZoomPercent = Math.round(settings.pageScale * 100);

  function adjustPageScale(delta: number) {
    setSettings((prev) => ({
      ...prev,
      pageScale: Math.max(0.6, Math.min(3.0, Math.round((prev.pageScale + delta) * 100) / 100)),
    }));
  }

  function handlePageSurfaceWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    adjustPageScale(event.deltaY < 0 ? 0.1 : -0.1);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-branding">
          <h1>Drum Notation</h1>
          <p>Text-first notation</p>
        </div>
        <div className="header-actions">
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
          <DslEditor value={dsl} onChange={setDsl} />
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
                  {isPageZoomed ? (
                    <div className="page-zoom-menu">
                      <button aria-label="Zoom" className="surface-icon-button" onClick={() => setPageZoomMenuOpen((current) => !current)} type="button" title={`Zoom ${pageZoomPercent}%`}>
                        {settings.pageScale < 1 ? <SearchMinusIcon /> : <SearchPlusIcon />}
                      </button>
                      {pageZoomMenuOpen ? (
                        <div className="page-zoom-popover">
                          <div className="page-zoom-readout">{pageZoomPercent}%</div>
                          <div className="page-zoom-buttons">
                            <button className="page-zoom-action" onClick={() => adjustPageScale(-0.1)} type="button">-</button>
                            <button className="page-zoom-action" onClick={() => adjustPageScale(0.1)} type="button">+</button>
                            <button className="page-zoom-reset" onClick={() => { updateSetting("pageScale", 1.0); setPageZoomMenuOpen(false); }} type="button">Reset</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="page-surface-body" onWheel={handlePageSurfaceWheel}>
                  <StaffPreview
                    xml={staffXml}
                    pagePadding={settings.pagePadding}
                    pageScale={settings.pageScale}
                    titleTopPadding={settings.titleTopPadding}
                    titleSubtitleGap={settings.titleSubtitleGap}
                    titleStaffGap={settings.titleStaffGap}
                    systemSpacing={settings.systemSpacing}
                    active={settings.activeTab === "page"}
                    onRendered={handleStaffRendered}
                  />
                </div>
              </div>
              <div className={`preview-surface${settings.activeTab === "xml" ? " active" : ""}`} aria-hidden={settings.activeTab !== "xml"}>
                <MusicXmlPreview xml={staffXml} />
              </div>
            </div>

            {settingsVisible && (
              <aside className="settings-panel">
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
                    <div className="setting-label"><span>Page Zoom</span><span className="setting-value">{Math.round(settings.pageScale * 100)}%</span></div>
                    <input type="range" min="0.6" max="3.0" step="0.05" value={settings.pageScale} onChange={(e) => updateSetting("pageScale", parseFloat(e.target.value))} />
                  </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>System Spacing</span><span className="setting-value">{settings.systemSpacing.toFixed(1)}</span></div>
                    <input type="range" min="0.6" max="6" step="0.2" value={settings.systemSpacing} onChange={(e) => updateSetting("systemSpacing", parseFloat(e.target.value))} />
                  </div>
                  <div className="padding-grid-container">
                    <span className="setting-label-small">Margins (px)</span>
                    <div className="padding-grid">
                      {([["Top", "top"], ["Right", "right"], ["Bottom", "bottom"], ["Left", "left"]] as const).map(([label, key]) => (
                        <div className="padding-input" key={key}><span>{label}</span><input type="number" value={settings.pagePadding[key]} onChange={(e) => updatePagePadding(key, parseInt(e.target.value, 10) || 0)} /></div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3 className="settings-section-title">Header Spacing</h3>
                  <div className="setting-row">
                    <div className="setting-label"><span>Title Top</span><span className="setting-value">{settings.titleTopPadding.toFixed(1)}</span></div>
                    <input type="range" min="0" max="10" step="0.2" value={settings.titleTopPadding} onChange={(e) => updateSetting("titleTopPadding", parseFloat(e.target.value))} />
                  </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>Subtitle Gap</span><span className="setting-value">{settings.titleSubtitleGap.toFixed(1)}</span></div>
                    <input type="range" min="0" max="6" step="0.2" value={settings.titleSubtitleGap} onChange={(e) => updateSetting("titleSubtitleGap", parseFloat(e.target.value))} />
                  </div>
                  <div className="setting-row">
                    <div className="setting-label"><span>Header to Staff</span><span className="setting-value">{settings.titleStaffGap.toFixed(1)}</span></div>
                    <input type="range" min="1" max="8" step="0.2" value={settings.titleStaffGap} onChange={(e) => updateSetting("titleStaffGap", parseFloat(e.target.value))} />
                  </div>
                </div>
              </aside>
            )}
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
