"""
pipeline.py — Generation → Audit → Fix
Uses Kimi for generation, DeepSeek for audit, Kimi for fixes.
"""
import json
import os
import re
import time
from typing import Dict, List, Optional, Tuple

from openai import OpenAI

BASE_URL = "https://openrouter.ai/api/v1"
API_KEY = os.getenv("OPENROUTER_API_KEY", "")
if not API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY not set")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY, max_retries=2)

MODEL_GENERATOR = "moonshotai/kimi-k2.6"
MODEL_AUDITOR = "deepseek/deepseek-chat"
MODEL_FIXER = "moonshotai/kimi-k2.6"


def _call_llm(system: str, user: str, model: str, step_name: str,
              max_tokens: int = 16000, temperature: float = 0.3,
              retries: int = 2, timeout: int = 180) -> Tuple[Optional[str], Optional[Dict]]:
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for attempt in range(retries):
        try:
            resp = client.chat.completions.create(
                model=model, messages=msgs, max_tokens=max_tokens,
                temperature=temperature, timeout=timeout,
            )
            content = resp.choices[0].message.content
            usage = resp.usage
            return content, {
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
            }
        except Exception as e:
            print(f"  ⚠️ {step_name} error (attempt {attempt+1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(5)
            else:
                return None, None
    return None, None


def _parse_json_safe(text: str) -> Optional[Dict]:
    if not text:
        return None
    # Code block
    m = re.search(r'```(?:json)?\s*(\{.*\})\s*```', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except:
            pass
    # Raw JSON
    try:
        return json.loads(text)
    except:
        pass
    # Find first { and last }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except:
            pass
    return None


def _build_roadmap(config: Dict) -> str:
    cc = config.get("class_config") or {}
    duration = int(config.get("duration_min", 50))
    default_min = 3 if duration >= 90 else 2 if duration >= 55 else 1
    default_max = 4 if duration >= 90 else 3
    target_slides = cc.get("target_slides") or max(8, int(duration / 6))

    parts = [f"LESSON ROADMAP for {config.get('class_name', 'Class')}:"]
    parts.append(f"- Produce exactly {target_slides} slides total. No more, no fewer.")
    parts.append(f"- Include {cc.get('min_activities', default_min)}-{cc.get('max_activities', default_max)} activities. Each activity MUST have both an activity_intro slide and an activity_recap slide.")

    if cc.get("preferred_activity_types"):
        parts.append(f"- Preferred activity types: {', '.join(cc['preferred_activity_types'])}.")
    if cc.get("required_slide_types"):
        parts.append(f"- REQUIRED slide types that MUST appear: {', '.join(cc['required_slide_types'])}.")
    if cc.get("always_include"):
        mapped = {"journal": "journal_prompt slide", "exit_ticket": "exit_ticket slide",
                  "essential_question": "learning_objective slide with essential question framing"}
        parts.append(f"- Always include: {', '.join(mapped.get(k, k) for k in cc['always_include'])}.")
    if cc.get("real_world_anchor"):
        parts.append(f"- Real-world anchor: All examples MUST reference {cc['real_world_anchor']}. Use specific local business names, numbers, and data.")

    parts.append(f"- Rigor level: {cc.get('rigor', config.get('rigor', 'standard'))}.")
    parts.append("- NO filler slides. Every slide must directly serve the learning objective.")
    return "\n".join(parts)


# ─── GENERATION ─────────────────────────────────────────────────────────────

GENERATION_SYSTEM = """You are an expert CTE curriculum writer. Produce a single day of instruction as flat JSON.

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
- activity_intro: activity_name, instructions (student-facing ONLY). time_limit, materials_needed, grouping — these go in lesson_plan.teacher_notes only, NOT in slide content.
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
4. Include at least 3 slides with has_image=true and descriptive image_search_query.
5. Extract content from source material. Do not invent generic content.
6. FOLLOW THE ROADMAP BELOW EXACTLY."""


def generate_lesson(source_text: str, config: Dict) -> Optional[Dict]:
    user_parts = [
        "TEACHER INPUT:",
        f"- Class: {config.get('class_name', '')}",
        f"- Duration: {config.get('duration_min', 50)} minutes",
        f"- Unit: {config.get('unit', 'N/A')}",
        f"- Day: {config.get('day_number', 1)}",
        f"- Topic: {config.get('topic', 'From source material')}",
        f"- Rigor: {config.get('rigor', 'standard')}",
        f"- Include journal: {config.get('include_journal', False)}",
        f"- Include essential questions: {config.get('include_essential', False)}",
        f"- Include AI-generated photos/illustrations: {config.get('include_photos', False)}",
        f"- School: {config.get('school_name', 'Cascade High School')} in {config.get('school_city', '')}, {config.get('school_state', '')}",
        f"- Mascot: {config.get('school_mascot', 'Bruins')}",
        f"- Colors: Primary {config.get('primary_color', '#8B0000')}, Secondary {config.get('secondary_color', '#FFD700')}",
        "",
        f"SOURCE MATERIAL:\n{source_text[:40000]}",
        "",
        _build_roadmap(config),
        "",
        "Generate the LessonDay JSON now.",
    ]

    content, usage = _call_llm(
        GENERATION_SYSTEM, "\n".join(user_parts),
        MODEL_GENERATOR, "generate", max_tokens=16000, temperature=0.4
    )
    if not content:
        return None

    data = _parse_json_safe(content)
    if not data:
        return None

    # Normalize wrapped JSON
    if "lesson_day" in data and isinstance(data["lesson_day"], dict):
        data = data["lesson_day"]

    # Ensure required top-level keys exist
    for key in ["metadata", "slides", "activities", "lesson_plan"]:
        if key not in data:
            data[key] = {} if key == "metadata" else []

    return data


# ─── AUDIT ──────────────────────────────────────────────────────────────────

FIDELITY_SYSTEM = """You are a Quality Assurance Director auditing educational materials against their source text.

FORBIDDEN (flag these):
- Fake historical events presented as real
- Invented characters
- Economic theories NOT in source text
- Fake legislation or government actions presented as real
- External knowledge not found in the source text
- Paraphrased concepts that drift from the source meaning

CROSS-FILE CONSISTENCY CHECKS:
- Slides contradict lesson_plan
- Activities referenced in lesson_plan but missing from activities array
- Teacher notes (time_estimate, materials_needed, grouping) leaking into slide content
- File naming issues

PERMITTED:
- Classroom activities using The Cave student store
- Made-up practice data for exercises (clearly labeled)
- Hypotheticals that explain concepts FROM the source text
- Real-life examples students can relate to

Return ONLY JSON:
{"pass": true/false, "issues": [{"severity": "critical/high/medium/low", "issue": "specific problem", "suggestion": "how to fix"}]}"""


PEDAGOGY_SYSTEM = """You are a veteran CTE teacher with 20 years of classroom experience. Ruthlessly evaluate whether these materials would work in a real high school class.

EVALUATE:
1. ENGAGEMENT & HOOK — Does the opening grab attention in 30 seconds?
2. LEARNING OBJECTIVES — Measurable? Ban "understand", "learn about".
3. PACING & TIMING — Do time blocks fit the class duration with transitions?
4. ACTIVITY DESIGN — Clear instructions? Specific answer key? Students produce something?
5. SLIDE DESIGN — Max 30 words per content slide? No walls of text?
6. DIFFERENTIATION — Meaningful or filler?
7. ASSESSMENT & CLOSURE — Exit ticket assesses objectives?
8. REAL-WORLD CONNECTION — Link to jobs, careers, business, personal finance?

SEVERITY: critical/high/medium/low

Return ONLY JSON:
{"pass": true/false, "score": 0-100, "issues": [{"severity": "...", "issue": "...", "suggestion": "..."}]}"""


def audit_lesson(data: Dict, source_text: str) -> Tuple[bool, int, List[Dict]]:
    """Returns (pass, pedagogy_score, issues_list)."""
    json_text = json.dumps(data, indent=2)

    # Fidelity audit
    fidelity_prompt = f"""SOURCE TEXT:\n---\n{source_text[:15000]}\n---\n\nGENERATED MATERIALS (JSON):\n```json\n{json_text[:20000]}\n```\n\nAudit for factual accuracy and consistency. Return ONLY JSON."""

    fidelity_raw, _ = _call_llm(FIDELITY_SYSTEM, fidelity_prompt, MODEL_AUDITOR, "fidelity_audit", max_tokens=8000)
    fidelity = _parse_json_safe(fidelity_raw) or {"pass": True, "issues": []}

    # Pedagogy audit
    pedagogy_prompt = f"""CLASS DURATION: {data.get('metadata', {}).get('class_duration_min', 50)} minutes\n\nGENERATED MATERIALS (JSON):\n```json\n{json_text[:20000]}\n```\n\nEvaluate pedagogy and classroom viability. Return ONLY JSON."""

    pedagogy_raw, _ = _call_llm(PEDAGOGY_SYSTEM, pedagogy_prompt, MODEL_AUDITOR, "pedagogy_audit", max_tokens=8000)
    pedagogy = _parse_json_safe(pedagogy_raw) or {"pass": True, "score": 75, "issues": []}

    # Combine issues
    all_issues = []
    for issue in fidelity.get("issues", []):
        issue["category"] = "fidelity"
        all_issues.append(issue)
    for issue in pedagogy.get("issues", []):
        issue["category"] = "pedagogy"
        all_issues.append(issue)

    score = pedagogy.get("score", 75)
    passed = fidelity.get("pass", True) and score >= 70 and not any(i.get("severity") == "critical" for i in all_issues)

    return passed, score, all_issues


# ─── FIX ────────────────────────────────────────────────────────────────────

FIX_SYSTEM = """You are an expert CTE curriculum editor. Fix the following educational material based on audit findings.

RULES:
1. Fix ALL issues listed
2. For fidelity issues: ensure content matches source text exactly
3. For pedagogy issues: follow the fix directions
4. Do not change content that was not flagged
5. Maintain the same JSON structure
6. Return ONLY the corrected JSON object"""


def fix_lesson(data: Dict, issues: List[Dict], source_text: str) -> Optional[Dict]:
    # Only fix critical and high issues
    fixable = [i for i in issues if i.get("severity") in ("critical", "high")]
    if not fixable:
        return data

    lines = []
    for i in fixable:
        suggestion = i.get("suggestion", "")
        if suggestion:
            lines.append(f"- [{i['severity']}] [{i.get('category', '')}] {i['issue']}\n  Fix: {suggestion}")
        else:
            lines.append(f"- [{i['severity']}] [{i.get('category', '')}] {i['issue']}")

    original_json = json.dumps(data, indent=2)
    issues_text = "\n".join(lines)
    user_prompt = f"""SOURCE TEXT (ground truth):\n---\n{source_text[:20000]}\n---\n\nORIGINAL MATERIAL:\n```json\n{original_json[:25000]}\n```\n\nAUDIT ISSUES:\n{issues_text}\n\nReturn the corrected JSON."""

    content, _ = _call_llm(FIX_SYSTEM, user_prompt, MODEL_FIXER, "fix", max_tokens=16000)
    if not content:
        return data

    fixed = _parse_json_safe(content)
    if not fixed:
        return data

    if "lesson_day" in fixed and isinstance(fixed["lesson_day"], dict):
        fixed = fixed["lesson_day"]

    for key in ["metadata", "slides", "activities", "lesson_plan"]:
        if key not in fixed:
            fixed[key] = data.get(key, {} if key == "metadata" else [])

    return fixed


# ─── PUBLIC API ─────────────────────────────────────────────────────────────

def run_pipeline(source_text: str, config: Dict) -> Tuple[Optional[Dict], List[Dict]]:
    """Run full pipeline: generate → audit → fix. Returns (data, audit_issues)."""
    print("[pipeline] Generating with Kimi...")
    data = generate_lesson(source_text, config)
    if not data:
        return None, [{"severity": "critical", "issue": "Generation failed", "category": "system"}]

    print("[pipeline] Auditing with DeepSeek...")
    passed, score, issues = audit_lesson(data, source_text)
    print(f"[pipeline] Audit score: {score}/100, pass={passed}, issues={len(issues)}")

    # Attach audit metadata directly to data for storage
    data["_audit"] = {
        "score": score,
        "passed": passed,
        "issue_count": len(issues),
        "issues": issues,
    }

    if not passed and issues:
        print(f"[pipeline] Fixing {len([i for i in issues if i.get('severity') in ('critical', 'high')])} critical/high issues with Kimi...")
        data = fix_lesson(data, issues, source_text)
        # Re-audit after fix
        passed, score, issues = audit_lesson(data, source_text)
        print(f"[pipeline] Re-audit score: {score}/100, pass={passed}, issues={len(issues)}")
        # Update audit metadata after fix
        data["_audit"] = {
            "score": score,
            "passed": passed,
            "issue_count": len(issues),
            "issues": issues,
        }

    return data, issues
