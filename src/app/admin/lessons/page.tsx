"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Clock, CheckCircle, XCircle, AlertTriangle, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface LessonRow {
  id: string;
  user_email: string;
  status: string;
  class_name: string | null;
  topic: string | null;
  credits_used: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  error_type: string | null;
}

const statusOptions = ["all", "pending", "complete", "failed"];

export default function AdminLessons() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchLessons();
  }, [statusFilter]);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const url = `/api/admin/lessons?limit=100${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load lessons");
      setLessons(data.lessons ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending": return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <BookOpen className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "complete": return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Complete</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lessons</h2>
          <p className="text-muted-foreground">{lessons.length} lessons loaded</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {lessons.map((l) => (
          <Card key={l.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {statusIcon(l.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{l.topic || "Untitled"}</p>
                      {statusBadge(l.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">{l.class_name || "No class"} · {l.user_email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {formatDate(l.created_at)}
                      {l.started_at && ` · Started ${formatDate(l.started_at)}`}
                      {l.completed_at && ` · Done ${formatDate(l.completed_at)}`}
                    </p>
                    {l.error_message && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {l.error_type}: {l.error_message.slice(0, 120)}{l.error_message.length > 120 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {l.credits_used > 0 ? `-${l.credits_used} credit` : "Free (admin)"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
