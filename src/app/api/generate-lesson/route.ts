import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Validation ──
function validateLessonJson(json: any): string | null {
  if (!json || typeof json !== "object") return "Response is not an object";

  const requiredKeys = ["metadata", "slides", "activities", "lesson_plan"];
  for (const key of requiredKeys) {
    if (!(key in json)) return `Missing top-level key: ${key}`;
  }

  // ── Metadata ──
  const meta = json.metadata;
  if (!meta || typeof meta !== "object") return "metadata is not an object";
  const metaFields = ["class_name", "unit", "day_number", "topic", "class_duration_min", "school_info"];
  for (const f of metaFields) {
    if (!(f in meta)) return `metadata missing field: ${f}`;
  }
  if (typeof meta.day_number !== "number") return "metadata.day_number must be a number";
  if (typeof meta.class_duration_min !== "number") return "metadata.class_duration_min must be a number";
  if (!meta.school_info || typeof meta.school_info !== "object") return "metadata.school_info must be an object";
  if (typeof meta.school_info.name !== "string") return "metadata.school_info.name must be a string";
  if (!meta.school_info.colors || typeof meta.school_info.colors !== "object") return "metadata.school_info.colors must be an object";
  if (typeof meta.school_info.colors.primary !== "string") return "metadata.school_info.colors.primary must be a string";
  if (typeof meta.school_info.colors.secondary !== "string") return "metadata.school_info.colors.secondary must be a string";

  // ── Slides ──
  if (!Array.isArray(json.slides)) return "slides is not an array";
  if (json.slides.length < 3) return `Only ${json.slides.length} slides (need at least 3)`;

  const allowedSlideTypes = new Set([
    "title", "hook", "learning_objective", "journal_prompt", "prior_review",
    "definition_concept", "real_world_example", "comparison", "activity_intro",
    "activity_recap", "practice", "exit_ticket", "next_day_preview",
  ]);

  const slideContentRequired: Record<string, string[]> = {
    title: ["unit_title", "topic_title"],
    hook: ["hook_question"],
    learning_objective: ["objective_statement"],
    journal_prompt: ["prompt_text"],
    definition_concept: ["term", "definition"],
    real_world_example: ["scenario_title", "scenario_description"],
    comparison: ["concept_a", "concept_b"],
    activity_intro: ["activity_name", "instructions"],
    activity_recap: ["connection_to_concept"],
    practice: ["problem_setup"],
    exit_ticket: ["question_1", "question_2"],
    next_day_preview: ["preview_text"],
  };

  for (const [i, slide] of json.slides.entries()) {
    if (!slide || typeof slide !== "object") return `slide[${i}] is not an object`;
    if (typeof slide.slide_number !== "number") return `slide[${i}] slide_number must be a number`;
    if (typeof slide.slide_type !== "string") return `slide[${i}] slide_type must be a string`;
    if (!allowedSlideTypes.has(slide.slide_type)) return `slide[${i}] has invalid slide_type: ${slide.slide_type}`;
    if (!slide.content || typeof slide.content !== "object") return `slide[${i}] content is not an object`;

    const required = slideContentRequired[slide.slide_type] || [];
    for (const f of required) {
      if (!(f in slide.content)) return `slide[${i}] (${slide.slide_type}) missing content field: ${f}`;
    }

    if (slide.has_image === true) {
      if (typeof slide.image_search_query !== "string" || slide.image_search_query.trim().length === 0) {
        return `slide[${i}] has_image=true but missing image_search_query`;
      }
    }
  }

  // ── Activities ──
  if (!Array.isArray(json.activities)) return "activities is not an array";
  for (const [i, act] of json.activities.entries()) {
    if (!act || typeof act !== "object") return `activity[${i}] is not an object`;
    if (typeof act.activity_id !== "string") return `activity[${i}] activity_id must be a string`;
    if (typeof act.activity_name !== "string") return `activity[${i}] activity_name must be a string`;
    if (typeof act.activity_type !== "string") return `activity[${i}] activity_type must be a string`;
    if (typeof act.duration_min !== "number") return `activity[${i}] duration_min must be a number`;
    if (typeof act.grouping !== "string") return `activity[${i}] grouping must be a string`;
    if (!act.materials || !Array.isArray(act.materials)) return `activity[${i}] materials must be an array`;
    if (!act.instructions_student_facing || typeof act.instructions_student_facing !== "string") {
      return `activity[${i}] instructions_student_facing must be a string`;
    }
    if (!act.deliverables || !Array.isArray(act.deliverables)) return `activity[${i}] deliverables must be an array`;
  }

  // ── Lesson plan ──
  const plan = json.lesson_plan;
  if (!plan || typeof plan !== "object") return "lesson_plan is not an object";
  if (!plan.duration_breakdown || !Array.isArray(plan.duration_breakdown)) return "lesson_plan.duration_breakdown must be an array";
  if (!plan.learning_objectives || !Array.isArray(plan.learning_objectives)) return "lesson_plan.learning_objectives must be an array";
  if (!plan.instructional_phases || !Array.isArray(plan.instructional_phases)) return "lesson_plan.instructional_phases must be an array";
  if (!plan.teacher_notes || typeof plan.teacher_notes !== "object") return "lesson_plan.teacher_notes must be an object";
  if (!plan.answer_keys || typeof plan.answer_keys !== "object") return "lesson_plan.answer_keys must be an object";
  if (!plan.differentiation || typeof plan.differentiation !== "object") return "lesson_plan.differentiation must be an object";

  return null; // valid
}

