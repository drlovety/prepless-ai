import { describe, it, expect } from "vitest";

function burnCredit(currentCredits: number): { ok: boolean; remaining: number; error?: string } {
  if (currentCredits <= 0) {
    return { ok: false, remaining: 0, error: "Insufficient credits" };
  }
  return { ok: true, remaining: currentCredits - 1 };
}

function refundCredit(currentCredits: number): { ok: boolean; remaining: number } {
  return { ok: true, remaining: currentCredits + 1 };
}

describe("credit system", () => {
  it("burns a credit when user has balance", () => {
    const result = burnCredit(5);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("fails to burn when user has zero credits", () => {
    const result = burnCredit(0);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Insufficient credits");
  });

  it("refunds a credit back to user", () => {
    const result = refundCredit(3);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("never goes negative on burn", () => {
    const result = burnCredit(1);
    expect(result.remaining).toBe(0);
    expect(result.ok).toBe(true);
  });
});
