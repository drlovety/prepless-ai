export const dynamic = "force-dynamic";

import DashboardShell from "./shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
