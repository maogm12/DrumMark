import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawPdfHeaderText } from "./pdfHeader";

function pdftotextPath() {
  try {
    return execFileSync("which", ["pdftotext"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

describe("drawPdfHeaderText", () => {
  it("writes visible, extractable title text into the PDF", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const latinRegular = await pdf.embedFont(StandardFonts.Helvetica);
    const latinBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    drawPdfHeaderText({
      page,
      title: "Drum Notation",
      subtitle: "Verse A",
      composer: "G. Mao",
      pageWidth: 612,
      margin: 36,
      fonts: {
        regular: latinRegular,
        bold: latinBold,
        helvetica: latinRegular,
      },
    });

    const bytes = await pdf.save();
    const path = join(mkdtempSync(join(tmpdir(), "drum-notation-pdf-")), "header.pdf");
    writeFileSync(path, bytes);

    const tool = pdftotextPath();
    if (!tool) {
      const raw = readFileSync(path, "latin1");
      expect(raw).toContain("/Helvetica");
      return;
    }

    const text = execFileSync(tool, [path, "-"], { encoding: "utf8" });
    expect(text).toContain("Drum Notation");
    expect(text).toContain("Verse A");
    expect(text).toContain("G. Mao");
  });
});
