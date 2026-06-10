export const dynamic = "force-dynamic";

import DashboardShell from "./shell";
import SidebarLessons from "./sidebar-lessons";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <div className="flex flex-1 overflow-hidden">
        <SidebarLessons />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </DashboardShell>
  );
}
