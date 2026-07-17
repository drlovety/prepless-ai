"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogOut, Settings, Plus, Ticket, Bell, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  lesson_id: string | null;
  read: boolean;
  created_at: string;
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/");
        return;
      }
      setUser(data.user);
      loadCredits(supabase, data.user.id);
      loadNotifications(data.user.id);
      setLoading(false);
    });
  }, []);

  // Poll notifications every 15 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadNotifications(user.id);
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Close notification dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadCredits = async (supabaseClient: any, userId: string) => {
    const { data } = await supabaseClient
      .from("user_credits")
      .select("remaining_credits")
      .eq("user_id", userId)
      .single();
    setRemainingCredits(data?.remaining_credits ?? 0);
  };

  const loadNotifications = async (userId: string) => {
    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${(await createClient().auth.getSession()).data.session?.access_token || ""}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unread_count ?? 0);
  };

  const markRead = async (ids: string[], markAll = false) => {
    const token = (await createClient().auth.getSession()).data.session?.access_token;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
      body: JSON.stringify(markAll ? { mark_all: true } : { ids }),
    });
    loadNotifications(user?.id);
  };

  const handleRedeemCode = async () => {
    setCodeError("");
    setCodeSuccess("");
    if (!accessCode.trim()) { setCodeError("Enter a code"); return; }
    if (!user) { setCodeError("Not logged in"); return; }
    const res = await fetch("/api/redeem-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: accessCode.trim(), user_id: user.id }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      setCodeError(data?.error || "Invalid or expired code");
      return;
    }
    setCodeSuccess(`${data.remaining_credits} credits`);
    setRemainingCredits(data.remaining_credits);
    setAccessCode("");
    setShowCodeInput(false);
    setTimeout(() => setCodeSuccess(""), 3000);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const formatNotifTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const notifIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
      default: return <Bell className="h-4 w-4 text-blue-500 shrink-0" />;
    }
  };

  const isNewLesson = pathname === "/dashboard";
  const isSettings = pathname === "/dashboard/settings";

  if (loading) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="border-b px-6 py-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/prepless-logo.jpg"
              alt="PrepLessAI"
              className="h-8 w-auto"
            />
          </div>
          <div className="flex items-center gap-3">
            {showCodeInput ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Access code"
                  className="w-32 h-8 text-sm"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRedeemCode()}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleRedeemCode} disabled={!accessCode.trim()}>
                  Redeem
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowCodeInput(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Badge
                  variant={remainingCredits > 0 ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setShowCodeInput(true)}
                >
                  {remainingCredits} credit{remainingCredits !== 1 ? "s" : ""}
                </Badge>
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowCodeInput(true)}>
                  <Ticket className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <div className="absolute right-0 top-10 w-80 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => markRead([], true)}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                            !n.read ? "bg-blue-50/50" : ""
                          }`}
                          onClick={() => {
                            if (!n.read) markRead([n.id]);
                            if (n.lesson_id) {
                              router.push(`/dashboard/lesson/${n.lesson_id}`);
                              setShowNotifications(false);
                            }
                          }}
                        >
                          {notifIcon(n.type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{formatNotifTime(n.created_at)}</p>
                          </div>
                          {!n.read && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {codeError && <span className="text-xs text-red-500">{codeError}</span>}
            {codeSuccess && <span className="text-xs text-green-600">{codeSuccess}</span>}
            {isNewLesson ? (
              <Link href="/dashboard/settings">
                <Button variant="ghost" size="sm"><Settings className="h-4 w-4 mr-1" /> Settings</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm"><Plus className="h-4 w-4 mr-1" /> New Lesson</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
