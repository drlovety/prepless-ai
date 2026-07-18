"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { School, Palette, Wrench, Loader2, CheckCircle, ChevronDown, ChevronUp, Clock, Sliders, Target, BookOpen, Users, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const CTE_CLASSES = [
  "Business / Finance",
  "Digital Photography",
  "Economics",
  "Student Store",
  "Independent Living",
];

const ACTIVITY_TYPES = [
  "case_study", "gallery_walk", "discussion", "debate",
  "simulation", "hands_on", "peer_review", "sorting",
];

const SLIDE_TYPES = [
  "title", "hook", "learning_objective", "journal_prompt",
  "prior_review", "definition_concept", "real_world_example",
  "comparison", "activity_intro", "activity_recap",
  "practice", "exit_ticket", "next_day_preview",
];

const ALWAYS_INCLUDE_OPTIONS = [
  { key: "journal", label: "Journal / Bell Ringer" },
  { key: "exit_ticket", label: "Exit Ticket" },
  { key: "essential_question", label: "Essential Question" },
];

interface ClassConfig {
  period_length: number;
  target_slides: number;
  min_activities: number;
  max_activities: number;
  preferred_activity_types: string[];
  required_slide_types: string[];
  always_include: string[];
  rigor: string;
  real_world_anchor: string;
}

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
  class_configs: Record<string, ClassConfig>;
}

