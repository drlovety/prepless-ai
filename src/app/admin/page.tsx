"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, CreditCard, BookOpen, AlertTriangle, Clock, TrendingUp, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalCredits: number;
  totalCreditsDistributed: number;
  generationsToday: number;
  generationsThisWeek: number;
  pendingGenerations: number;
  failedGenerations: number;
  avgGenerationTimeMin: number | null;
  totalErrorsToday: number;
  totalErrorsThisWeek: number;
  totalLessons: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load stats");
      setStats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (!stats) return null;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: <Users className="h-5 w-5 text-blue-500" /> },
    { label: "New Today", value: stats.newUsersToday, icon: <TrendingUp className="h-5 w-5 text-green-500" /> },
    { label: "New This Week", value: stats.newUsersThisWeek, icon: <TrendingUp className="h-5 w-5 text-green-600" /> },
    { label: "Credits in Circulation", value: stats.totalCredits, icon: <CreditCard className="h-5 w-5 text-amber-500" /> },
    { label: "Credits Distributed", value: stats.totalCreditsDistributed, icon: <CreditCard className="h-5 w-5 text-amber-600" /> },
    { label: "Total Lessons", value: stats.totalLessons, icon: <BookOpen className="h-5 w-5 text-purple-500" /> },
    { label: "Generations Today", value: stats.generationsToday, icon: <Activity className="h-5 w-5 text-indigo-500" /> },
    { label: "Generations This Week", value: stats.generationsThisWeek, icon: <Activity className="h-5 w-5 text-indigo-600" /> },
    { label: "Pending", value: stats.pendingGenerations, icon: <Clock className="h-5 w-5 text-blue-400" /> },
    { label: "Failed", value: stats.failedGenerations, icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
    { label: "Errors Today", value: stats.totalErrorsToday, icon: <AlertTriangle className="h-5 w-5 text-orange-500" /> },
    { label: "Avg Gen Time", value: stats.avgGenerationTimeMin ? `${stats.avgGenerationTimeMin.toFixed(1)}m` : "—", icon: <Clock className="h-5 w-5 text-gray-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Overview of the platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
