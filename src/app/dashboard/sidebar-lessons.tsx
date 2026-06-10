"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Lesson {
  id: string;
  class_name: string | null;
  topic: string | null;
  status: string;
  created_at: string;
  credits_used: number;
}

export default function SidebarLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      fetchLessons(session.access_token);
    });
  }, []);

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

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete": return <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />;
      case "failed": return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
      case "generating": return <Loader2 className="h-3 w-3 text-amber-500 animate-spin shrink-0" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground shrink-0" />;
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    </div>
  );
}
