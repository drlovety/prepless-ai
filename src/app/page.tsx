"use client";

import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function Home() {
  const supabase = createClient();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <BookOpen className="h-10 w-10" />
          <span className="font-bold text-3xl tracking-tight">PrepLessAI</span>
        </div>
        <p className="text-muted-foreground text-lg">
          Generate classroom-ready CTE lesson plans in minutes. No prep, just teach.
        </p>
        <Button size="lg" className="w-full" onClick={handleLogin}>
          Continue with Google
        </Button>
        <p className="text-xs text-muted-foreground">
          Private beta. Access code required after login.
        </p>
      </div>
    </div>
  );
}
