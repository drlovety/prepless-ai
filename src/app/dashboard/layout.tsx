"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, LogOut, Settings, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/");
        return;
      }
      setUser(data.user);
      loadCredits(data.user.id);
      setLoading(false);
    });
  }, []);

  const loadCredits = async (userId: string) => {
    const { data } = await supabase
      .from("user_credits")
      .select("remaining_credits")
      .eq("user_id", userId)
      .single();
    setRemainingCredits(data?.remaining_credits ?? 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const isNewLesson = pathname === "/dashboard";
  const isSettings = pathname === "/dashboard/settings";

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <span className="font-semibold text-lg tracking-tight">PrepLessAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={remainingCredits > 0 ? "default" : "secondary"}>
              {remainingCredits} credit{remainingCredits !== 1 ? "s" : ""}
            </Badge>
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
