"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface ErrorRow {
  id: string;
  lesson_id: string;
  user_email: string;
  error_type: string;
  error_message: string;
  attempt_number: number;
  model_used: string | null;
  created_at: string;
}

const errorTypes = ["all", "timeout", "validation", "openrouter", "other"];

export default function AdminErrors() {
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchErrors();
  }, [typeFilter]);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const url = `/api/admin/llm-errors?limit=100${typeFilter !== "all" ? `&error_type=${typeFilter}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load errors");
      setErrors(data.errors ?? []);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errorMsg) return <p className="text-red-500">{errorMsg}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">LLM Errors</h2>
          <p className="text-muted-foreground">{errors.length} errors loaded</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
          >
            {errorTypes.map((t) => (
              <option key={t} value={t}>{t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {errors.map((e) => (
          <Card key={e.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">{e.error_type}</Badge>
                    <span className="text-xs text-muted-foreground">Attempt #{e.attempt_number}</span>
                    {e.model_used && <Badge variant="outline" className="text-xs">{e.model_used}</Badge>}
                  </div>
                  <p className="text-sm font-mono text-red-700 bg-red-50 rounded p-2 mt-1 break-words">
                    {e.error_message}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{e.user_email}</span>
                    <span>Lesson: {e.lesson_id.slice(0, 8)}…</span>
                    <span>{formatDate(e.created_at)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
