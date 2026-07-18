import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType, Table, TableCell, TableRow, WidthType, BorderStyle } from "docx";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

function safeString(value: any): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join("\n");
  if (value !== null && value !== undefined) return String(value);
  return "";
}

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lesson_id } = body;
  if (!lesson_id) {
    return NextResponse.json({ error: "Missing lesson_id" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("generated_json, topic, class_name, status, metadata")
    .eq("id", lesson_id)
    .eq("user_id", user.id)
    .single();

  if (error || !lesson || lesson.status !== "complete") {
    return NextResponse.json({ error: "Lesson not found or not complete" }, { status: 404 });
  }

  const json = lesson.generated_json || {};
  const metadata = json.metadata || {};
  const slides = json.slides || [];
  const activities = json.activities || [];
  const plan = json.lesson_plan || {};
  const school = metadata.school_info || {};

  const children: Paragraph[] = [];

  // ── Header ──
  children.push(
    new Paragraph({
      text: `${school.name || "Your School"} — ${metadata.class_name || lesson.class_name || ""}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `Unit: ${metadata.unit || ""} — Day ${metadata.day_number || 1}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: metadata.topic || lesson.topic || "Untitled Lesson",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // ── Learning Objectives ──
  if (plan.learning_objectives?.length) {
    children.push(
      new Paragraph({ text: "Learning Objectives", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
    );
    for (const obj of plan.learning_objectives) {
      children.push(new Paragraph({ text: `• ${safeString(obj)}`, spacing: { after: 120 } }));
    }
  }

  // ── Materials Available ──
  if (metadata.materials_available?.length) {
    children.push(
      new Paragraph({ text: "Materials Available", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      new Paragraph({ text: metadata.materials_available.join(", "), spacing: { after: 200 } })
    );
  }

  // ── Timing Breakdown ──
  if (plan.duration_breakdown?.length) {
    children.push(
      new Paragraph({ text: "Timing Breakdown", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } })
    );
    for (const seg of plan.duration_breakdown) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${seg.segment} — `, bold: true }),
            new TextRun(`${seg.minutes} min: ${safeString(seg.description)}`),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  // ── Slide Deck Content ──
  if (slides.length) {
    children.push(
      new Paragraph({ text: "Slide Deck", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
    );
    for (const slide of slides) {
      const content = slide.content || {};
      children.push(
        new Paragraph({
          text: `Slide ${slide.slide_number}: ${(slide.slide_type || "").replace(/_/g, " ")}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      for (const [key, value] of Object.entries(content)) {
        if (!value) continue;
        const label = key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
        const text = Array.isArray(value) ? value.map((v, i: number) => `${i + 1}. ${safeString(v)}`).join("\n") : safeString(value);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${label}: `, bold: true }),
              new TextRun(text),
            ],
            spacing: { after: 100 },
          })
        );
      }
      if (slide.has_image && slide.image_search_query) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `[Image: ${slide.image_search_query}]`, italics: true })],
            spacing: { after: 100 },
          })
        );
      }
    }
  }

  // ── Activities ──
  if (activities.length) {
    children.push(
      new Paragraph({ text: "Activities", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
    );
    for (const act of activities) {
      children.push(
        new Paragraph({
          text: `${act.activity_id}: ${act.activity_name}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Type: ", bold: true }),
            new TextRun(act.activity_type || ""),
          ],
          spacing: { after: 80 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Duration: ", bold: true }),
            new TextRun(`${act.duration_min} minutes`),
          ],
          spacing: { after: 80 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Grouping: ", bold: true }),
            new TextRun((act.grouping || "").replace(/_/g, " ")),
          ],
          spacing: { after: 80 },
        })
      );
      if (act.materials?.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Materials: ", bold: true }),
              new TextRun(act.materials.join(", ")),
            ],
            spacing: { after: 80 },
          })
        );
      }
      if (act.instructions_student_facing) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Instructions (student-facing):\n", bold: true }),
              new TextRun(act.instructions_student_facing),
            ],
            spacing: { after: 120 },
          })
        );
      }
      if (act.deliverables?.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Deliverables: ", bold: true }),
              new TextRun(act.deliverables.map((d: any) => d.description).join("; ")),
            ],
            spacing: { after: 120 },
          })
        );
      }
    }
  }

  // ── Teacher Notes ──
  if (plan.teacher_notes) {
    children.push(
      new Paragraph({ text: "Teacher Notes", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
      new Paragraph({ text: safeString(plan.teacher_notes), spacing: { after: 200 } })
    );
  }

  // ── Differentiation ──
  if (plan.differentiation) {
    children.push(
      new Paragraph({ text: "Differentiation", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
    );
    if (plan.differentiation.remedial) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Remedial: ", bold: true }),
            new TextRun(safeString(plan.differentiation.remedial)),
          ],
          spacing: { after: 120 },
        })
      );
    }
    if (plan.differentiation.advanced) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Advanced: ", bold: true }),
            new TextRun(safeString(plan.differentiation.advanced)),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  // ── Answer Keys ──
  if (plan.answer_keys?.length) {
    children.push(
      new Paragraph({ text: "Answer Keys", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } })
    );
    for (const ak of plan.answer_keys) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${ak.activity_id}`, bold: true }),
          ],
          spacing: { after: 80 },
        }),
        new Paragraph({ text: safeString(ak.answers), spacing: { after: 200 } })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${(metadata.topic || lesson.topic || "lesson").replace(/[^a-zA-Z0-9\-_]/g, "_")}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
