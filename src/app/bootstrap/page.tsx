"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function BootstrapAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Auto-attempt on load if logged in
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in to claim admin access.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to claim admin access.");
        return;
      }
      setResult("Admin access granted! Redirecting...");
      setTimeout(() => router.push("/admin/codes"), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-red-600" />
            Claim Admin Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </div>
          )}
          {result && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              {result}
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {!loading && !result && (
            <Button onClick={bootstrap} className="w-full">
              Claim Admin Access
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
