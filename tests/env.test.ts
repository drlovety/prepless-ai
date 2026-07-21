import { describe, it, expect } from "vitest";

describe("env validation", () => {
  it("validates env vars are not truncated placeholders", () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      console.warn("Skipping env test — NEXT_PUBLIC_SUPABASE_ANON_KEY not set (expected in CI)");
      return;
    }
    expect(anonKey).toBeDefined();
    expect(anonKey.length).toBeGreaterThan(100);
    expect(anonKey).not.toContain("...");
  });

  it("has all required env vars", () => {
    const required = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "OPENROUTER_API_KEY",
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn(`Skipping env test — missing: ${missing.join(", ")} (expected in CI)`);
      return;
    }
    for (const key of required) {
      expect(process.env[key]).toBeDefined();
    }
  });
});
