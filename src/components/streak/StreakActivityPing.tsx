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
    const streakAlreadyDone =
      typeof sessionStorage !== "undefined" && Boolean(sessionStorage.getItem(key));
    // #region agent log
    fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c0476'},body:JSON.stringify({sessionId:'5c0476',runId:'pre-fix',hypothesisId:'B',location:'StreakActivityPing.tsx:entry',message:'StreakActivityPing effect entry',data:{streakAlreadyDone,deviceTz:Intl.DateTimeFormat().resolvedOptions().timeZone||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (streakAlreadyDone) {
      // #region agent log
      fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c0476'},body:JSON.stringify({sessionId:'5c0476',runId:'pre-fix',hypothesisId:'B',location:'StreakActivityPing.tsx:early-return',message:'Skipped timezone bootstrap because streak sessionStorage key present',data:{key},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c0476'},body:JSON.stringify({sessionId:'5c0476',runId:'pre-fix',hypothesisId:'B',location:'StreakActivityPing.tsx:tz-bootstrap-skipped',message:'Timezone bootstrap skipped; session flag already set',data:{tzKey},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
        let patched = false;
        if (!currentTz) {
          await fetch("/api/v1/users/preferences", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezone: deviceTz }),
          });
          patched = true;
        }
        // #region agent log
        fetch('http://127.0.0.1:7490/ingest/eeb056aa-00bc-4885-ab3b-35bd1102faa1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c0476'},body:JSON.stringify({sessionId:'5c0476',runId:'pre-fix',hypothesisId:'A',location:'StreakActivityPing.tsx:tz-bootstrap',message:'Timezone bootstrap attempt',data:{deviceTz,currentTz:currentTz??null,patched},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
