"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Clock, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function StatusPage() {
  const [progress, setProgress] = useState(15);
  const [status, setStatus] = useState("extracting"); // extracting, generating, auditing, rendering, complete
  const [queuePosition, setQueuePosition] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus("complete");
          return 100;
        }
        if (prev > 80) setStatus("rendering");
        else if (prev > 60) setStatus("auditing");
        else if (prev > 30) setStatus("generating");
        else if (prev > 10) setStatus("extracting");
        return prev + 8;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const statusLabels: Record<string, { label: string; color: string }> = {
    extracting: { label: "Extracting text from your upload...", color: "bg-blue-500" },
    generating: { label: "Building lesson content...", color: "bg-amber-500" },
    auditing: { label: "Running quality audit...", color: "bg-purple-500" },
    rendering: { label: "Rendering PowerPoint and handouts...", color: "bg-emerald-500" },
    complete: { label: "Done! Your lesson is ready.", color: "bg-green-500" },
  };

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {status === "complete" ? "Lesson Ready!" : "Building Your Lesson"}
          </h1>
          <p className="text-muted-foreground">
            {status === "complete"
              ? "Your materials are rendered and ready to download."
              : `You are #${queuePosition} in the queue. Sit tight — this usually takes 3-5 minutes.`}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{statusLabels[status].label}</span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { key: "extracting", icon: FileText, label: "Extract" },
                { key: "generating", icon: Loader2, label: "Generate" },
                { key: "auditing", icon: CheckCircle, label: "Audit" },
                { key: "rendering", icon: Clock, label: "Render" },
                { key: "complete", icon: Download, label: "Done" },
              ].map((step) => {
                const isActive = status === step.key;
                const isDone = progress >= 100 || (
                  step.key === "extracting" && progress > 30) ||
                  (step.key === "generating" && progress > 60) ||
                  (step.key === "auditing" && progress > 80) ||
                  (step.key === "rendering" && progress > 90);
                return (
                  <div key={step.key} className={`flex flex-col items-center gap-1 p-2 rounded-lg ${isActive ? "bg-muted" : ""}`}>
                    <step.icon className={`h-5 w-5 ${isDone ? "text-green-500" : isActive ? "text-foreground" : "text-muted-foreground"}`} />
                    <span className={`text-xs ${isDone || isActive ? "font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lesson Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Class</span>
              <span className="font-medium">Business / Finance</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium">Textbook Chapter 3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pages</span>
              <span className="font-medium">47 — 52</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period Length</span>
              <span className="font-medium">50 minutes</span>
            </div>
          </CardContent>
        </Card>

        {status === "complete" && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Downloads Ready
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Button className="w-full justify-between" variant="outline">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Lesson Slides (.pptx)
                  </span>
                  <Badge variant="secondary">12 slides</Badge>
                </Button>
                <Button className="w-full justify-between" variant="outline">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Teacher Notes (.docx)
                  </span>
                  <Badge variant="secondary">3 pages</Badge>
                </Button>
                <Button className="w-full justify-between" variant="outline">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Student Handout (.docx)
                  </span>
                  <Badge variant="secondary">1 page</Badge>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Files are available for 24 hours. An email has also been sent.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
