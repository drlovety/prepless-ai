"use client";

import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type ExportFormat = "pptx" | "docx" | "activity";

export default function DownloadButtons({ lessonId, files }: { lessonId: string; files?: Record<string, string> }) {
  const [loading, setLoading] = useState<Record<ExportFormat, boolean>>({ pptx: false, docx: false, activity: false });

  const handleDownload = async (format: ExportFormat) => {
    setLoading((prev) => ({ ...prev, [format]: true }));
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading((prev) => ({ ...prev, [format]: false })); return; }

    try {
      const body: any = { lesson_id: lessonId };
      if (format === "activity") body.type = "activity";

      const res = await fetch(`/api/export-${format === "activity" ? "docx" : format}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 302 && res.headers.get("location")) {
        // Redirect from Supabase Storage — just open it
        window.open(res.headers.get("location")!, "_blank");
        setLoading((prev) => ({ ...prev, [format]: false }));
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || `Failed to generate ${format.toUpperCase()}`);
        setLoading((prev) => ({ ...prev, [format]: false }));
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.split('filename="')[1]?.replace('"', '') || `lesson.${format === "activity" ? "docx" : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed");
    }
    setLoading((prev) => ({ ...prev, [format]: false }));
  };

  const hasFiles = files && (files.pptx_url || files.lesson_docx_url || files.activity_docx_url);

  return (
    <div className="flex gap-2 flex-wrap">
      <Button onClick={() => handleDownload("pptx")} disabled={loading.pptx} variant="outline" size="sm">
        {loading.pptx ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
        PPTX
      </Button>
      <Button onClick={() => handleDownload("docx")} disabled={loading.docx} variant="outline" size="sm">
        {loading.docx ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
        Lesson DOCX
      </Button>
      <Button onClick={() => handleDownload("activity")} disabled={loading.activity} variant="outline" size="sm">
        {loading.activity ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
        Activity DOCX
      </Button>
    </div>
  );
}
