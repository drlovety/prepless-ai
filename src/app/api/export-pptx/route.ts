import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BG_COLOR = "3C0F14";
const TEXT_COLOR = "F5F5F5";
const ACCENT_COLOR = "63666A";

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

function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b, Math.round(alpha * 255)];
}

function addTitleSlide(PptxGenJS: any, pres: any, metadata: any) {
  const slide = pres.addSlide();
  slide.background = { color: BG_COLOR };

  const school = metadata.school_info?.name || "Your School";
  const mascot = metadata.school_info?.mascot || "";
  const topic = metadata.topic || "Untitled";
  const unit = metadata.unit || "";
  const day = metadata.day_number || 1;

  slide.addText(school, {
    x: 0.5, y: 1.5, w: 9, h: 0.6,
    fontSize: 28, color: ACCENT_COLOR, fontFace: "Arial", align: "center",
  });
  slide.addText(`${unit} — Day ${day}`, {
    x: 0.5, y: 2.2, w: 9, h: 0.5,
    fontSize: 20, color: TEXT_COLOR, fontFace: "Arial", align: "center",
  });
  slide.addText(topic, {
    x: 0.5, y: 3.0, w: 9, h: 1.0,
    fontSize: 44, bold: true, color: TEXT_COLOR, fontFace: "Arial", align: "center",
  });
  if (mascot) {
    slide.addText(mascot, {
      x: 0.5, y: 4.5, w: 9, h: 0.4,
      fontSize: 14, color: ACCENT_COLOR, fontFace: "Arial", align: "center",
    });
  }
}

function addContentSlide(PptxGenJS: any, pres: any, slideData: any) {
  const slide = pres.addSlide();
  slide.background = { color: BG_COLOR };

  const type = slideData.slide_type || "unknown";
  const content = slideData.content || {};
  const yStart = 0.5;
  let y = yStart;

  // Slide type badge
  slide.addText(type.replace(/_/g, " ").toUpperCase(), {
    x: 0.5, y: 0.3, w: 3, h: 0.3,
    fontSize: 10, color: ACCENT_COLOR, fontFace: "Arial",
  });

  // Image placeholder if needed
  if (slideData.has_image && slideData.image_search_query) {
    slide.addText(`[Image: ${slideData.image_search_query}]`, {
      x: 6.5, y: 1.5, w: 3, h: 1.5,
      fontSize: 11, color: ACCENT_COLOR, fontFace: "Arial",
      align: "center", valign: "middle",
      shape: PptxGenJS.ShapeType.rect,
      line: { color: ACCENT_COLOR, width: 1 },
    });
  }

  const textW = slideData.has_image ? 5.5 : 9;

  // Render content fields in priority order
  const fieldOrder: Record<string, string[]> = {
    hook: ["hook_question", "student_connection", "time_estimate"],
    learning_objective: ["objective_statement", "standard_ref"],
    journal_prompt: ["prompt_text", "time_estimate"],
    definition_concept: ["term", "definition", "why_it_matters", "real_world_anchor"],
    real_world_example: ["scenario_title", "scenario_description", "business_name", "numbers_or_data"],
    comparison: ["concept_a", "concept_b", "pros_a", "cons_a", "pros_b", "cons_b"],
    activity_intro: ["activity_name", "instructions", "time_limit", "materials_needed", "grouping"],
    activity_recap: ["recap_points", "connection_to_concept"],
    practice: ["problem_setup", "problem_1", "problem_2", "hint"],
    exit_ticket: ["question_1", "question_2", "success_criteria"],
    next_day_preview: ["preview_text"],
  };

  const order = fieldOrder[type] || Object.keys(content);

  for (const key of order) {
    const value = content[key];
    if (!value) continue;

    const label = key.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());

    if (Array.isArray(value)) {
      const text = value.map((v, i) => `${i + 1}. ${v}`).join("\n");
      slide.addText(`${label}\n${text}`, {
        x: 0.5, y, w: textW, h: 0.8,
        fontSize: 14, color: TEXT_COLOR, fontFace: "Arial",
        bullet: false,
      });
      y += 0.9;
    } else if (key === "term" || key === "activity_name" || key === "scenario_title" || key === "concept_a" || key === "concept_b") {
      slide.addText(value, {
        x: 0.5, y, w: textW, h: 0.5,
        fontSize: 24, bold: true, color: TEXT_COLOR, fontFace: "Arial",
      });
      y += 0.6;
    } else if (key === "hook_question") {
      slide.addText(value, {
        x: 0.5, y: 2.0, w: textW, h: 1.5,
        fontSize: 28, bold: true, color: TEXT_COLOR, fontFace: "Arial", align: "center",
      });
      y = 3.8;
    } else if (key === "objective_statement") {
      slide.addText(value, {
        x: 0.5, y: 2.0, w: textW, h: 1.0,
        fontSize: 24, bold: true, color: TEXT_COLOR, fontFace: "Arial", align: "center",
      });
      y = 3.3;
    } else {
      slide.addText(`${label}\n${value}`, {
        x: 0.5, y, w: textW, h: 0.6,
        fontSize: 14, color: TEXT_COLOR, fontFace: "Arial",
      });
      y += 0.7;
    }
  }
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

  // Fetch lesson
  const supabase = getSupabase();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("generated_json, topic, class_name, status")
    .eq("id", lesson_id)
    .eq("user_id", user.id)
    .single();

  if (error || !lesson || lesson.status !== "complete") {
    return NextResponse.json({ error: "Lesson not found or not complete" }, { status: 404 });
  }

  let PptxGenJS: any;
  try {
    PptxGenJS = (await import("pptxgenjs")).default;
  } catch {
    return NextResponse.json(
      { error: "PPTX export is temporarily unavailable. Rendering libraries have been removed to reduce build size. Contact your admin to re-enable exports." },
      { status: 503 }
    );
  }

  const json = lesson.generated_json || {};
  const metadata = json.metadata || {};
  const slides = json.slides || [];

  // Build PPTX
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author = "PrepLessAI";
  pres.company = metadata.school_info?.name || "PrepLessAI";
  pres.subject = metadata.topic || lesson.topic || "Lesson";

  // Title slide
  addTitleSlide(PptxGenJS, pres, metadata);

  // Content slides
  for (const slideData of slides) {
    if (slideData.slide_type === "title") continue; // skip duplicate title
    addContentSlide(PptxGenJS, pres, slideData);
  }

  // Generate blob
  const buffer = await pres.write({ outputType: "nodebuffer" }) as Buffer;
  const filename = `${metadata.topic || lesson.topic || "lesson"}.pptx`.replace(/[^a-zA-Z0-9\-_\.]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
