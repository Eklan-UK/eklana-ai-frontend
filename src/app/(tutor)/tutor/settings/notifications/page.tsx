"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bell, BellOff, Loader2, AlertCircle, Smartphone } from "lucide-react";
import { useWebPush } from "@/hooks/useWebPush";

export default function TutorNotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = useWebPush();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const isBrave =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((navigator as any).brave?.isBrave ||
      window.navigator.userAgent.includes("Brave"));

  const getPushStatus = () => {
    if (!isSupported) {
      return {
        status: "unsupported",
        text: isBrave
          ? "Check Brave Shields settings"
          : "Not supported in this browser",
        color: "text-amber-500",
      };
    }
    if (permission === "denied") {
      return {
        status: "denied",
        text: "Blocked — enable in browser settings",
        color: "text-red-500",
      };
    }
    if (isSubscribed) {
      return {
        status: "enabled",
        text: "Push notifications enabled",
        color: "text-green-600",
      };
    }
    return {
      status: "disabled",
      text: "Click to enable",
      color: "text-gray-500",
    };
  };

  const pushStatus = getPushStatus();
  const canTogglePush = isSupported && permission !== "denied";

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-6" />
        <Header showBack title="Notifications" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="h-6" />
      <Header showBack title="Notifications" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="text-sm text-gray-600 mb-4">
          Turn on browser notifications for class updates, student drill activity,
          and other tutor alerts when you&apos;re not in the app.
        </p>

        <Card
          className={`${isSubscribed ? "border-green-200 bg-green-50/50" : "border-gray-200"}`}
        >
          <div className="flex items-start gap-4 p-1">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                isSubscribed ? "bg-green-100" : "bg-gray-100"
              }`}
            >
              {isSubscribed ? (
                <Bell className="w-6 h-6 text-green-600" />
              ) : (
                <BellOff className="w-6 h-6 text-gray-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">
                  Browser notifications
                </h3>
                <span className={`text-xs font-medium ${pushStatus.color}`}>
                  {pushStatus.text}
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Works when this site is open in a tab or in the background
                (depending on your browser).
              </p>

              {error && (
                <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                variant={isSubscribed ? "outline" : "primary"}
                size="sm"
                onClick={handleTogglePush}
                disabled={!canTogglePush || isLoading}
                className={isSubscribed ? "" : "bg-green-600 hover:bg-green-700"}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isSubscribed ? "Disabling…" : "Enabling…"}
                  </>
                ) : isSubscribed ? (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Disable notifications
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Enable notifications
                  </>
                )}
              </Button>

              {permission === "denied" && (
                <p className="text-xs text-gray-500 mt-3">
                  Use the lock icon in the address bar to allow notifications for
                  this site.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="mt-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                In-app bell
              </p>
              <p className="text-xs text-gray-600">
                You may still see alerts inside the app. Push settings above
                control browser notifications when you&apos;re away.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
