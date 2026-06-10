# PrepLessAI SaaS — Complete Code Audit
**Date:** 2026-06-09  
**Branch:** main  
**Environment:** Next.js 16 + Supabase + OpenRouter (DeepSeek)  
**Production URL:** https://prepless-ai.vercel.app

---

## 1. WHAT WORKS (Verified / Expected to Work)

| Component | Status | Notes |
|-----------|--------|-------|
| **Auth (Magic Links)** | ✅ Works | Hardcoded redirect to `https://prepless-ai.vercel.app` — fixed the localhost bug. Supabase `auth/callback` route exchanges code for session. |
| **Auth Middleware** | ⚠️ Partial | Checks `auth.getUser()` on every request. PROTECTS `/dashboard/*` routes. BUT: makes a DB/network call on every single page load (slow). |
| **Access Code Redemption** | ✅ Works | `redeem-code` API → `decrement_code_uses()` + `add_user_credits()` RPC. Returns remaining credits. |
| **Credit System (DB)** | ✅ Works | `user_credits` table with `burn_credit()` and `add_user_credits()` functions. Atomic decrement. |
| **File Extraction (API)** | ✅ Works | `pdf-parse` for PDFs, `mammoth` for DOCX, native for TXT. Capped at 15K chars. |
| **Dashboard Form UI** | ✅ Works | Tabs: Upload → Configure → Review. Real file upload with text preview. Editable extracted text. |
| **Access Code UI** | ✅ Works | Click credits badge in header → type code → hit enter → credits update. |
| **Lesson Generation (API)** | ✅ Wire works | Calls OpenRouter DeepSeek. Burns credit atomically. Saves to `lessons` table. |
| **Lesson View Page** | ✅ Works | Renders slides, activities, lesson plan, timing, teacher notes, answer keys. Color-coded slide types. |
| **Settings Page (UI only)** | ✅ Visual | Tabs for school, classes, defaults, resources. Pure UI — no persistence wired. |
| **Status Page** | 💀 FAKE | Hardcoded fake progress bar. No real status, no polling, no downloads. |

---

## 2. WHAT'S BROKEN / HALF-ASSED

### 🔴 CRITICAL — Will Break in Production

#### 2.1 `pdf-parse` May Fail on Vercel
- **File:** `src/app/api/extract-text/route.ts` line 22
- **Issue:** `require("pdf-parse")` at runtime. If `pdf-parse` has native deps or loads `pdfjs-dist` dynamically, it may 500 on Vercel serverless. **UNTESTED.**
- **Fix:** Add timeout wrapper. Verify by uploading a real PDF to production.

#### 2.2 `extract-text` Does NOT Parse Images
- **File:** `src/app/api/extract-text/route.ts` lines 39-40
- **Issue:** Images get placeholder text: `[Image uploaded: filename]`. No OCR. PPTX output promises images but we can't read them.
- **Fix:** Add Google Vision API, Tesseract, or gpt-4o-vision fallback.

#### 2.3 LLM Prompt is NOT the v2 Schema
- **File:** `src/app/api/generate-lesson/route.ts` lines 9-51
- **Issue:** The system prompt is a simplified wall of text. It is NOT the exhaustive `lesson_day.json` schema you built for your local v2 pipeline. The v2 has: specific ENUMs for every field, min/max lengths, regex patterns, validation rules. This prompt is looser and will produce inconsistent JSON.
- **Impact:** Lesson view renders might crash if JSON shape doesn't match interfaces. Typos in keys = empty sections.
- **Fix:** Port the FULL `lesson_day.json` schema as the `response_format` or a detailed JSON schema constraint.

#### 2.4 No JSON Validation on LLM Output
- **File:** `src/app/api/generate-lesson/route.ts` lines 97-102
- **Issue:** `JSON.parse(raw)` with no schema validation. If DeepSeek returns markdown fences, truncation, or bad JSON, the whole request 500s and the user loses their credit (we refund on error, but the user experience is broken).
- **Fix:** Use `zod` or `ajv` to validate the response shape before saving. Retry once if validation fails.