// ── OpenRouter call ──
async function callOpenRouter(sourceText: string, config: any, retryError?: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const systemPrompt = `You are an expert CTE curriculum writer. Produce a single day of instruction as flat JSON.

CRITICAL — OUTPUT MUST BE A FLAT JSON OBJECT with these EXACT top-level keys: metadata, slides, activities, lesson_plan, source_material_fingerprint. Do NOT wrap inside "lesson_day".

METADATA:
{
  "class_name": "string",
  "unit": "string",
  "day_number": integer,
  "topic": "string (max 80 chars)",
  "class_duration_min": integer (50, 55, 60, or 90),
  "school_info": {"name": "string", "city": "string", "state": "string", "mascot": "string", "colors": {"primary": "#RRGGBB", "secondary": "#RRGGBB"}},
  "materials_available": ["whiteboard", "projector", "laptops", "printer", "cardstock", "scissors", "tape", "sticky_notes"]
}

SLIDES — each: {slide_number, slide_type, content, has_image, image_search_query}
slide_type: title, hook, learning_objective, journal_prompt, prior_review, definition_concept, real_world_example, comparison, activity_intro, activity_recap, practice, exit_ticket, next_day_preview

CONTENT FIELDS BY TYPE:
- title: unit_title, day_number, topic_title, teacher_name, school_name
- hook: hook_question, student_connection, time_estimate
- learning_objective: objective_statement ("I can..."), standard_ref
- journal_prompt: prompt_text, time_estimate
- definition_concept: term, definition, why_it_matters, real_world_anchor
- real_world_example: scenario_title, scenario_description, business_name, numbers_or_data
- comparison: concept_a, concept_b, pros_a, cons_a, pros_b, cons_b
- activity_intro: activity_name, instructions, time_limit, materials_needed, grouping
- activity_recap: recap_points (array), connection_to_concept
- practice: problem_setup, problem_1, problem_2, hint
- exit_ticket: question_1, question_2, success_criteria
- next_day_preview: preview_text

ACTIVITIES — each: {activity_id (ACT01), activity_name, activity_type, movement_level, duration_min, grouping, materials, instructions_student_facing, answer_key_in_lesson_plan, deliverables: [{file_type, description}]}

LESSON_PLAN: {duration_breakdown, learning_objectives, instructional_phases, teacher_notes, answer_keys, differentiation: {remedial, advanced}}

RULES:
1. Output ONLY valid flat JSON. No markdown, no code fences.
2. Use REAL examples with specific local businesses, numbers, names.
3. 10-15 slides total. Core concept slides ~5. Minimum 2 activities (activity_intro + activity_recap slides for each).
4. NO answers on student-facing materials. Answer keys in lesson_plan.answer_keys only.
5. At least 3 slides with has_image=true and descriptive image_search_query.
6. Extract content from source material. Do not invent generic content.`;

  const userPromptParts = [
    `TEACHER INPUT:`,
    `- Class: ${config.class_name}`,
    `- Duration: ${config.duration_min} minutes`,
    `- Unit: ${config.unit || "N/A"}`,
    `- Day: ${config.day_number || 1}`,
    `- Topic: ${config.topic || "From source material"}`,
    `- Rigor: ${config.rigor || "standard"}`,
    `- Include journal: ${config.include_journal}`,
    `- Include essential questions: ${config.include_essential}`,
    `- School: ${config.school_name || "Cascade High School"} in ${config.school_city || "Everett"}, ${config.school_state || "WA"}`,
    `- Mascot: ${config.school_mascot || "Bruins"}`,
    `- Colors: Primary ${config.primary_color || "#8B0000"}, Secondary ${config.secondary_color || "#FFD700"}`,
    "",
    retryError ? `PREVIOUS ATTENTION ERROR — fix this: ${retryError}\n` : "",
    `SOURCE MATERIAL:\n${sourceText.slice(0, 8000)}`,
    "",
    `Generate the LessonDay JSON now.`,
  ];
  const userPrompt = userPromptParts.join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://prepless-ai.vercel.app",
      "X-Title": "PrepLessAI",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 6000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content;
  const parsed = JSON.parse(raw);

  // Normalize wrapped JSON
  if (parsed.lesson_day) return parsed.lesson_day;
  return parsed;
}

