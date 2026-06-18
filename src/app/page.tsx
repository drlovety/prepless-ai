"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);

    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: "https://prepless-ai.vercel.app/auth/callback",
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex items-center justify-center">
          <img
            src="/prepless-logo.jpg"
            alt="PrepLessAI"
            className="h-24 w-auto"
          />
        </div>
        <p className="text-muted-foreground text-lg">
          Generate classroom-ready CTE lesson plans in minutes. No prep, just teach.
        </p>

        {sent ? (
          <div className="space-y-4 p-6 bg-muted rounded-lg">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
            <h3 className="font-semibold">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn't get it? Check spam. Or{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="underline hover:text-foreground"
              >
                try a different email
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Magic Link"
              )}
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground">
          Private beta. Access code required after login.
        </p>
      </div>
    </div>
  );
}
