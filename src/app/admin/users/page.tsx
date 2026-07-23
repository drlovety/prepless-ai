"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface UserRow {
  id: string;
  email: string;
  school_name: string;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  remaining_credits: number;
  total_lessons: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/users?limit=100", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
      <div>
        <h2 className="text-2xl font-bold">Users</h2>
        <p className="text-muted-foreground">{users.length} total users</p>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.school_name}</p>
                  </div>
                  {u.is_admin && <Badge variant="destructive">Admin</Badge>}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" />
                    {u.remaining_credits} credits
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {u.total_lessons} lessons
                  </span>
                  <span className="text-xs">Joined {formatDate(u.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
