import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    let extractedText = "";

    // ── PDF ──
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      extractedText = data.text;
    }
    // ── Word DOCX ──
    else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }
    // ── Plain text ──
    else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      extractedText = buffer.toString("utf-8");
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
      text: extractedText.slice(0, 15000), // cap at 15K chars
      fileName: file.name,
      fileType,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Extraction failed: ${err.message}` },
      { status: 500 }
    );
  }
}
