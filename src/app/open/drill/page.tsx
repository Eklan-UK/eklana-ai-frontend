"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getMobileAppConfig } from "@/lib/mobile/app-config";
import {
  buildDrillAppDeepLink,
  buildDrillWebPath,
  isMobileUserAgent,
} from "@/lib/drill-open-url";

const APP_OPEN_FALLBACK_MS = 1500;

function OpenDrillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId");
  const assignmentId = searchParams.get("assignmentId") ?? undefined;

  const [status, setStatus] = useState<"opening" | "ready">("opening");

  const appDeepLink = useMemo(
    () => (drillId ? buildDrillAppDeepLink(drillId, assignmentId) : null),
    [drillId, assignmentId],
  );
  const webPath = useMemo(
    () => (drillId ? buildDrillWebPath(drillId, assignmentId) : null),
    [drillId, assignmentId],
  );

  const { iosStoreUrl, androidStoreUrl } = getMobileAppConfig();

  const openInApp = useCallback(() => {
    if (appDeepLink) {
      window.location.href = appDeepLink;
    }
  }, [appDeepLink]);

  const continueOnWeb = useCallback(() => {
    if (webPath) {
      router.replace(webPath);
    }
  }, [router, webPath]);

  useEffect(() => {
    if (!drillId || !webPath || !appDeepLink) {
      router.replace("/account/drills");
      return;
    }

    const isMobile = isMobileUserAgent(navigator.userAgent);

    if (!isMobile) {
      router.replace(webPath);
      return;
    }

    window.location.href = appDeepLink;

    const fallbackTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setStatus("ready");
      }
    }, APP_OPEN_FALLBACK_MS);

    return () => window.clearTimeout(fallbackTimer);
  }, [appDeepLink, drillId, router, webPath]);

  if (!drillId || !webPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        {status === "opening" ? (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Opening Eklan…
            </h1>
            <p className="text-sm text-gray-500">
              Launching the app to start your drill.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Open your drill
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Choose how you&apos;d like to continue.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={openInApp}
                className="w-full rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow hover:from-green-600 hover:to-emerald-600"
              >
                Open in app
              </button>
              <button
                type="button"
                onClick={continueOnWeb}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Continue on web
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <a
                href={iosStoreUrl}
                className="text-green-700 hover:text-green-800 underline"
              >
                Get Eklan on the App Store
              </a>
              <a
                href={androidStoreUrl}
                className="text-green-700 hover:text-green-800 underline"
              >
                Get Eklan on Google Play
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OpenDrillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      }
    >
      <OpenDrillContent />
    </Suspense>
  );
}
