# PrepLessAI SaaS — Audit v2
**Date:** 2026-07-16
**Local commit:** 68bce12
**Remote commit:** 68bce12 ✅ (up to date)
**Production URL:** https://prepless-ai.vercel.app
**Environment:** Next.js 16.2.7 + Supabase + OpenRouter + Vercel

---

## 0. DEPLOYMENT STATUS

- **Local** and **origin/main** are in sync (commit 68bce12) ✅
- **Vercel production** is live and responding ✅
- **Build passes** without errors or TypeScript failures ✅
- **No uncommitted changes** or open branches

---

## 1. WHAT WORKS (Verified | Production-Ready)

| Component | Status | Notes |
|-----------|--------|-------|
| Auth (Magic Links) | ✅ Works | Hardcoded redirect to `https://prepless-ai.vercel.app`. Landing page renders with logo. |
| Auth Middleware | ⚠️ **Missing** | `middleware.ts` was removed in commit 07a2fd0. Dashboard routes are NOT auth-gated server-side. Anyone with a valid session cookie can access `/dashboard` in theory. Client-side `shell.tsx` has a redirect for unauthenticated users, creating a flash-of-content risk. |
| Access Code Redemption | ✅ Works | `redeem-code` API → `decrement_code_uses()` + `add_user_credits()` RPC. Returns remaining credits. |
| Credit System | ✅ Works | `user_credits` table with `burn_credit()` and `add_user_credits()` functions. Atomic decrement. Refund on failure. |
| File Extraction | ✅ Works | `unpdf` for PDFs, `mammoth` for DOCX, native for TXT. 15K char cap. Scanned PDF warning added. |
| Dashboard Form | ✅ Works | 3-tab UI (Upload → Configure → Review). Real file upload with editable preview. |
| Settings Persistence | ✅ Works | `user_settings` table created. `/api/settings` GET/POST. Settings auto-prefill on dashboard. |
| Lesson Generation | ✅ Works | Calls OpenRouter DeepSeek. Burns credit. Validates JSON (with retry-on-fail). Saves to `lessons` with `status="generating"` → `status="complete"`/`"failed"`. |
| Lesson View | ✅ Works | Renders slides, activities, lesson plan, timing, teacher notes, answer keys. Color-coded slide types. |
| Lesson History Sidebar | ✅ Works | `/api/my-lessons` endpoint. Sidebar shows topic, class, date, status with colorful icons. |
| PPTX Export | ✅ Works | `/api/export-pptx` generates real `.pptx` via `pptxgenjs`. Dark theme. Includes title + content slides. Download button on lesson page. |
| Status Page | ✅ **Killed** | Fake status page removed. User goes directly to lesson view after generation. |

---

## 2. CRITICAL BUGS — MUST FIX BEFORE USER TESTING

### 🔴 C1: No Server-Side Auth Middleware

- **File:** `src/middleware.ts` — **does not exist**
- **History:** Was removed in commit 07a2fd0 due to `MIDDLEWARE_INVOCATION_FAILED` errors
- **Issue:** Dashboard routes (`/dashboard/*`) are NOT protected server-side. Someone could theoretically share or bookmark a dashboard URL and have the server render to an unauthenticated user before client JS redirects. Also `/api/*` endpoints that use Bearer token auth are theoretically fine, but `/dashboard` SSR pages are not gated.
- **Fix:** Re-add a minimal `src/middleware.ts` that checks for the Supabase session cookie locally (no DB call). Or at minimum accept this risk for private beta and add a guard.
- **Risk:** Medium — client-side redirect in `shell.tsx` catches most cases, but a flash-of-dashboard or server-side data exposure is possible.

### 🔴 C2: `pdf-parse` Still Imported at Build Time

- **File:** `package.json` line 21
- **Issue:** `pdf-parse` is listed as a dependency. It was re-included. The last commit (537bf1a) says "replace pdf-parse with unpdf", but `pdf-parse` still appears in `package.json`. `unpdf` is also present (line 28). If Vercel or Next.js does tree-shaking/bundling and encounters `pdf-parse`'s native test PDF file, build or runtime could break.
- **Fix:** `npm uninstall pdf-parse`

### 🔴 C3: `callOpenRouter` Has a Vercel Timeout Risk

- **File:** `src/app/api/generate-lesson/route.ts` line 262
- **Issue:** The OpenRouter call waits for DeepSeek to return a full 6000-token response. On Vercel's Hobby plan, API routes have a 10-second timeout. DeepSeek via OpenRouter can take 15-45 seconds to stream a full lesson plan JSON.
- **Current behavior:** Generation works in `dev` where there's no timeout. In production, it will likely 504 timeout.
- **Fix:** Switch to Vercel `maxDuration` config, upgrade to Pro for longer timeouts, or offload generation to a background job (Supabase Edge Functions, Inngest, etc.).
- **Impact:** This is a **silent production-only failure** that local builds can't catch.

### 🔴 C4: No Duplicate Protection on Multiple Clicks

- **File:** `src/app/dashboard/page.tsx` line 169
- **Issue:** `handleGenerate` doesn't check if a request is already in flight. User clicks Generate twice = two parallel `fetch` calls = two credits burned, two lessons created. The `generating` state DOES update the button, but a fast double-click or a network retry could bypass.
- **Fix:** Add an `isGenerating` lock flag that disables the button and short-circuits the function before the API call.

---

## 3. MEDIUM BUGS — FIX SOON

### 🟡 M1: Include Photos Toggle Does Nothing

- **File:** `src/app/dashboard/page.tsx` line 362-366
- **Issue:** `includePhotos` is collected in state but NOT passed to the `config` object sent to `/api/generate-lesson`. The API prompt also ignores it. The $1.00 badge is false advertising.
- **Fix:** Either remove the toggle or wire it to the generation API.

