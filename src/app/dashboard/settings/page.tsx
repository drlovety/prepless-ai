"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { School, Palette, Wrench, Upload } from "lucide-react";
import { useState } from "react";

const CTE_CLASSES = [
  "Business / Finance",
  "Digital Photography",
  "Economics",
  "Student Store",
  "Independent Living",
];

export default function SettingsPage() {
  const [classes, setClasses] = useState([
    { id: 1, name: "Business / Finance", periodLength: "50", standards: null as File | null },
    { id: 2, name: "Digital Photography", periodLength: "50", standards: null as File | null },
  ]);

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
                    <Input id="school-name" placeholder="e.g. Cascade High School" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mascot">Mascot</Label>
                    <Input id="mascot" placeholder="e.g. Bruins" />
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
                      <Input type="color" defaultValue="#1e40af" className="h-10 w-16 p-1" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Secondary</Label>
                      <Input type="color" defaultValue="#f59e0b" className="h-10 w-16 p-1" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Accent</Label>
                      <Input type="color" defaultValue="#ffffff" className="h-10 w-16 p-1" />
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
                <CardDescription>Add each class with its framework or standards.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {classes.map((cls) => (
                  <div key={cls.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{cls.name}</h4>
                      <Badge variant="outline">Period {cls.periodLength} min</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Class Name</Label>
                        <Input defaultValue={cls.name} />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Period Length</Label>
                        <Select defaultValue={cls.periodLength}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="50">50 min</SelectItem>
                            <SelectItem value="55">55 min</SelectItem>
                            <SelectItem value="90">90 min (block)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Standards / Framework Document
                      </Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                        <p className="text-sm text-muted-foreground">Upload state standards, district framework, or pacing guide (PDF)</p>
                        <p className="text-xs text-muted-foreground mt-1">This stays with your class config</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full">+ Add Another Class</Button>
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
                    { label: "Journal / Bell Ringer", desc: "Include a daily journal prompt" },
                    { label: "Essential Questions", desc: "List EQs at the start of each lesson" },
                    { label: "Exit Ticket", desc: "5-minute assessment at end of period" },
                    { label: "Include Handouts", desc: "Student activity sheets when relevant" },
                    { label: "Include Card Sets", desc: "Matching, sort, or term cards for activities" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <input type="checkbox" defaultChecked={item.label !== "Include Card Sets"} className="h-5 w-5" />
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Default Rigor Level</p>
                      <p className="text-sm text-muted-foreground">Higher rigor = more application, less recall</p>
                    </div>
                    <Select defaultValue="standard">
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="rigorous">Rigorous</SelectItem>
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
                <CardDescription>Tell us what you have available so we design realistic activities.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Colored paper / cardstock",
                  "Laminator",
                  "Printer (student access)",
                  "Computers / Chromebooks",
                  "Projector / Smartboard",
                  "Scissors / glue / markers",
                  "Whiteboards / markers",
                  "Internet access",
                ].map((resource) => (
                  <div key={resource} className="flex items-center justify-between py-2">
                    <span className="text-sm">{resource}</span>
                    <input type="checkbox" className="h-4 w-4" />
                  </div>
                ))}
                <div className="space-y-2 pt-2">
                  <Label>Other Resources</Label>
                  <Textarea placeholder="e.g. Cricut machine, 3D printer, workshop tools..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3">
          <Button variant="outline">Cancel</Button>
          <Button>Save Settings</Button>
        </div>
      </div>
    </main>
  );
}
