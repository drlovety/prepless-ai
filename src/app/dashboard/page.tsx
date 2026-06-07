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
import { Upload, Shield, AlertTriangle, FileText, Image, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/"); return; }
      setUser(data.user);
      if (data.user) loadCredits(data.user.id);
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setTimeout(() => {
        setExtractedText("Sole Proprietorship — one owner...\n\nPartnership — General and Limited...\n\nLLC — Limited Liability Company...");
        setShowPreview(true);
      }, 800);
    }
  };

  return (
    <main className="flex-1 px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">New Lesson</h1>
          <p className="text-muted-foreground">Upload your source material and configure your lesson.</p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">1. Upload</TabsTrigger>
            <TabsTrigger value="configure">2. Configure</TabsTrigger>
            <TabsTrigger value="review">3. Review &amp; Generate</TabsTrigger>
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
                  <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val ?? "")}>
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
                    <Select defaultValue="50">
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
                    <Select defaultValue="standard">
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
                    <input type="checkbox" id="journal" className="h-4 w-4" defaultChecked />
                    <Label htmlFor="journal" className="text-sm font-normal">Include journal prompt / bell ringer</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="essential" className="h-4 w-4" defaultChecked />
                    <Label htmlFor="essential" className="text-sm font-normal">Include essential questions</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="photos" className="h-4 w-4" />
                    <Label htmlFor="photos" className="text-sm font-normal flex items-center gap-2">
                      Include AI-generated photos / illustrations
                      <Badge variant="outline" className="text-xs">+$1.00</Badge>
                    </Label>
                    <Image className="h-4 w-4 text-muted-foreground ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review &amp; Generate</CardTitle>
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
                    <span className="font-medium">50 minutes</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium">1 credit</span>
                  </div>
                </div>

                {remainingCredits === 0 ? (
                  <>
                    <Alert>
                      <AlertDescription>You need an access code to generate lessons.</AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="access-code">Access Code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="access-code"
                          placeholder="Enter your access code"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                        />
                        <Button onClick={handleRedeemCode} disabled={!accessCode.trim()}>Redeem</Button>
                      </div>
                      {codeError && <p className="text-sm text-red-500">{codeError}</p>}
                      {codeSuccess && <p className="text-sm text-green-600">{codeSuccess}</p>}
                    </div>
                  </>
                ) : (
                  <Alert>
                    <AlertDescription>You have {remainingCredits} credit{remainingCredits !== 1 ? "s" : ""} remaining. Each lesson costs 1 credit.</AlertDescription>
                  </Alert>
                )}

                <Button className="w-full" size="lg" disabled={!uploadedFile || !selectedClass || remainingCredits === 0}>
                  {remainingCredits > 0 ? "Generate Lesson (1 credit)" : "Enter Access Code"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
