#!/usr/bin/env node
/**
 * Pipeline Render Script
 * -----------------------
 * Offloads DOCX / PPTX generation from the deployed Next.js app to
 * the local AI Prep pipeline machine.
 *
 * Usage:
 *   cd ~/prepless-ai && railway run -- node scripts/render-lesson-exports.mjs [lesson_id]
 *
 * If no lesson_id is provided, it processes all completed lessons
 * that don't have a rendered file in Supabase Storage yet.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME  = "lesson-exports";
const OUTPUT_DIR   = path.join(__dirname, "..", "output", "exports");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run via:  railway run -- node scripts/render-lesson-exports.mjs");
  process.exit(1);
}

let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import("@supabase/supabase-js");
  _supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabase;
}

async function ensureBucket(supabase) {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    if (!buckets?.find(b => b.name === BUCKET_NAME)) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
      if (createErr && /already exists|duplicate/i.test(createErr.message)) {
        console.log("[storage] bucket exists");
      } else if (createErr) {
        throw createErr;
      } else {
        console.log("[storage] bucket created");
      }
    }
  } catch (err) {
    console.error("[storage] bucket setup failed:", err.message);
    throw err;
  }
}

async function fetchLessons(supabase, targetLessonId) {
  if (targetLessonId) {
    const { data, error } = await supabase
      .from("lessons")
      .select("id, user_id, topic, class_name, status, generated_json, created_at")
      .eq("id", targetLessonId)
      .eq("status", "complete")
      .single();
    if (error) throw error;
    return data ? [data] : [];
  }

  const { data, error } = await supabase
    .from("lessons")
    .select("id, user_id, topic, class_name, status, generated_json, created_at")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

function safeString(v) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join("\n");
  return v != null ? String(v) : "";
}

async function renderDocx(lesson) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const json    = lesson.generated_json || {};
  const meta    = json.metadata || {};
  const slides  = json.slides || [];
  const acts    = json.activities || [];
  const plan    = json.lesson_plan || {};
  const school  = meta.school_info || {};

  const children = [];

  children.push(
    new Paragraph({ text: `${school.name || "Your School"} — ${meta.class_name || lesson.class_name || ""}`,   alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    new Paragraph({ text: `Unit: ${meta.unit || ""} — Day ${meta.day_number || 1}`,                              alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
    new Paragraph({ text: meta.topic || lesson.topic || "Untitled Lesson",   heading: HeadingLevel.TITLE,   alignment: AlignmentType.CENTER, spacing: { after: 300 } })
  );

  if (plan.learning_objectives?.length) {
    children.push(new Paragraph({ text: "Learning Objectives", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }));
    for (const obj of plan.learning_objectives) children.push(new Paragraph({ text: `• ${safeString(obj)}`, spacing: { after: 120 } }));
  }

  if (meta.materials_available?.length) {
    children.push(
      new Paragraph({ text: "Materials Available", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
      new Paragraph({ text: meta.materials_available.join(", "), spacing: { after: 200 } })
    );
  }

  if (plan.duration_breakdown?.length) {
    children.push(new Paragraph({ text: "Timing Breakdown", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }));
    for (const seg of plan.duration_breakdown) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${seg.segment} — `, bold: true }), new TextRun(`${seg.minutes} min: ${safeString(seg.description)}`)],
        spacing: { after: 120 },
      }));
    }
  }

  if (slides.length) {
    children.push(new Paragraph({ text: "Slide Deck", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    for (const slide of slides) {
      const c = slide.content || {};
      children.push(new Paragraph({ text: `Slide ${slide.slide_number}: ${(slide.slide_type || "").replace(/_/g, " ")}`, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      for (const [k, v] of Object.entries(c)) {
        if (!v) continue;
        const lab = k.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
        const txt = Array.isArray(v) ? v.map((x, i) => `${i + 1}. ${safeString(x)}`).join("\n") : safeString(v);
        children.push(new Paragraph({ children: [new TextRun({ text: `${lab}: `, bold: true }), new TextRun(txt)], spacing: { after: 100 } }));
      }
      if (slide.has_image && slide.image_search_query) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[Image: ${slide.image_search_query}]`, italics: true })], spacing: { after: 100 } }));
      }
    }
  }

  if (acts.length) {
    children.push(new Paragraph({ text: "Activities", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    for (const a of acts) {
      children.push(new Paragraph({ text: `${a.activity_id}: ${a.activity_name}`, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Type: ", bold: true }), new TextRun(a.activity_type || "")], spacing: { after: 80 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Duration: ", bold: true }), new TextRun(`${a.duration_min} minutes`)], spacing: { after: 80 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Grouping: ", bold: true }), new TextRun((a.grouping || "").replace(/_/g, " "))], spacing: { after: 80 } }));
      if (a.materials?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Materials: ", bold: true }), new TextRun(a.materials.join(", "))], spacing: { after: 80 } }));
      if (a.instructions_student_facing) children.push(new Paragraph({ children: [new TextRun({ text: "Instructions (student-facing):\n", bold: true }), new TextRun(a.instructions_student_facing)], spacing: { after: 120 } }));
      if (a.deliverables?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Deliverables: ", bold: true }), new TextRun(a.deliverables.map(d => d.description).join("; "))], spacing: { after: 120 } }));
    }
  }

  if (plan.teacher_notes) {
    children.push(new Paragraph({ text: "Teacher Notes", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    children.push(new Paragraph({ text: safeString(plan.teacher_notes), spacing: { after: 200 } }));
  }

  if (plan.differentiation) {
    children.push(new Paragraph({ text: "Differentiation", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    if (plan.differentiation.remedial) children.push(new Paragraph({ children: [new TextRun({ text: "Remedial: ", bold: true }), new TextRun(safeString(plan.differentiation.remedial))], spacing: { after: 120 } }));
    if (plan.differentiation.advanced) children.push(new Paragraph({ children: [new TextRun({ text: "Advanced: ", bold: true }), new TextRun(safeString(plan.differentiation.advanced))], spacing: { after: 120 } }));
  }

  if (plan.answer_keys?.length) {
    children.push(new Paragraph({ text: "Answer Keys", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    for (const ak of plan.answer_keys) {
      children.push(new Paragraph({ children: [new TextRun({ text: ak.activity_id, bold: true })], spacing: { after: 80 } }));
      children.push(new Paragraph({ text: safeString(ak.answers), spacing: { after: 200 } }));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBuffer(doc);
}

async function renderPptx(lesson) {
  const { default: PptxGenJS } = await import("pptxgenjs");

  const json   = lesson.generated_json || {};
  const meta   = json.metadata || {};
  const slides = json.slides || [];

  const BG_COLOR = "3C0F14";
  const TEXT_COLOR = "F5F5F5";
  const ACCENT_COLOR = "63666A";

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author  = "PrepLessAI";
  pres.company = meta.school_info?.name || "PrepLessAI";
  pres.subject = meta.topic || lesson.topic || "Lesson";

  const ShapeType = pres.ShapeType || PptxGenJS.ShapeType || {};

  // ---- title slide ----
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: BG_COLOR };
  const schoolName = meta.school_info?.name || "Your School";
  const mascot     = meta.school_info?.mascot || "";
  const topic      = meta.topic || "Untitled";
  const unit       = meta.unit || "";
  const day        = meta.day_number || 1;
  titleSlide.addText(schoolName, { x:0.5, y:1.5, w:9, h:0.6, fontSize:28, color:ACCENT_COLOR, fontFace:"Arial", align:"center" });
  titleSlide.addText(`${unit} — Day ${day}`, { x:0.5, y:2.2, w:9, h:0.5, fontSize:20, color:TEXT_COLOR, fontFace:"Arial", align:"center" });
  titleSlide.addText(topic, { x:0.5, y:3.0, w:9, h:1.0, fontSize:44, bold:true, color:TEXT_COLOR, fontFace:"Arial", align:"center" });
  if (mascot) titleSlide.addText(mascot, { x:0.5, y:4.5, w:9, h:0.4, fontSize:14, color:ACCENT_COLOR, fontFace:"Arial", align:"center" });

  // ---- helpers ----
  const fieldOrder = {
    hook: ["hook_question","student_connection","time_estimate"],
    learning_objective: ["objective_statement","standard_ref"],
    journal_prompt: ["prompt_text","time_estimate"],
    definition_concept: ["term","definition","why_it_matters","real_world_anchor"],
    real_world_example: ["scenario_title","scenario_description","business_name","numbers_or_data"],
    comparison: ["concept_a","concept_b","pros_a","cons_a","pros_b","cons_b"],
    activity_intro: ["activity_name","instructions","time_limit","materials_needed","grouping"],
    activity_recap: ["recap_points","connection_to_concept"],
    practice: ["problem_setup","problem_1","problem_2","hint"],
    exit_ticket: ["question_1","question_2","success_criteria"],
    next_day_preview: ["preview_text"],
  };

  for (const slideData of slides) {
    if (slideData.slide_type === "title") continue;

    const slide = pres.addSlide();
    slide.background = { color: BG_COLOR };
    const type = slideData.slide_type || "unknown";
    const content = slideData.content || {};
    let y = 0.5;

    slide.addText(type.replace(/_/g," ").toUpperCase(), { x:0.5, y:0.3, w:3, h:0.3, fontSize:10, color:ACCENT_COLOR, fontFace:"Arial" });

    if (slideData.has_image && slideData.image_search_query) {
      const imgOpts = {
        x: 6.5, y: 1.5, w: 3, h: 1.5,
        fontSize: 11, color: ACCENT_COLOR, fontFace: "Arial",
        align: "center", valign: "middle",
        line: { color: ACCENT_COLOR, width: 1 },
      };
      if (ShapeType.rect) imgOpts.shape = ShapeType.rect;
      slide.addText(`[Image: ${slideData.image_search_query}]`, imgOpts);
    }

    const textW = slideData.has_image ? 5.5 : 9;
    const order = fieldOrder[type] || Object.keys(content);

    for (const key of order) {
      const value = content[key];
      if (!value) continue;
      const label = key.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

      if (Array.isArray(value)) {
        const txt = value.map((v, i) => `${i+1}. ${v}`).join("\n");
        slide.addText(`${label}\n${txt}`, { x:0.5, y, w:textW, h:0.8, fontSize:14, color:TEXT_COLOR, fontFace:"Arial", bullet:false });
        y += 0.9;
      } else if (["term","activity_name","scenario_title","concept_a","concept_b"].includes(key)) {
        slide.addText(value, { x:0.5, y, w:textW, h:0.5, fontSize:24, bold:true, color:TEXT_COLOR, fontFace:"Arial" });
        y += 0.6;
      } else if (key === "hook_question") {
        slide.addText(value, { x:0.5, y:2.0, w:textW, h:1.5, fontSize:28, bold:true, color:TEXT_COLOR, fontFace:"Arial", align:"center" });
        y = 3.8;
      } else if (key === "objective_statement") {
        slide.addText(value, { x:0.5, y:2.0, w:textW, h:1.0, fontSize:24, bold:true, color:TEXT_COLOR, fontFace:"Arial", align:"center" });
        y = 3.3;
      } else {
        slide.addText(`${label}\n${value}`, { x:0.5, y, w:textW, h:0.6, fontSize:14, color:TEXT_COLOR, fontFace:"Arial" });
        y += 0.7;
      }
    }
  }

  return Buffer.from(await pres.write({ outputType: "nodebuffer" }));
}

async function uploadFile(supabase, lessonId, ext, buffer) {
  const filename = `lessons/${lessonId}/lesson.${ext}`;
  const ct = ext === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, buffer, { contentType: ct, upsert: true });
  if (error) throw error;

  const { data } = await supabase.storage.from(BUCKET_NAME).getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  const supabase = await getSupabase();
  await ensureBucket(supabase);

  const targetId = process.argv[2] || null;
  const lessons = await fetchLessons(supabase, targetId);

  if (!lessons.length) {
    console.log("No completed lessons found to render.");
    process.exit(0);
  }

  console.log(`Rendering ${lessons.length} lesson(s)...\n`);
  let ok = 0, fail = 0;
  const manifest = [];

  for (const lesson of lessons) {
    const { id, topic } = lesson;
    try {
      console.log(`  ${id} — ${topic || "Untitled"}`);
      const [docxBuf, pptxBuf] = await Promise.all([renderDocx(lesson), renderPptx(lesson)]);
      const docxUrl = await uploadFile(supabase, id, "docx", docxBuf);
      const pptxUrl = await uploadFile(supabase, id, "pptx", pptxBuf);
      manifest.push({ id, topic, docxUrl, pptxUrl, ts: new Date().toISOString() });
      console.log(`    DOCX → ${docxUrl}`);
      console.log(`    PPTX → ${pptxUrl}`);
      ok++;
    } catch (err) {
      console.error(`    FAIL — ${err.message}`);
      manifest.push({ id, topic, error: err.message, ts: new Date().toISOString() });
      fail++;
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const mpath = path.join(OUTPUT_DIR, `manifest-${Date.now()}.json`);
  await fs.writeFile(mpath, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${ok} ok, ${fail} failed. Manifest: ${mpath}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