// ── Background generation ──
async function runGeneration(
  supabase: any,
  lessonId: string,
  userId: string,
  sourceText: string,
  config: any
) {
  let lessonJson: any;
  let validationError: string | null = null;

  try {
    lessonJson = await callOpenRouter(sourceText, config);
    validationError = validateLessonJson(lessonJson);

    if (validationError) {
      console.log(`[attempt 1] Validation failed: ${validationError}`);
      lessonJson = await callOpenRouter(sourceText, config, validationError);
      validationError = validateLessonJson(lessonJson);
    }
  } catch (err: any) {
    console.error(`[background] Generation failed for lesson ${lessonId}:`, err.message);
    await supabase
      .from("lessons")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", lessonId);
    await supabase.rpc("add_user_credits", { user_id_input: userId, amount: 1 });
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "error",
      title: "Lesson generation failed",
      message: `Your lesson "${config.topic || config.class_name}" could not be generated. Your credit has been refunded.`,
      lesson_id: lessonId,
    });
    return;
  }

  if (validationError) {
    console.error(`[background] Validation failed after retry for lesson ${lessonId}: ${validationError}`);
    await supabase
      .from("lessons")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", lessonId);
    await supabase.rpc("add_user_credits", { user_id_input: userId, amount: 1 });
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "error",
      title: "Lesson generation failed",
      message: `Your lesson "${config.topic || config.class_name}" failed validation after retry. Your credit has been refunded.`,
      lesson_id: lessonId,
    });
    return;
  }

  // Save success
  await supabase
    .from("lessons")
    .update({
      status: "complete",
      generated_json: lessonJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "success",
    title: "Lesson ready",
    message: `Your lesson "${config.topic || config.class_name}" is ready to view.`,
    lesson_id: lessonId,
  });
}

// ── API Route ──
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, source_text, config } = body;
  if (!user_id || !source_text || !config?.class_name) {
    return NextResponse.json({ error: "Missing user_id, source_text, or class_name" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── 1. Burn credit atomically ──
  const { data: burned, error: burnErr } = await supabase.rpc("burn_credit", {
    user_id_input: user_id,
    amount: 1,
  });

  if (burnErr || !burned) {
    return NextResponse.json(
      { error: "Insufficient credits. Add an access code or purchase more." },
      { status: 402 }
    );
  }

  // ── 2. Create lesson row (pending) ──
  const { data: lessonRow, error: insertErr } = await supabase
    .from("lessons")
    .insert({
      user_id,
      status: "pending",
      class_name: config.class_name,
      topic: config.topic || "",
      source_text: source_text.slice(0, 5000),
      credits_used: 1,
    })
    .select("id")
    .single();

  if (insertErr || !lessonRow) {
    // Refund the credit
    await supabase.rpc("add_user_credits", { user_id_input: user_id, amount: 1 });
    return NextResponse.json({ error: "Failed to create lesson record" }, { status: 500 });
  }

  // ── 3. Return immediately ──
  // Fire the LLM generation in the background (Node.js runtime keeps running after response)
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runGeneration(supabase, lessonRow.id, user_id, source_text, config);

  return NextResponse.json({
    success: true,
    lesson_id: lessonRow.id,
    status: "pending",
    message: "Your lesson is being generated. You'll be notified when it's ready.",
  });
}
