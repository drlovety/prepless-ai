"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { School, Palette, Wrench, Upload, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const CTE_CLASSES = [
  "Business / Finance",
  "Digital Photography",
  "Economics",
  "Student Store",
  "Independent Living",
];

interface Settings {
  school_name: string;
  mascot: string;
  city: string;
  state: string;
  primary_color: string;
  secondary_color: string;
  default_duration: string;
  default_rigor: string;
  include_journal: boolean;
  include_exit_ticket: boolean;
  include_essential_questions: boolean;
  include_handouts: boolean;
  include_card_sets: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  school_name: "Cascade High School",
  mascot: "Bruins",
  city: "Everett",
  state: "WA",
  primary_color: "#8B0000",
  secondary_color: "#FFD700",
  default_duration: "50",
  default_rigor: "standard",
  include_journal: true,
  include_exit_ticket: true,
  include_essential_questions: true,
  include_handouts: true,
  include_card_sets: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      loadSettings(session.access_token);
    });
  }, []);

  const loadSettings = async (token: string) => {
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaveStatus("error"); setSaving(false); return; }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
    setSaving(false);
  };

  const update = (key: keyof Settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <main className="flex-1 px-6 py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure your school, classes, and default lesson preferences.</p>
        </div>

        <Tabs defaultValue="school" className="space-y-6">
          <TabsList>
            <TabsTrigger value="school">School</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="school" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  School Profile
                </CardTitle>
                <CardDescription>Basic info that appears on your lesson materials.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="school-name">School Name</Label>
                    <Input id="school-name" value={settings.school_name} onChange={(e) => update("school_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mascot">Mascot</Label>
                    <Input id="mascot" value={settings.mascot} onChange={(e) => update("mascot", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={settings.city} onChange={(e) => update("city", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={settings.state} onChange={(e) => update("state", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    School Colors
                  </Label>
                  <div className="flex gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Primary</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={settings.primary_color} onChange={(e) => update("primary_color", e.target.value)} className="h-10 w-16 p-1 shrink-0" />
                        <Input value={settings.primary_color} onChange={(e) => update("primary_color", e.target.value)} className="w-28" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Secondary</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={settings.secondary_color} onChange={(e) => update("secondary_color", e.target.value)} className="h-10 w-16 p-1 shrink-0" />
                        <Input value={settings.secondary_color} onChange={(e) => update("secondary_color", e.target.value)} className="w-28" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="classes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Classes</CardTitle>
                <CardDescription>Coming soon — save class-specific period lengths and standards.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {CTE_CLASSES.map((cls, idx) => (
                  <div key={cls} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{cls}</h4>
                      <Badge variant="outline">Period 50 min</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Lesson Settings</CardTitle>
                <CardDescription>These apply to every lesson unless you override them.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {[
                    { key: "include_journal" as const, label: "Journal / Bell Ringer", desc: "Include a daily journal prompt" },
                    { key: "include_essential_questions" as const, label: "Essential Questions", desc: "List EQs at the start of each lesson" },
                    { key: "include_exit_ticket" as const, label: "Exit Ticket", desc: "5-minute assessment at end of period" },
                    { key: "include_handouts" as const, label: "Include Handouts", desc: "Student activity sheets when relevant" },
                    { key: "include_card_sets" as const, label: "Include Card Sets", desc: "Matching, sort, or term cards for activities" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2 border-b">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings[item.key]}
                        onChange={(e) => update(item.key, e.target.checked)}
                        className="h-5 w-5"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Default Rigor Level</p>
                      <p className="text-sm text-muted-foreground">Higher rigor = more application, less recall</p>
                    </div>
                    <Select value={settings.default_rigor} onValueChange={(val) => update("default_rigor", val)}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="rigorous">Rigorous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Default Period Length</p>
                      <p className="text-sm text-muted-foreground">Used when generating lessons</p>
                    </div>
                    <Select value={settings.default_duration} onValueChange={(val) => update("default_duration", val)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="50">50 min</SelectItem>
                        <SelectItem value="55">55 min</SelectItem>
                        <SelectItem value="90">90 min (block)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Classroom Resources
                </CardTitle>
                <CardDescription>Coming soon — resource-aware activity design.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Resource selection will inform which activity types are recommended.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-3">
          {saveStatus === "success" && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-500">Save failed. Try again.</span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
          </Button>
        </div>
      </div>
    </main>
  );
}
