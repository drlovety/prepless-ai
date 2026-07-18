"use client";

import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type ExportFormat = "pptx" | "docx";

export default function DownloadButtons({ lessonId }: { lessonId: string }) {
  const [loading, setLoading] = useState<Record<ExportFormat, boolean>>({ pptx: false, docx: false });

  const handleDownload = async (format: ExportFormat) => {
    setLoading((prev) => ({ ...prev, [format]: true }));
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading((prev) => ({ ...prev, [format]: false })); return; }

    try {
      const res = await fetch(`/api/export-${format}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lesson_id: lessonId }),
      });

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
      a.download = res.headers.get("content-disposition")?.split('filename="')[1]?.replace('"', '') || `lesson.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed");
    }
    setLoading((prev) => ({ ...prev, [format]: false }));
  };

  return (
    <div className="flex gap-2">
      <Button onClick={() => handleDownload("pptx")} disabled={loading.pptx} variant="outline" size="sm">
        {loading.pptx ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
        PPTX
      </Button>
      <Button onClick={() => handleDownload("docx")} disabled={loading.docx} variant="outline" size="sm">
        {loading.docx ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
        DOCX
      </Button>
    </div>
  );
}
