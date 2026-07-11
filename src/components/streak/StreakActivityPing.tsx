"use client";

import { useEffect, useRef } from "react";

function utcDateString(d: Date) {
  return d.toISOString().split("T")[0]!;
}

/**
 * Once per UTC calendar day, records learner presence for streaks (login ping)
 * and bootstraps Profile.timezone from the device when unset.
 */
export function StreakActivityPing() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const key = `streakActivityUtc:${utcDateString(new Date())}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) {
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/v1/users/streak/activity", {
          method: "POST",
          credentials: "include",
        });
        if (res.ok && typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(key, "1");
        }
      } catch {
        // non-blocking
      }

      // Bootstrap IANA timezone once per session when profile has none set.
      const tzKey = "timezoneBootstrap";
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(tzKey)) {
        return;
      }
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!deviceTz) return;

      try {
        const prefsRes = await fetch("/api/v1/users/preferences", {
          credentials: "include",
        });
        if (!prefsRes.ok) return;

        const prefsJson = await prefsRes.json();
        const currentTz = prefsJson?.data?.timezone as string | undefined;
        if (!currentTz) {
          await fetch("/api/v1/users/preferences", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezone: deviceTz }),
          });
        }
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(tzKey, "1");
        }
      } catch {
        // non-blocking
      }
    })();
  }, []);

  return null;
}
