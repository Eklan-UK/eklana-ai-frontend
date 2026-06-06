"use client";

/**
 * Eagerly register window.engagement so Amplitude dashboard preview can detect
 * the Guides & Surveys stub before React effects run.
 */
import "@amplitude/engagement-browser";

import { useEffect } from "react";
import { startAmplitude } from "@/lib/amplitude";

let amplitudeBootStarted = false;

export function AmplitudeInit() {
  useEffect(() => {
    if (amplitudeBootStarted) return;
    amplitudeBootStarted = true;
    void startAmplitude();
  }, []);
  return null;
}
