import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── OpenRouter call ──
async function callOpenRouter(sourceText: string, config: any) {
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

  const userPrompt = `TEACHER INPUT:
- Class: ${config.class_name}
- Duration: ${config.duration_min} minutes
- Unit: ${config.unit || "N/A"}
- Day: ${config.day_number || 1}
- Topic: ${config.topic || "From source material"}
- Rigor: ${config.rigor || "standard"}
- Include journal: ${config.include_journal}
- Include essential questions: ${config.include_essential}
- School: ${config.school_name || "Cascade High School"} in ${config.school_city || "Everett"}, ${config.school_state || "WA"}
- Mascot: ${config.school_mascot || "Bruins"}
- Colors: Primary ${config.primary_color || "#8B0000"}, Secondary ${config.secondary_color || "#FFD700"}

SOURCE MATERIAL:
${sourceText.slice(0, 8000)}

Generate the LessonDay JSON now.`;

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
      status: "generating",
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

  // ── 3. Call LLM ──
  let lessonJson: any;
  try {
    lessonJson = await callOpenRouter(source_text, config);
  } catch (err: any) {
    await supabase
      .from("lessons")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", lessonRow.id);
    // Refund
    await supabase.rpc("add_user_credits", { user_id_input: user_id, amount: 1 });
    return NextResponse.json({ error: `Generation failed: ${err.message}` }, { status: 500 });
  }

  // ── 4. Save result ──
  await supabase
    .from("lessons")
    .update({
      status: "complete",
      generated_json: lessonJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonRow.id);

  return NextResponse.json({
    success: true,
    lesson_id: lessonRow.id,
    lesson: lessonJson,
  });
}
