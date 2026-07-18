"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { Clock, CheckCircle, XCircle, Loader2, Wallet, History } from "lucide-react";

interface Lesson {
  id: string;
  class_name: string | null;
  topic: string | null;
  status: string;
  created_at: string;
  credits_used: number;
}

interface CreditLedgerEntry {
  id: string;
  type: "debit" | "redemption" | "refund" | "purchase" | "adjustment";
  amount: number;
  description: string;
  created_at: string;
}

export default function SidebarLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CreditLedgerEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      setSessionToken(session.access_token);
      fetchLessons(session.access_token);
      fetchCredits(supabase, session.access_token);
    });
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const fetchLessons = async (token: string) => {
    try {
      const res = await fetch("/api/my-lessons", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLessons(data.lessons ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async (supabaseClient: any, token: string) => {
    const res = await fetch("/api/my-credits", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setRemainingCredits(data.remaining_credits ?? 0);
  };

  const fetchHistory = async (token: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/credit-history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setHistory(data.transactions ?? []);
    } catch {}
    setHistoryLoading(false);
  };

  const toggleHistory = async (token: string) => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) fetchHistory(token);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete": return <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />;
      case "failed": return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
      case "generating": return <Loader2 className="h-3 w-3 text-amber-500 animate-spin shrink-0" />;
      case "pending": return <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="w-64 bg-muted/30 flex flex-col overflow-hidden border-r shrink-0">
      <div className="p-3 border-b shrink-0">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Lessons</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-xs text-red-500 px-2 py-4">{error}</p>}
        {!loading && lessons.length === 0 && (
          <div className="px-2 py-6 text-center">
            <p className="text-xs text-muted-foreground">No lessons yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Generate one to get started.</p>
          </div>
        )}
        {lessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/dashboard/lesson/${lesson.id}`}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors group"
          >
            {statusIcon(lesson.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-foreground">{lesson.topic || "Untitled"}</p>
              <p className="text-xs text-muted-foreground truncate">{lesson.class_name || "No class"}</p>
              <p className="text-xs text-muted-foreground">{formatDate(lesson.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Credit Footer ── */}
      <div className="border-t p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{remainingCredits} credit{remainingCredits !== 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={() => toggleHistory(sessionToken)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-3 w-3" />
            {showHistory ? "Hide" : "History"}
          </button>
        </div>

        {showHistory && (
          <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2 bg-background">
            {historyLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            )}
            {!historyLoading && history.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No history yet.</p>
            )}
            {!historyLoading && history.map((entry) => {
              const isCredit = entry.type === "redemption" || entry.type === "refund" || entry.type === "purchase";
              return (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 mr-2 text-muted-foreground" title={entry.description}>
                    {formatDate(entry.created_at)} — {entry.description}
                  </span>
                  <span className={`font-mono shrink-0 ${isCredit ? "text-green-600" : "text-red-500"}`}>
                    {isCredit ? "+" : "-"}{entry.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