#### 2.5 Source Text Truncation is Arbitrary
- **File:** `src/app/api/generate-lesson/route.ts` line 67: `sourceText.slice(0, 8000)`
- **Issue:** 8K chars of your textbook might be mid-sentence. The LLM gets cut-off context.
- **Fix:** Use CoT — "summarize the source material in 2000 words for context, then generate."

#### 2.6 Credit Refund on LLM Failure is RACE-PRONE
- **File:** `src/app/api/generate-lesson/route.ts` line 168
- **Issue:** `await supabase.rpc("add_user_credits", { user_id_input: user_id, amount: 1 })` runs AFTER `JSON.parse()` fails. If the LLM takes 30s and Vercel times out at 60s, the refund may not execute = user loses a credit.
- **Fix:** Use a database trigger or a separate "transactions" table with a pending state that auto-refunds on timeout.

#### 2.7 Status Page is a LIE
- **File:** `src/app/dashboard/status/[id]/page.tsx` — ENTIRE FILE
- **Issue:** Hardcoded progress bar from 0→100 over ~15 seconds. No actual status polling. Fake ".pptx downloads" buttons. No real queue. No real "Building Your Lesson" status.
- **Impact:** User thinks their lesson is rendering for 3-5 minutes when it's actually already done and they just got redirected to `/dashboard/lesson/[id]`.
- **Fix:** Kill this page. Or wire real status poller using the `lessons` table `status` column.

#### 2.8 `supabase-middleware.ts` Calls DB on Every Request
- **File:** `src/lib/supabase-middleware.ts` line 31-33
- **Issue:** `supabase.auth.getUser()` makes a network roundtrip on every single render/Dashboard route. Slows everything. Can fail under load.
- **Fix:** Use session cookies with middleware — check JWT locally rather than calling Supabase auth.

#### 2.9 Settings Page Doesn't Save Anything
- **File:** `src/app/dashboard/settings/page.tsx`
- **Issue:** Every input is uncontrolled (`defaultValue`, no `onChange`, no `useState`). The "Save Settings" button does nothing. School name, mascot, colors — none of it persists.
- **Impact:** User re-enters school info on every lesson.
- **Fix:** Create `user_settings` table + CRUD API + wire save button.

#### 2.10 No Lesson History / List
- **Issue:** The dashboard has no "My Lessons" view. Once you leave the lesson page, you can't get back except via manual URL.
- **Fix:** Add a lessons list to the dashboard or a sidebar nav.

### 🟡 MEDIUM — Annoying / Missing

#### 2.11 No Payment Integration
- Access codes work, but no Stripe, no way to buy credits. Revenue = $0 unless you manually create and sell codes.

#### 2.12 No Email on Generation Complete
- After 3-5 min generation, user gets no notification. If they close the tab, they don't know it's done.

#### 2.13 `includePhotos` Toggle Does Nothing
- Checkbox exists but no image generation API is called. The LLM just sets `has_image=true` and `image_search_query`, but no actual images are produced.

#### 2.14 No Real PPTX/DOCX Download
- The lesson view shows JSON in the browser. No file export yet. Your v2 Python engine produced actual .pptx and .docx.
- **Fix:** Port the Python rendering engine to an API route, or use a JS PPTX library like `pptxgenjs`.

#### 2.15 `class_list` is Hardcoded, Not User-Configurable
- The 5 CTE classes are baked into the dashboard. Settings page has a visual list but doesn't persist.

#### 2.16 No Duplicate Lesson Prevention
- User can click "Generate" twice and burn 2 credits for the same file/config.
- **Fix:** Disable button + show generating state globally.

---

## 3. WHAT'S LEFT TO BUILD

### P0 — Must Have Before You Charge
1. **Fix Settings Persistence** — `user_settings` table, API, wire save button
2. **Add Lesson History** — List previous lessons on dashboard
3. **Real File Export** — PPTX/DOCX from lesson JSON (port v2 Python or use `pptxgenjs`)
4. **Validate LLM JSON** — Schema validation + retry on bad output
5. **Kill Fake Status Page** — Or make it real with polling
6. **Stripe Integration** — Buy credits (even just a simple credit pack)

