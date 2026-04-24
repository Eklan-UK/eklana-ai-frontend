"use client";

import { useEffect, useRef } from "react";

function utcDateString(d: Date) {
  return d.toISOString().split("T")[0]!;
}

/**
 * Once per UTC calendar day, records learner presence for streaks (login ping).
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
    })();
  }, []);

  return null;
}
