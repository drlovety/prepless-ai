"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Shield, AlertTriangle, FileText, Image, CheckCircle, Loader2, Clock, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CTE_CLASSES = [
  "Business / Finance",
  "Digital Photography",
  "Economics",
  "Student Store",
  "Independent Living",
];

export default function Dashboard() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [user, setUser] = useState<any>(null);
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

  // ── Generation state ──
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [scanWarning, setScanWarning] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingNotice, setPendingNotice] = useState("");

  // ── Config state ──
  const [duration, setDuration] = useState("50");
  const [rigor, setRigor] = useState("standard");
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeEssential, setIncludeEssential] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [unit, setUnit] = useState("");
  const [dayNumber, setDayNumber] = useState("1");
  const [topic, setTopic] = useState("");
  const [schoolName, setSchoolName] = useState("Cascade High School");
  const [schoolMascot, setSchoolMascot] = useState("Bruins");
  const [primaryColor, setPrimaryColor] = useState("#8B0000");
  const [secondaryColor, setSecondaryColor] = useState("#FFD700");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [classConfigs, setClassConfigs] = useState<Record<string, any>>({});

  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setUser(data.user);
      if (data.user) {
        loadCredits(supabase, data.user.id);
        loadSettings(supabase, data.user.id);
      }
    });
  }, []);

  const loadCredits = async (supabaseClient: any, userId: string) => {
    const { data } = await supabaseClient
      .from("user_credits")
      .select("remaining_credits")
      .eq("user_id", userId)
      .single();
    setRemainingCredits(data?.remaining_credits ?? 0);
  };

  const loadSettings = async (supabaseClient: any, userId: string) => {
    const { data } = await supabaseClient
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) {
      setSchoolName(data.school_name || "Cascade High School");
      setSchoolMascot(data.mascot || "Bruins");
      setPrimaryColor(data.primary_color || "#8B0000");
      setSecondaryColor(data.secondary_color || "#FFD700");
      setDuration(data.default_duration || "50");
      setRigor(data.default_rigor || "standard");
      setIncludeJournal(!!data.include_journal);
      setIncludeEssential(!!data.include_essential_questions);
      if (data.class_configs) {
        setClassConfigs(data.class_configs);
      }
    }
    setSettingsLoaded(true);
  };

  const handleRedeemCode = async () => {
    setCodeError("");
    setCodeSuccess("");
    if (!accessCode.trim()) { setCodeError("Enter a code"); return; }
    if (!user) { setCodeError("Not logged in"); return; }
    const res = await fetch("/api/redeem-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: accessCode.trim(), user_id: user.id }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      setCodeError(data?.error || "Invalid or expired code");
      return;
    }
    setCodeSuccess(`Code redeemed! ${data.remaining_credits} credits available.`);
    setRemainingCredits(data.remaining_credits);
    setAccessCode("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setShowPreview(false);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/extract-text", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setGenError(data.error || "Failed to extract text from file");
      return;
    }

    setExtractedText(data.text);
    setScanWarning(
      data.isScanned
        ? "Scanned/image PDF detected. Text extraction is limited. If the preview below looks empty or incomplete, please paste the source text directly into the preview box."
        : ""
    );
    setShowPreview(true);
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (generating) return; // already in flight
    setGenError("");
    setPendingNotice("");
    setShowConfirm(true);
  };

  const handleConfirmGenerate = async () => {
    setShowConfirm(false);
    if (!user) return;
    setGenError("");
    setGenerating(true);

    const classConfig = classConfigs[selectedClass] || {};

    const config = {
      class_name: selectedClass,
      unit: unit || "Unit 3",
      day_number: parseInt(dayNumber) || 1,
      topic: topic || selectedClass,
      duration_min: parseInt(duration),
      rigor,
      include_journal: includeJournal,
      include_essential: includeEssential,
      school_name: schoolName,
      school_city: "Everett",
      school_state: "WA",
      school_mascot: schoolMascot,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      class_config: classConfig,
    };

    const res = await fetch("/api/generate-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        source_text: extractedText,
        config,
      }),
    });

    const data = await res.json();
    setGenerating(false);

    if (!res.ok || !data.success) {
      setGenError(data.error || "Generation failed. Try again.");
      return;
    }

    // Burn one credit locally (server already did it)
    setRemainingCredits((prev) => Math.max(0, prev - 1));

    // Show pending notice — user is notified when ready
    setPendingNotice(
      `Your lesson "${config.topic || config.class_name}" is being generated. You'll get a notification when it's ready.`
    );
  };

  const canGenerate = uploadedFile && selectedClass && remainingCredits > 0 && !generating;

  return (
    <main className="flex-1 px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">New Lesson</h1>
          <p className="text-muted-foreground">Upload your source material and configure your lesson.</p>
        </div>

        {genError && (
          <Alert variant="destructive">
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        {pendingNotice && (
          <Alert className="border-green-500 bg-green-50 text-green-900">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="flex items-center justify-between">
              <span>{pendingNotice}</span>
            </AlertDescription>
          </Alert>
        )}

        {scanWarning && (
          <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription>{scanWarning}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">1. Upload</TabsTrigger>
            <TabsTrigger value="configure">2. Configure</TabsTrigger>
            <TabsTrigger value="review">3. Review & Generate</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>Uploads are deleted within 24 hours. We do not store your source material.</AlertDescription>
            </Alert>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>By uploading, you confirm permission to use this material.</AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Source Material</CardTitle>
                <CardDescription>Upload a photo, PDF, or Word document.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PNG, JPG up to 20MB</p>
                  <input id="file-upload" type="file" className="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={handleUpload} />
                </div>

                {uploadedFile && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Badge variant="secondary">Ready</Badge>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-page">Start Page</Label>
                    <Input id="start-page" placeholder="e.g. 47" value={startPage} onChange={(e) => setStartPage(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-page">End Page</Label>
                    <Input id="end-page" placeholder="e.g. 52" value={endPage} onChange={(e) => setEndPage(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit Name / Number (optional)</Label>
                  <Input id="unit" placeholder="e.g. Unit 3: Business Structures" value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="day-number">Day Number</Label>
                    <Input id="day-number" placeholder="1" value={dayNumber} onChange={(e) => setDayNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic (optional)</Label>
                    <Input id="topic" placeholder="e.g. Types of Business Ownership" value={topic} onChange={(e) => setTopic(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {showPreview && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Extracted Text Preview
                  </CardTitle>
                  <CardDescription>Edit if it does not look correct.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows={6} className="resize-none" />
                  <p className="text-xs text-muted-foreground mt-2">You can edit the extracted text before generating.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="configure" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Lesson Configuration</CardTitle>
                <CardDescription>Select the class and options.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Class / Subject</Label>
                  <Select value={selectedClass} onValueChange={(val) => {
                    const cls = val ?? "";
                    setSelectedClass(cls);
                    // Auto-populate from class config
                    const cfg = classConfigs[cls];
                    if (cfg) {
                      setDuration(String(cfg.period_length || "50"));
                      setRigor(cfg.rigor || "standard");
                      setIncludeJournal((cfg.always_include || []).includes("journal"));
                      setIncludeEssential((cfg.always_include || []).includes("essential_question"));
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {CTE_CLASSES.map((cls) => (
                        <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Period Length</Label>
                    <Select value={duration} onValueChange={(val) => setDuration(val ?? "50")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="50">50 minutes</SelectItem>
                        <SelectItem value="55">55 minutes</SelectItem>
                        <SelectItem value="90">90 minutes (block)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rigor Level</Label>
                    <Select value={rigor} onValueChange={(val) => setRigor(val ?? "standard")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="rigorous">Rigorous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="journal" className="h-4 w-4" checked={includeJournal} onChange={(e) => setIncludeJournal(e.target.checked)} />
                    <Label htmlFor="journal" className="text-sm font-normal">Include journal prompt / bell ringer</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="essential" className="h-4 w-4" checked={includeEssential} onChange={(e) => setIncludeEssential(e.target.checked)} />
                    <Label htmlFor="essential" className="text-sm font-normal">Include essential questions</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="photos" className="h-4 w-4" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
                    <Label htmlFor="photos" className="text-sm font-normal flex items-center gap-2">
                      Include AI-generated photos / illustrations
                      <Badge variant="outline" className="text-xs">+$1.00</Badge>
                    </Label>
                    <Image className="h-4 w-4 text-muted-foreground ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>School Branding</CardTitle>
                <CardDescription>Customize with your school info.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="school-name">School Name</Label>
                  <Input id="school-name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school-mascot">Mascot</Label>
                  <Input id="school-mascot" value={schoolMascot} onChange={(e) => setSchoolMascot(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Primary Color</Label>
                    <div className="flex gap-2">
                      <input type="color" id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 rounded border" />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <div className="flex gap-2">
                      <input type="color" id="secondary-color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 rounded border" />
                      <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review & Generate</CardTitle>
                <CardDescription>Double-check before generating.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium">{uploadedFile?.name || "Not uploaded"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Pages</span>
                    <span className="font-medium">{startPage || "—"} to {endPage || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium">{selectedClass || "Not selected"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Period Length</span>
                    <span className="font-medium">{duration} minutes</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Rigor</span>
                    <span className="font-medium capitalize">{rigor}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium">1 credit</span>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    You have {remainingCredits} credit{remainingCredits !== 1 ? "s" : ""} remaining.
                    Each lesson costs 1 credit.
                  </AlertDescription>
                </Alert>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : remainingCredits > 0 ? (
                    "Generate Lesson (1 credit)"
                  ) : (
                    "Enter Access Code Above"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Lesson?</DialogTitle>
              <DialogDescription>
                This will use <strong>1 credit</strong> to generate a full lesson plan
                with slides, activities, and teacher notes from your uploaded material.
                <br /><br />
                Class: <strong>{selectedClass || "—"}</strong>
                <br />
                Topic: <strong>{topic || selectedClass || "—"}</strong>
                <br />
                Duration: <strong>{duration} minutes</strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Generate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
