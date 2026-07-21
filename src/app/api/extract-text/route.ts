import { NextRequest, NextResponse } from "next/server";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

import path from "path";

// OCR is optional — requires canvas + tesseract.js (heavy, ~180MB).
// Only installed in environments that need scanned-PDF support.
let tesseractWorker: any = null;

async function getWorker() {
  if (tesseractWorker) return tesseractWorker;
  try {
    const Tesseract = await import("tesseract.js");
    const langPath = path.join(process.cwd(), "public", "tessdata");
    tesseractWorker = await Tesseract.createWorker("eng", 1, { langPath });
    return tesseractWorker;
  } catch {
    return null;
  }
}

/**
 * Extract text from PDF pages using pdfjs text layer.
 * Returns { text, pageCount }.
 */
async function extractPdfText(
  uint8Array: Uint8Array,
  startPage: number,
  endPage: number
): Promise<{ text: string; pageCount: number; scanned: boolean }> {
  const pdf = await getDocumentProxy(uint8Array);
  const totalPages = pdf.numPages;
  const start = Math.max(1, startPage || 1);
  const end = Math.min(totalPages, endPage || totalPages);

  const pageTexts: string[] = [];
  for (let i = start; i <= end; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item: any) => item.str != null)
      .map((item: any) => item.str + (item.hasEOL ? "\n" : ""))
      .join("");
    pageTexts.push(text);
  }

  const fullText = pageTexts.join("\n\n");
  // Heuristic: if very little text extracted, likely scanned/image PDF
  const scanned = fullText.trim().length < Math.max(100, (end - start + 1) * 50);

  return { text: fullText, pageCount: end - start + 1, scanned };
}

/**
 * Fallback OCR for scanned PDFs.
 * Requires canvas + tesseract.js. If not installed, returns empty text.
 * Limited to max 10 pages to avoid timeouts.
 */
async function ocrPdfPages(
  uint8Array: Uint8Array,
  startPage: number,
  endPage: number,
  maxPages = 10
): Promise<{ text: string; pagesOcr: number }> {
  let canvas: any;
  try {
    canvas = await import("canvas");
  } catch {
    return { text: "", pagesOcr: 0 };
  }

  const worker = await getWorker();
  if (!worker) return { text: "", pagesOcr: 0 };

  const pdf = await getDocumentProxy(uint8Array, { canvasImport: () => canvas } as any);
  const totalPages = pdf.numPages;
  const start = Math.max(1, startPage || 1);
  const end = Math.min(totalPages, endPage || totalPages, start + maxPages - 1);

  const pageTexts: string[] = [];

  for (let i = start; i <= end; i++) {
    const imgBuf = await renderPageAsImage(pdf, i, {
      canvasImport: () => canvas,
      scale: 2,
    } as any);
    const buffer = Buffer.from(imgBuf);
    const result = await worker.recognize(buffer);
    pageTexts.push(`--- Page ${i} ---\n${result.data.text}`);
  }

  return { text: pageTexts.join("\n\n"), pagesOcr: end - start + 1 };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const startPageRaw = formData.get("startPage") as string | null;
    const endPageRaw = formData.get("endPage") as string | null;

    const startPage = startPageRaw ? parseInt(startPageRaw, 10) : 0;
    const endPage = endPageRaw ? parseInt(endPageRaw, 10) : 0;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    let extractedText = "";
    let isScanned = false;
    let ocrUsed = false;
    let pageInfo = "";

    // ── PDF ──
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      const uint8Array = new Uint8Array(arrayBuffer);

      // 1. Try text-layer extraction
      const textResult = await extractPdfText(uint8Array, startPage, endPage);
      extractedText = textResult.text;
      isScanned = textResult.scanned;
      pageInfo = `Pages ${startPage || 1}-${endPage || textResult.pageCount}`;

      // 2. If scanned / image PDF → OCR fallback
      if (isScanned) {
        try {
          const ocrResult = await ocrPdfPages(uint8Array, startPage, endPage);
          if (ocrResult.text.trim().length > 100) {
            extractedText = ocrResult.text;
            ocrUsed = true;
            isScanned = false; // we recovered it
          }
        } catch (ocrErr: any) {
          console.error("[extract-text] OCR failed:", ocrErr.message);
          // Keep scanned flag, text stays as-is (likely empty)
        }
      }
    }
    // ── Word DOCX ──
    else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      extractedText = result.value;
    }
    // ── Plain text ──
    else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      extractedText = new TextDecoder().decode(arrayBuffer);
    }
    // ── Images (basic — just filename for now, OCR later) ──
    else if (fileType.startsWith("image/")) {
      extractedText = `[Image uploaded: ${file.name}]\n\nPlease enter the text content manually in the preview box below, or type/paste the source material you want the lesson based on.`;
    }
    else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, TXT, or image." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      fileName: file.name,
      fileType,
      isScanned: fileType === "application/pdf" || fileName.endsWith(".pdf") ? isScanned : undefined,
      ocrUsed: fileType === "application/pdf" || fileName.endsWith(".pdf") ? ocrUsed : undefined,
      pageInfo: fileType === "application/pdf" || fileName.endsWith(".pdf") ? pageInfo : undefined,
    });
  } catch (err: any) {
    console.error("[extract-text] Error:", err);
    return NextResponse.json(
      { error: `Extraction failed: ${err.message}` },
      { status: 500 }
    );
  }
}
