import { createClient } from "@supabase/supabase-js";
import { Job } from "bullmq";

// ── Build roadmap from class config ──
function buildRoadmap(config: any): string {
  const cc = config.class_config;
  if (!cc) return "";
  const parts: string[] = [];
  parts.push(`LESSON ROADMAP for ${config.class_name}:`);
  if (cc.target_slides) parts.push(`- Produce exactly ${cc.target_slides} slides total. No more, no fewer.`);
  if (cc.min_activities && cc.max_activities) {
    parts.push(`- Include ${cc.min_activities}-${cc.max_activities} activities. Each activity MUST have both an activity_intro slide and an activity_recap slide.`);
  }
  if (cc.preferred_activity_types?.length) {
    parts.push(`- Preferred activity types: ${cc.preferred_activity_types.join(", ")}. Use these when possible.`);
  }
  if (cc.required_slide_types?.length) {
    parts.push(`- REQUIRED slide types that MUST appear: ${cc.required_slide_types.join(", ")}.`);
  }
  if (cc.always_include?.length) {
    const mapped: Record<string, string> = {
      journal: "journal_prompt slide",
      exit_ticket: "exit_ticket slide",
      essential_question: "learning_objective slide with essential question framing",
    };
    parts.push(`- Always include: ${cc.always_include.map((k: string) => mapped[k] || k).join(", ")}.`);
  }
  if (cc.real_world_anchor) {
    parts.push(`- Real-world anchor: All examples MUST reference ${cc.real_world_anchor}. Use specific local business names, numbers, and data.`);
  }
  parts.push(`- Rigor level: ${cc.rigor || "standard"}.`);
  parts.push(`- NO filler slides. Every slide must directly serve the learning objective.`);
  return parts.join("\n");
}

// ── Validation ──
function validateLessonJson(json: any, config?: any): string | null {
  if (!json || typeof json !== "object") return "Response is not an object";

  const requiredKeys = ["metadata", "slides", "activities", "lesson_plan"];
  for (const key of requiredKeys) {
    if (!(key in json)) return `Missing top-level key: ${key}`;
  }

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

  if (!Array.isArray(json.slides)) return "slides is not an array";
  if (json.slides.length < 3) return `Only ${json.slides.length} slides (need at least 3)`;

  const cc = config?.class_config;
  if (cc?.target_slides && json.slides.length !== cc.target_slides) {
    return `Slide count mismatch: got ${json.slides.length}, roadmap requires exactly ${cc.target_slides}`;
  }
  if (cc?.required_slide_types?.length) {
    const presentTypes = new Set(json.slides.map((s: any) => s.slide_type));
    for (const req of cc.required_slide_types) {
      if (!presentTypes.has(req)) {
        return `Missing required slide type: ${req}. Present types: ${Array.from(presentTypes).join(", ")}`;
      }
    }
  }

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

  if (!Array.isArray(json.activities)) return "activities is not an array";

  if (cc?.min_activities && json.activities.length < cc.min_activities) {
    return `Too few activities: got ${json.activities.length}, roadmap requires minimum ${cc.min_activities}`;
  }
  if (cc?.max_activities && json.activities.length > cc.max_activities) {
    return `Too many activities: got ${json.activities.length}, roadmap requires maximum ${cc.max_activities}`;
  }

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
async function callOpenRouter(sourceText: string, config: any, retryError?: string, signal?: AbortSignal) {
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
3. NO answers on student-facing materials. Answer keys in lesson_plan.answer_keys only.
4. At least 3 slides with has_image=true and descriptive image_search_query.
5. Extract content from source material. Do not invent generic content.
6. FOLLOW THE ROADMAP BELOW EXACTLY.

${buildRoadmap(config)}`;

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
    `SOURCE MATERIAL:\n${sourceText.slice(0, 40000)}`,
    "",
    `Generate the LessonDay JSON now.`,
  ];
  const userPrompt = userPromptParts.join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://prepless-ai.up.railway.app",
      "X-Title": "PrepLessAI",
    },
    signal,
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

// ── Supabase client factory (for background worker, no request context) ──
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Job processor (runs in BullMQ worker or inline) ──
export async function processLessonJob(job: Job) {
  const { lessonId, userId, sourceText, config } = job.data;
  const supabase = getSupabase();

  let lessonJson: any;
  let validationError: string | null = null;

  // Helper to log credit transactions
  const logTransaction = async (type: string, amount: number, description: string) => {
    try {
      const { data: creditData } = await supabase
        .from("user_credits")
        .select("remaining_credits")
        .eq("user_id", userId)
        .single();
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        type,
        amount,
        balance_after: creditData?.remaining_credits ?? 0,
        description,
        lesson_id: lessonId,
      });
    } catch (txErr) {
      console.error(`[worker] Failed to log ${type} transaction:`, txErr);
    }
  };

  try {
    // Attempt 1 — 8-minute timeout per attempt (BullMQ gives us more headroom)
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8 * 60 * 1000);
    lessonJson = await callOpenRouter(sourceText, config, undefined, ctrl1.signal);
    clearTimeout(t1);
    validationError = validateLessonJson(lessonJson, config);

    if (validationError) {
      console.log(`[worker][attempt 1] Validation failed: ${validationError}`);
      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 8 * 60 * 1000);
      lessonJson = await callOpenRouter(sourceText, config, validationError, ctrl2.signal);
      clearTimeout(t2);
      validationError = validateLessonJson(lessonJson, config);
    }
  } catch (err: any) {
    const isTimeout = err.name === "AbortError" || err.message?.toLowerCase().includes("aborted");
    console.error(`[worker] Generation failed for lesson ${lessonId}${isTimeout ? " (timeout after 8 min)" : ""}:`, err.message || err);
    await supabase
      .from("lessons")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", lessonId);
    await supabase.rpc("add_user_credits", { user_id_input: userId, amount: 1 });
    await logTransaction("refund", 1, `Refunded — ${isTimeout ? "generation timed out" : "generation failed"}: ${config.topic || config.class_name}`);
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "error",
        title: "Lesson generation failed",
        message: `Your lesson "${config.topic || config.class_name}" ${isTimeout ? "timed out after 8 minutes" : "could not be generated"}. Your credit has been refunded.`,
        lesson_id: lessonId,
      });
    } catch (notifErr) {
      console.error(`[worker] Failed to insert error notification:`, notifErr);
    }
    throw err; // Let BullMQ retry if configured
  }

  if (validationError) {
    console.error(`[worker] Validation failed after retry for lesson ${lessonId}: ${validationError}`);
    await supabase
      .from("lessons")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", lessonId);
    await supabase.rpc("add_user_credits", { user_id_input: userId, amount: 1 });
    await logTransaction("refund", 1, `Refunded — validation failed: ${config.topic || config.class_name}`);
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "error",
        title: "Lesson generation failed",
        message: `Your lesson "${config.topic || config.class_name}" failed validation after retry. Your credit has been refunded.`,
        lesson_id: lessonId,
      });
    } catch (notifErr) {
      console.error(`[worker] Failed to insert error notification:`, notifErr);
    }
    throw new Error(`Validation failed: ${validationError}`);
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

  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "success",
      title: "Lesson ready",
      message: `Your lesson "${config.topic || config.class_name}" is ready to view.`,
      lesson_id: lessonId,
    });
  } catch (notifErr) {
    console.error(`[worker] Failed to insert success notification:`, notifErr);
  }

  console.log(`[worker] Lesson ${lessonId} completed successfully`);
}
