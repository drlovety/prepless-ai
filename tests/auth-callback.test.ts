import { describe, it, expect } from "vitest";

describe("auth callback", () => {
  it("computes redirect origin from x-forwarded headers", () => {
    const forwardedHost = "prepless-ai-production.up.railway.app";
    const forwardedProto = "https";
    const fallbackOrigin = "http://localhost:8100";

    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : fallbackOrigin;

    expect(origin).toBe("https://prepless-ai-production.up.railway.app");
    expect(origin).not.toContain("localhost");
  });

  it("falls back to request origin when no forwarded headers", () => {
    const forwardedHost = null;
    const forwardedProto = "https";
    const fallbackOrigin = "http://localhost:8100";

    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : fallbackOrigin;

    expect(origin).toBe("http://localhost:8100");
  });
});
