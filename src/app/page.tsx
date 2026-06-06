import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Shield, Upload } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <span className="font-semibold text-lg tracking-tight">PrepLessAI</span>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Lesson plans in minutes,
            <br />
            <span className="text-muted-foreground">not hours.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Upload your textbook, slides, or source material. Pick a page range. 
            Get a complete, ready-to-teach lesson with activities, assessments, and handouts.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                <Upload className="h-4 w-4" />
                Start Prepping
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="space-y-3">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Save Time</h3>
            <p className="text-sm text-muted-foreground">
              Transform source material into a full lesson plan in under 20 minutes.
            </p>
          </div>
          <div className="space-y-3">
            <Shield className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">Your Material, Protected</h3>
            <p className="text-sm text-muted-foreground">
              Uploads are processed and deleted within 24 hours. Nothing stored.
            </p>
          </div>
          <div className="space-y-3">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">CTE-First</h3>
            <p className="text-sm text-muted-foreground">
              Built for Career & Technical Education. Real activities, real rigor.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        <p>© 2026 PrepLessAI. Built for teachers, by a teacher.</p>
      </footer>
    </div>
  );
}