const DEFAULT_CLASS_CONFIG: ClassConfig = {
  period_length: 50,
  target_slides: 12,
  min_activities: 2,
  max_activities: 3,
  preferred_activity_types: ["case_study", "gallery_walk", "discussion"],
  required_slide_types: ["title", "hook", "learning_objective", "activity_intro", "activity_recap", "exit_ticket"],
  always_include: ["journal", "exit_ticket"],
  rigor: "standard",
  real_world_anchor: "Cascade High School and Snohomish County businesses",
};

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
  class_configs: Object.fromEntries(CTE_CLASSES.map((c) => [c, { ...DEFAULT_CLASS_CONFIG }])),
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

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
        const merged: Settings = { ...DEFAULT_SETTINGS, ...data.settings };
        // Deep merge class_configs
        if (data.settings.class_configs) {
          merged.class_configs = { ...DEFAULT_SETTINGS.class_configs, ...data.settings.class_configs };
          // Ensure each class has all keys
          for (const cls of CTE_CLASSES) {
            merged.class_configs[cls] = { ...DEFAULT_CLASS_CONFIG, ...(merged.class_configs[cls] || {}) };
          }
        }
        setSettings(merged);
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

  const update = (key: keyof Omit<Settings, "class_configs">, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateClassConfig = (className: string, key: keyof ClassConfig, value: any) => {
    setSettings((prev) => ({
      ...prev,
      class_configs: {
        ...prev.class_configs,
        [className]: { ...prev.class_configs[className], [key]: value },
      },
    }));
  };

  const toggleArrayItem = (className: string, key: "preferred_activity_types" | "required_slide_types" | "always_include", item: string) => {
    setSettings((prev) => {
      const current = prev.class_configs[className][key] || [];
      const next = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return {
        ...prev,
        class_configs: {
          ...prev.class_configs,
          [className]: { ...prev.class_configs[className], [key]: next },
        },
      };
    });
  };

  if (loading) {
    return (
      <main className="flex-1 px-6 py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-8 overflow-y-auto">
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
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Per-Class Lesson Roadmap
                </CardTitle>
                <CardDescription>
                  Configure how lessons are built for each class. The LLM follows this roadmap.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {CTE_CLASSES.map((cls) => {
                  const cfg = settings.class_configs[cls] || DEFAULT_CLASS_CONFIG;
                  const isExpanded = expandedClass === cls;
                  return (
                    <div key={cls} className="border rounded-lg">
                      <button
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedClass(isExpanded ? null : cls)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{cls}</span>
                          <Badge variant="outline">{cfg.period_length} min</Badge>
                          <Badge variant="outline">{cfg.target_slides} slides</Badge>
                          <Badge variant="outline">{cfg.min_activities}-{cfg.max_activities} activities</Badge>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-0 space-y-6 border-t">
                          {/* Period & Slide Count */}
                          <div className="grid grid-cols-3 gap-4 pt-4">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Clock className="h-3 w-3" /> Period Length
                              </Label>
                              <Select value={String(cfg.period_length)} onValueChange={(v) => updateClassConfig(cls, "period_length", parseInt(v || "50"))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="45">45 min</SelectItem>
                                  <SelectItem value="50">50 min</SelectItem>
                                  <SelectItem value="55">55 min</SelectItem>
                                  <SelectItem value="90">90 min (block)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Target className="h-3 w-3" /> Target Slides
                              </Label>
                              <Input type="number" min={5} max={25} value={cfg.target_slides} onChange={(e) => updateClassConfig(cls, "target_slides", parseInt(e.target.value) || 12)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Sliders className="h-3 w-3" /> Rigor
                              </Label>
                              <Select value={cfg.rigor} onValueChange={(v) => updateClassConfig(cls, "rigor", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="basic">Basic</SelectItem>
                                  <SelectItem value="standard">Standard</SelectItem>
                                  <SelectItem value="rigorous">Rigorous</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Activity Range */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Min Activities</Label>
                              <Input type="number" min={0} max={5} value={cfg.min_activities} onChange={(e) => updateClassConfig(cls, "min_activities", parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Activities</Label>
                              <Input type="number" min={1} max={6} value={cfg.max_activities} onChange={(e) => updateClassConfig(cls, "max_activities", parseInt(e.target.value) || 3)} />
                            </div>
                          </div>

                          {/* Preferred Activity Types */}
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Users className="h-3 w-3" /> Preferred Activity Types
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {ACTIVITY_TYPES.map((type) => (
                                <button
                                  key={type}
                                  onClick={() => toggleArrayItem(cls, "preferred_activity_types", type)}
                                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                                    (cfg.preferred_activity_types || []).includes(type)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  {type.replace("_", " ")}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Click to toggle. The LLM will prioritize these activity types.</p>
                          </div>

                          {/* Required Slide Types */}
                          <div className="space-y-2">
                            <Label>Required Slide Types</Label>
                            <div className="flex flex-wrap gap-2">
                              {SLIDE_TYPES.map((type) => (
                                <button
                                  key={type}
                                  onClick={() => toggleArrayItem(cls, "required_slide_types", type)}
                                  className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                                    (cfg.required_slide_types || []).includes(type)
                                      ? "bg-primary/90 text-primary-foreground border-primary/90"
                                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  {type.replace("_", " ")}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">These slide types MUST appear in every lesson.</p>
                          </div>

                          {/* Always Include */}
                          <div className="space-y-2">
                            <Label>Always Include</Label>
                            <div className="flex flex-wrap gap-4">
                              {ALWAYS_INCLUDE_OPTIONS.map((opt) => (
                                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={(cfg.always_include || []).includes(opt.key)}
                                    onChange={() => toggleArrayItem(cls, "always_include", opt.key)}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-sm">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Real-world anchor */}
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" /> Real-World Anchor
                            </Label>
                            <Textarea
                              value={cfg.real_world_anchor}
                              onChange={(e) => updateClassConfig(cls, "real_world_anchor", e.target.value)}
                              rows={2}
                              placeholder="e.g. Snohomish County businesses, Everett housing market..."
                            />
                            <p className="text-xs text-muted-foreground">Tells the LLM what local context to use for examples.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Lesson Settings</CardTitle>
                <CardDescription>These apply to every lesson unless overridden by a class config.</CardDescription>
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
          </Button>
        </div>
      </div>
    </main>
  );
}
