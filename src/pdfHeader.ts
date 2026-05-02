import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfHeaderFonts = {
  regular: PDFFont;
  bold: PDFFont;
  helvetica: PDFFont;
};

export function drawPdfHeaderText({
  page,
  title,
  subtitle,
  composer,
  pageWidth,
  margin,
  fonts,
}: {
  page: PDFPage;
  title: string;
  subtitle?: string;
  composer?: string;
  pageWidth: number;
  margin: number;
  fonts: PdfHeaderFonts;
}) {
  // Position header text at the top of the page.
  const rows = [
    { text: title, y: 710, size: 24, font: fonts.bold, align: "center" as const },
    subtitle
      ? { text: subtitle, y: 680, size: 14, font: fonts.regular, align: "center" as const }
      : undefined,
    composer
      ? { text: composer, y: 680, size: 12, font: fonts.regular, align: "right" as const }
      : undefined,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));

  for (const row of rows) {
    try {
      const width = row.font.widthOfTextAtSize(row.text, row.size);
      const x = row.align === "right" ? pageWidth - margin - width : (pageWidth - width) / 2;

      page.drawText(row.text, {

        x,
        y: row.y,
        size: row.size,
        font: row.font,
        color: rgb(0, 0, 0),
      });
    } catch (e) {
      console.error(`[PDF-HEADER] Failed to draw header row: ${row.text}`, e);
      // Fallback to Helvetica
      try {
        const fallbackText = row.text.replace(/[^\x00-\x7F]/g, "?");
        const width = fonts.helvetica.widthOfTextAtSize(fallbackText, row.size);
        const x = row.align === "right" ? pageWidth - margin - width : (pageWidth - width) / 2;
        page.drawText(fallbackText, {
          x,
          y: row.y,
          size: row.size,
          font: fonts.helvetica,
          color: rgb(0, 0, 0),
        });
      } catch (fallbackError) {
        console.error("[PDF-HEADER] Fallback drawing also failed", fallbackError);
      }
    }
  }
}
