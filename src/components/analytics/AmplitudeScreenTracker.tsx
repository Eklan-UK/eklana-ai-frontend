"use client";

import { useEffect, useRef } from "react";
import { tellAmplitudeScreenChanged } from "@/lib/amplitude";

export function AmplitudeScreenTracker({ screenName }: { screenName: string }) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    tellAmplitudeScreenChanged(screenName);
  }, [screenName]);
  return null;
}