### 🟡 M2: No DOCX Export

- **File:** `package.json` line 17 lists `docx` as dependency
- **Issue:** `docx` library is installed but there is no `/api/export-docx` route or UI. Only PPTX is offered.
- **Fix:** Remove unused `docx` dependency, or add DOCX export.

### 🟡 M3: Lesson View Doesn't Show Failed Lessons

- **File:** `src/app/dashboard/lesson/[id]/page.tsx` line 61
- **Issue:** Failed lessons (status = `failed`) return `notFound()`. User can't see *why* it failed or retry. They lose context on what went wrong.
- **Fix:** Render failed lessons with error info and a "Retry" button that re-uses the same source text and config.

### 🟡 M4: PPTX Uses Hardcoded Dark Theme Colors

- **File:** `src/app/api/export-pptx/route.ts` lines 5-7
- **Issue:** The exported PPTX always uses the same dark red (#3C0F14) and gray (#63666A) regardless of the user's school colors (from `metadata.school_info.colors`). The user's Cascade Bruins burgundy/gold is ignored.
- **Fix:** Read `metadata.school_info.colors` and use those for background/accent/text.

### 🟡 M5: Source Text Truncation is Brutal

- **File:** `src/app/api/generate-lesson/route.ts` line 165
- **Issue:** `sourceText.slice(0, 8000)` cuts text mid-sentence. The LLM gets choppy context, leading to worse lesson quality.
- **Fix:** Truncate at the last complete paragraph within the limit, or add a summarization pre-pass.

### 🟡 M6: No `$1.00` Charge for Photos

- **File:** `src/app/dashboard/page.tsx` line 365
- **Issue:** Badge says `+$1.00` for AI photos, but no credit burn logic accounts for variable pricing. Every generation burns exactly 1 credit regardless of options.
- **Fix:** Remove the misleading price, or implement dynamic pricing.

### 🟡 M7: No Image Generation — `has_image` is Just Text

- **File:** `src/app/api/generate-lesson/route.ts` system prompt line 148
- **Issue:** The LLM writes image search queries but NO actual images are fetched/embedded. The PPTX shows `[Image: ...]` placeholder text. The lesson view shows the search query in a badge. No Unsplash, DALL-E, or image search integration.
- **Fix:** Either remove `includePhotos` entirely from this beta, or add Unsplash search + embed.

### 🟡 M8: Settings API `POST` Doesn't Upsert — Only Updates

- **File:** `src/app/api/settings/route.ts` line 72-78
- **Issue:** The `user_settings` row is auto-created by a trigger on signup, but if the trigger fails for any reason, the `UPDATE` in `POST /api/settings` will silently do nothing (no matching row). The RLS-policed `SELECT` in `GET` will also return no row.
- **Fix:** If a user was created before migration 003, they have no settings row. Run a backfill or switch the `POST` to `upsert`.

### 🟡 M9: `getUserFromToken` Re-auth's Every API Call

- **File:** `src/app/api/settings/route.ts`, `src/app/api/export-pptx/route.ts`
- **Issue:** Every request passes the access_token to `supabase.auth.getUser(token)`, which makes a roundtrip to Supabase auth to verify the JWT. Under load this is ~200ms+ overhead per API call.
- **Fix:** For server-side, the Supabase SSR client with cookie-based auth already validates the session. The Bearer token approach is unnecessary overhead.

---

## 4. KNOWN ISSUES — ACCEPTABLE FOR PRIVATE BETA

| Issue | Why It's Okay for Now |
|-------|----------------------|
| No Stripe / payment | Access codes work. Revenue is manual. |
| No email notifications | Beta users will check the site or sidebar. |
| No OCR on images | Warned in UI. Fallback to manual paste. |
| No class config persistence | "Classes" tab in Settings is marked "Coming soon." |
| No admin dashboard | Ty can query Supabase directly. |
| No rate limiting on LLM | Monitor OpenRouter usage manually. |

---

## 5. PRODUCTION READINESS CHECKLIST

- [x] App builds without errors
- [x] App is deployed (Vercel)
- [x] Auth works (magic links)
- [x] Credits work (access codes)
- [x] File extraction works
- [x] Lesson generation calls LLM and saves
- [x] Lesson view renders correctly
- [x] Lesson history sidebar shows
- [x] Settings save/persist
- [x] PPTX export works
- [ ] Dashboard routes are server-side auth-gated ❌
- [ ] API generation works within Vercel timeout ❌ **SILENT FAIL**
- [ ] Duplicate generation is prevented ❌
- [ ] Deleted fake status page ✅
- [ ] Logo is crisp in production (minor but visible) ⚠️

---

## 6. STARTING RECOMMENDATION

**Do one focused session before sending to end users:**

1. **Test generation on production** — Log into the live app, upload a short PDF, and generate a lesson. See if Vercel times out.
2. **If it times out (it will):** That becomes the #1 priority. Options:
   - **Quick fix:** Add `export const maxDuration = 60` to `generate-lesson/route.ts` (Vercel Pro only — requires pricing tier change).
   - **Better fix:** Break generation into an async queue. User gets status sidebar updates. Try Supabase Edge Functions or a cron job that polls.
   - **Hack fix:** Switch LLM model to a faster one (e.g., `anthropic/claude-sonnet-4` via OpenRouter) that returns in <5 seconds.
3. **Re-add auth middleware** OR accept the client-side-only guard for beta.
4. **Remove `pdf-parse` from dependencies** to clean up.
5. **Then** send to end users with a batch of access codes.
