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
import { Upload, Shield, BookOpen, AlertTriangle, FileText, Image, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Simulate OCR preview
      setTimeout(() => {
        setExtractedText("Sole Proprietorship — one owner, unlimited liability, easy to start...\n\nPartnership — General and Limited partnerships...\n\nLLC — Limited Liability Company, hybrid structure...");
        setShowPreview(true);
      }, 800);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <span className="font-semibold text-lg tracking-tight">PrepLessAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm">Settings</Button>
            </Link>
            <Button variant="outline" size="sm">Logout</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">New Lesson</h1>
            <p className="text-muted-foreground">Upload your source material and configure your lesson.</p>
          </div>

          <Tabs defaultValue="upload" className="space-y-6">
            <TabsList>
              <TabsTrigger value="upload">1. Upload</TabsTrigger>
              <TabsTrigger value="configure">2. Configure</TabsTrigger>
              <TabsTrigger value="review">3. Review & Generate</TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-6">
              {/* Warnings */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Uploads are processed and deleted within 24 hours. We do not store your source material.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  By uploading, you confirm you have permission to use this material from the content creator or publisher.
                </AlertDescription>
              </Alert>

              {/* Upload Zone */}
              <Card>
                <CardHeader>
                  <CardTitle>Source Material</CardTitle>
                  <CardDescription>Upload a photo, PDF, or Word document containing the content you want to teach.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div
                    className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PNG, JPG up to 20MB</p>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                      onChange={handleUpload}
                    />
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

                  {/* Page Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-page">Start Page / Section</Label>
                      <Input
                        id="start-page"
                        placeholder="e.g. 47"
                        value={startPage}
                        onChange={(e) => setStartPage(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-page">End Page / Section</Label>
                      <Input
                        id="end-page"
                        placeholder="e.g. 52"
                        value={endPage}
                        onChange={(e) => setEndPage(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Text Preview */}
              {showPreview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Extracted Text Preview
                    </CardTitle>
                    <CardDescription>Does this look correct? If not, try a clearer photo or PDF.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={extractedText}
                      onChange={(e) => setExtractedText(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      You can edit the extracted text before generating the lesson.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Configure Tab */}
            <TabsContent value="configure" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lesson Configuration</CardTitle>
                  <CardDescription>Select the class and options for this lesson.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Class / Subject</Label>
                    <Select value={selectedClass} onValueChange={(val) => setSelectedClass(val ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {CTE_CLASSES.map((cls) => (
                          <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Class Period Length</Label>
                      <Select defaultValue="50">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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

            {/* Review Tab */}
            <TabsContent value="review" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Review & Generate</CardTitle>
                  <CardDescription>Double-check everything before we build your lesson.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Source</span>
                      <span className="font-medium">{uploadedFile?.name || "Not uploaded"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Page Range</span>
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
                      <span className="text-muted-foreground">Estimated Cost</span>
                      <span className="font-medium">$3.00</span>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      You need an access code to generate lessons. Enter your code or contact your administrator.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="access-code">Access Code</Label>
                    <Input id="access-code" placeholder="Enter your access code" />
                  </div>

                  <Button className="w-full" size="lg" disabled={!uploadedFile || !selectedClass}>
                    Generate Lesson ($3.00)
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