### P1 — Needed for Scale
7. **Image OCR** — PDFs with embedded images, scanned pages
8. **Email notifications** — Resend or Supabase hooks
9. **Class configs persisted** — Per-class standards docs, period lengths
10. **Rate limiting** — Per-user generation limits (DeepSeek has rate limits)

### P2 — Nice to Have
11. **Audit engine** — Port the v2 auditor to check LLM output before saving
12. **Surge pricing** — Dynamic credit cost based on load
13. **Admin dashboard** — Create/manage access codes, view usage

---

## 4. ARCHITECTURAL DECISIONS MADE

| Decision | Why | Trade-off |
|----------|-----|-----------|
| Magic links (not password) | Avoided OAuth Google issues | Users check spam, some districts block magic links |
| Supabase SSR (not auth-helpers) | Newer, supported by Supabase | Middleware complexity, cookie handling is fragile |
| Access codes (not Stripe-first) | Faster to ship | Manual revenue, no self-serve |
| OpenRouter (not DeepSeek direct) | Key management, fallback models | Extra network hop, paid intermediary |
| Server-side extraction | No client complexity | Can't OCR images in browser |
| JSON in DB (not files) | Simple, queryable | Large lessons = large JSONB, slower queries |

---

## 5. SUPABASE SCHEMA SUMMARY

```
access_codes         — code, uses remaining, credits_per_use
user_credits         — user_id, remaining_credits
lessons              — user_id, status, class_name, topic, source_text, generated_json, credits_used

RPC Functions:
  decrement_code_uses(code_input text)           — atomic code use
  add_user_credits(user_id_input uuid, amount)   — add/upsert credits
  burn_credit(user_id_input uuid, amount)        — atomic debit (returns bool)
```

**What's missing from v2:** `code_uses` (audit trail of who used what code), `credit_transactions` (ledger for refunds/disputes), `user_settings`.

---

## 6. ENVIRONMENT VARIABLES

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=...
```

**Missing:** Stripe keys, Resend/SendGrid key, Google Vision / OCR key.

---

## 7. FILE INVENTORY

```
src/
  app/
    api/
      extract-text/route.ts     ← real PDF/DOCX/TXT extraction
      generate-lesson/route.ts  ← LLM caller + credit burn + save
      redeem-code/route.ts      ← code validation + credit add
    auth/callback/route.ts      ← magic link session exchange
    dashboard/
      layout.tsx                ← force-dynamic, wraps shell
      page.tsx                  ← main form (upload/configure/review)
      shell.tsx                 ← header with credits, code redeem, nav
      settings/page.tsx         ← FAKE UI — no persistence
      status/[id]/page.tsx      ← FAKE progress — hardcoded
      lesson/[id]/page.tsx      ← renders generated JSON (works)
    page.tsx                    ← landing + magic link form
    layout.tsx                  ← root layout
  components/ui/                ← shadcn components (Button, Card, Input, etc.)
  lib/
    supabase-browser.ts         ← client-side Supabase
    supabase-server.ts          ← server-side (cookies)
    supabase-middleware.ts      ← auth guard on /dashboard/*
    utils.ts                    ← cn() helper

supabase/migrations/
  001_access_codes.sql          ← codes + credits + RPC functions
  002_lessons.sql               ← lessons table + burn_credit RPC
```

---

## 8. THE HONEST TRUTH

**What's shipping:** Auth works. Credits work. Extraction works. Generation calls DeepSeek and saves JSON. Lesson view renders it.

**What's NOT shipping:** No file downloads. No persisted settings. No lesson history. The status page lies. The LLM prompt is a lightweight version of your v2 schema. Image uploads are useless. Payment = manual access codes only.

**Time to production-ready:** 2-3 focused sessions on the P0 items above.
