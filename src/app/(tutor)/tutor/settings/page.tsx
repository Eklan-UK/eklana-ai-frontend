"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import {
  User,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  CalendarSync,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import {
  useDisconnectTutorGoogleCalendar,
  useTutorGoogleCalendarStatus,
} from "@/hooks/useClasses";

export default function TutorSettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const [calendarBanner, setCalendarBanner] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const { data: googleStatus, isLoading: googleStatusLoading } =
    useTutorGoogleCalendarStatus();
  const disconnectCalendar = useDisconnectTutorGoogleCalendar();

  const handleDisconnectGoogle = () => {
    if (
      !window.confirm(
        "Are you sure? This will prevent you from scheduling new classes until you reconnect.",
      )
    ) {
      return;
    }
    disconnectCalendar.mutate();
  };

  /* OAuth redirect renders query params once — sync banner from URL */
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot read of calendar=* query after redirect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cal = params.get("calendar");
    const reason = params.get("reason");
    if (cal === "connected") {
      setCalendarBanner({
        kind: "success",
        message: "Google Calendar connected. You can be scheduled for classes.",
      });
    } else if (cal === "error") {
      const label =
        reason === "no_refresh_token"
          ? "No refresh token from Google. Try disconnecting the app in your Google account and connect again."
          : reason === "invalid_state"
            ? "This connect link expired. Start connect again from this page."
            : reason === "not_configured"
              ? "Calendar OAuth is not configured on the server."
              : reason === "token_exchange"
                ? "Could not complete Google authorization. Try again."
                : reason
                  ? `Something went wrong (${reason}).`
                  : "Could not connect Google Calendar.";
      setCalendarBanner({ kind: "error", message: label });
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleConnectGoogle = () => {
    window.location.href = `${window.location.origin}/api/v1/tutor/google-calendar/connect`;
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Logged out successfully");
      router.push("/auth/login");
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to logout";
      toast.error(msg);
    } finally {
      setLoggingOut(false);
    }
  };

  const settingsSections = [
    {
      title: "Account",
      items: [
        {
          icon: User,
          label: "Profile Settings",
          href: "/tutor/settings/profile",
          description: "Update your personal information",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: Bell,
          label: "Notifications",
          href: "/tutor/settings/notifications",
          description: "Manage notification preferences",
        },
        {
          icon: CalendarSync,
          label: "Google Calendar",
          href: "#google-calendar",
          description: googleStatusLoading
            ? "Checking connection..."
            : googleStatus?.connected
              ? "Connected"
              : "Connect required for class scheduling",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Help & Support",
          href: "/tutor/settings/help",
          description: "Get help and contact support",
        },
        {
          icon: Shield,
          label: "Privacy Policy",
          href: "/privacy",
          description: "Read our privacy policy",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <Header title="Settings" />

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {calendarBanner ? (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              calendarBanner.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
            role="status"
          >
            {calendarBanner.message}
          </div>
        ) : null}
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <Link key={itemIndex} href={item.href}>
                    <Card className="hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {item.label}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div id="google-calendar" className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Integrations
          </h2>
          <Card className={googleStatus?.connected ? "border-emerald-200" : "border-amber-200"}>
            <div className="flex items-center justify-between p-4 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <CalendarSync className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Google Calendar</h3>
                  <p className="text-sm text-gray-600">
                    {googleStatusLoading
                      ? "Checking connection..."
                      : googleStatus?.connected
                        ? "Connected. You can be scheduled for classes."
                        : "Not connected. Connect before admins can schedule your classes."}
                  </p>
                </div>
              </div>
              {googleStatus?.connected ? (
                <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-center text-xs font-semibold text-emerald-700">
                    Connected
                  </span>
                  <button
                    type="button"
                    disabled={disconnectCalendar.isPending}
                    onClick={handleDisconnectGoogle}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    {disconnectCalendar.isPending
                      ? "Disconnecting…"
                      : "Disconnect Google Calendar"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2d6a32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#245528]"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  Connect Google
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Logout */}
        <div className="mt-8">
          <Card className="border-red-200">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-red-600">
                    {loggingOut ? "Logging out…" : "Logout"}
                  </h3>
                  <p className="text-sm text-gray-600">Sign out of your account</p>
                </div>
              </div>
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

