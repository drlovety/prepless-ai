import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, BookOpen, Lightbulb, CheckCircle } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

interface Slide {
  slide_number: number;
  slide_type: string;
  content: Record<string, any>;
  has_image?: boolean;
  image_search_query?: string;
}

interface Activity {
  activity_id: string;
  activity_name: string;
  activity_type: string;
  duration_min: number;
  grouping: string;
  materials: string[];
  instructions_student_facing?: string;
  deliverables: Array<{ file_type: string; description: string }>;
}

interface LessonPlan {
  duration_breakdown: Array<{ segment: string; minutes: number; description: string }>;
  learning_objectives: string[];
  teacher_notes: string;
  answer_keys: Array<{ activity_id: string; answers: string }>;
  differentiation: { remedial?: string; advanced?: string };
}

interface LessonJson {
  metadata: {
    class_name: string;
    topic: string;
    class_duration_min: number;
    school_info?: { name: string; mascot: string };
  };
  slides: Slide[];
  activities: Activity[];
  lesson_plan: LessonPlan;
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lesson || lesson.status !== "complete") {
    notFound();
  }

  const json = lesson.generated_json as LessonJson;
  const metadata = json.metadata || {};
  const slides = json.slides || [];
  const activities = json.activities || [];
  const lessonPlan = json.lesson_plan || {};

  const slideTypeColors: Record<string, string> = {
    title: "bg-blue-100 text-blue-800",
    hook: "bg-amber-100 text-amber-800",
    learning_objective: "bg-green-100 text-green-800",
    journal_prompt: "bg-purple-100 text-purple-800",
    definition_concept: "bg-slate-100 text-slate-800",
    real_world_example: "bg-orange-100 text-orange-800",
    comparison: "bg-cyan-100 text-cyan-800",
    activity_intro: "bg-emerald-100 text-emerald-800",
    activity_recap: "bg-teal-100 text-teal-800",
    practice: "bg-indigo-100 text-indigo-800",
    exit_ticket: "bg-rose-100 text-rose-800",
    next_day_preview: "bg-violet-100 text-violet-800",
  };

  return (
    <main className="flex-1 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{metadata.topic || lesson.topic || "Untitled Lesson"}</h1>
            <Badge variant="secondary">{metadata.class_name || lesson.class_name}</Badge>
          </div>
          <p className="text-muted-foreground">
            {metadata.school_info?.name || "Your School"} · {metadata.class_duration_min || 50} minutes · {activities.length} activities
          </p>
        </div>

        {/* ── Learning Objectives ── */}
        {lessonPlan.learning_objectives && lessonPlan.learning_objectives.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Learning Objectives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {lessonPlan.learning_objectives.map((obj: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ── Slide Deck Preview ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Slide Deck ({slides.length} slides)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {slides.map((slide) => (
              <div key={slide.slide_number} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-6">{slide.slide_number}</span>
                  <Badge className={slideTypeColors[slide.slide_type] || "bg-gray-100 text-gray-800"}>
                    {slide.slide_type.replace(/_/g, " ")}
                  </Badge>
                  {slide.has_image && (
                    <Badge variant="outline" className="text-xs">Image: {slide.image_search_query}</Badge>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  {Object.entries(slide.content).map(([key, value]) => {
                    if (typeof value !== "string" || value.length === 0) return null;
                    return (
                      <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
                        <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                        <span className="text-sm">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Activities ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-emerald-500" />
              Activities ({activities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.map((act) => (
              <div key={act.activity_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{act.activity_name}</h3>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{act.duration_min} min</Badge>
                    <Badge variant="outline">{act.grouping.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
                {act.instructions_student_facing && (
                  <p className="text-sm text-muted-foreground">{act.instructions_student_facing}</p>
                )}
                {act.materials.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {act.materials.map((m) => (
                      <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                )}
                {act.deliverables && act.deliverables.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Deliverables: {act.deliverables.map((d) => d.description).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Lesson Plan / Teacher Notes ── */}
        {lessonPlan.duration_breakdown && lessonPlan.duration_breakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timing Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lessonPlan.duration_breakdown.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{seg.segment}</p>
                      <p className="text-xs text-muted-foreground">{seg.description}</p>
                    </div>
                    <Badge variant="secondary">{seg.minutes} min</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {lessonPlan.teacher_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teacher Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{lessonPlan.teacher_notes}</p>
            </CardContent>
          </Card>
        )}

        {lessonPlan.differentiation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lessonPlan.differentiation.remedial && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-orange-600">Remedial</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{lessonPlan.differentiation.remedial}</p>
                </CardContent>
              </Card>
            )}
            {lessonPlan.differentiation.advanced && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-purple-600">Advanced</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{lessonPlan.differentiation.advanced}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {lessonPlan.answer_keys && lessonPlan.answer_keys.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Answer Keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lessonPlan.answer_keys.map((ak, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <p className="font-medium text-sm mb-1">{ak.activity_id}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ak.answers}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
