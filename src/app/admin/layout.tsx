export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";
import { Shield, ArrowLeft, LayoutDashboard, Users, AlertTriangle, BookOpen, Ticket } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = await isAdmin(user.id);
  if (!admin) redirect("/dashboard");

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="border-b px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-red-600" />
            <h1 className="text-lg font-bold">Admin Portal</h1>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <Link href="/dashboard">
            <span className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </span>
          </Link>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r bg-muted/20 shrink-0 flex flex-col">
          <nav className="p-3 space-y-1">
            <AdminNavItem href="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
            <AdminNavItem href="/admin/users" icon={<Users className="h-4 w-4" />} label="Users" />
            <AdminNavItem href="/admin/codes" icon={<Ticket className="h-4 w-4" />} label="Codes" />
            <AdminNavItem href="/admin/lessons" icon={<BookOpen className="h-4 w-4" />} label="Lessons" />
            <AdminNavItem href="/admin/errors" icon={<AlertTriangle className="h-4 w-4" />} label="LLM Errors" />
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

function AdminNavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
