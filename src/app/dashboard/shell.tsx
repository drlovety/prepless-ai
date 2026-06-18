"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogOut, Settings, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/");
        return;
      }
      setUser(data.user);
      loadCredits(supabase, data.user.id);
      setLoading(false);
    });
  }, []);

  const loadCredits = async (supabaseClient: any, userId: string) => {
    const { data } = await supabaseClient
      .from("user_credits")
      .select("remaining_credits")
      .eq("user_id", userId)
      .single();
    setRemainingCredits(data?.remaining_credits ?? 0);
  };

  const handleRedeemCode = async () => {
    setCodeError("");
    setCodeSuccess("");
    if (!accessCode.trim()) { setCodeError("Enter a code"); return; }
    if (!user) { setCodeError("Not logged in"); return; }
    const res = await fetch("/api/redeem-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: accessCode.trim(), user_id: user.id }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      setCodeError(data?.error || "Invalid or expired code");
      return;
    }
    setCodeSuccess(`${data.remaining_credits} credits`);
    setRemainingCredits(data.remaining_credits);
    setAccessCode("");
    setShowCodeInput(false);
    setTimeout(() => setCodeSuccess(""), 3000);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const isNewLesson = pathname === "/dashboard";
  const isSettings = pathname === "/dashboard/settings";

  if (loading) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="border-b px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/prepless-logo.jpg"
              alt="PrepLessAI"
              className="h-8 w-auto"
            />
          </div>
          <div className="flex items-center gap-3">
            {showCodeInput ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Access code"
                  className="w-32 h-8 text-sm"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRedeemCode()}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleRedeemCode} disabled={!accessCode.trim()}>
                  Redeem
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowCodeInput(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Badge
                  variant={remainingCredits > 0 ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setShowCodeInput(true)}
                >
                  {remainingCredits} credit{remainingCredits !== 1 ? "s" : ""}
                </Badge>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowCodeInput(true)}>
                  <Ticket className="h-4 w-4" />
                </Button>
              </>
            )}
            {codeError && <span className="text-xs text-red-500">{codeError}</span>}
            {codeSuccess && <span className="text-xs text-green-600">{codeSuccess}</span>}
            {isNewLesson ? (
              <Link href="/dashboard/settings">
                <Button variant="ghost" size="sm"><Settings className="h-4 w-4 mr-1" /> Settings</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm"><Plus className="h-4 w-4 mr-1" /> New Lesson</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
