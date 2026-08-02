"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Copy, Check, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface AccessCode {
  id: string;
  code: string;
  credits: number;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(1);
  const [creditsPerCode, setCreditsPerCode] = useState(10);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/codes", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load codes");
      setCodes(data.codes ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCodes = async () => {
    try {
      setGenerating(true);
      setError("");
      setNewCodes([]);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          count,
          credits_per_use: creditsPerCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate codes");
      setNewCodes(data.codes ?? []);
      loadCodes();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Access Codes</h2>
        <p className="text-muted-foreground">Generate and manage access codes for credits.</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Generate New Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Quantity</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Credits per code</label>
              <Input
                type="number"
                min={1}
                value={creditsPerCode}
                onChange={(e) => setCreditsPerCode(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <Button onClick={generateCodes} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
            Generate {count > 1 ? `${count} Codes` : "Code"}
          </Button>

          {newCodes.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-2">
              <p className="text-sm font-medium text-green-800">Generated codes — copy and share:</p>
              <div className="flex flex-wrap gap-2">
                {newCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => copyCode(code)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border rounded-md text-sm font-mono hover:bg-green-100 transition-colors"
                  >
                    {code}
                    {copied === code ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Existing Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No codes generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Code</th>
                    <th className="text-left py-2 px-3 font-medium">Credits</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Used By</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="py-2 px-3 font-mono">{c.code}</td>
                      <td className="py-2 px-3">{c.credits}</td>
                      <td className="py-2 px-3">
                        <span className={c.used ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
                          {c.used ? "Used" : "Available"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{c.used_by ? "Yes" : "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
