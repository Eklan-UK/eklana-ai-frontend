"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useTutorAvailability,
  useUpdateTutorAvailability,
} from "@/hooks/useClasses";
import type { TutorAvailabilityResponse } from "@/domain/tutor-availability/tutor-availability.api.types";

const WD_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeToMin(s: string) {
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.min(1439, Math.max(0, h * 60 + m));
}

export function TutorAvailabilityClient() {
  const { data, isLoading, error } = useTutorAvailability();
  const update = useUpdateTutorAvailability();
  const [form, setForm] = useState<TutorAvailabilityResponse>({
    timezone: "UTC",
    weeklyRules: [],
    exceptions: [],
    bufferMinutes: 0,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const addRule = () => {
    setForm((f) => ({
      ...f,
      weeklyRules: [
        ...f.weeklyRules,
        { weekday: 1, startMin: 9 * 60, endMin: 17 * 60 },
      ],
    }));
  };

  const updateRule = (
    index: number,
    patch: Partial<{ weekday: number; startMin: number; endMin: number }>,
  ) => {
    setForm((f) => {
      const weeklyRules = [...f.weeklyRules];
      weeklyRules[index] = { ...weeklyRules[index], ...patch };
      return { ...f, weeklyRules };
    });
  };

  const removeRule = (index: number) => {
    setForm((f) => ({
      ...f,
      weeklyRules: f.weeklyRules.filter((_, i) => i !== index),
    }));
  };

  const addException = () => {
    const d = new Date();
    const date = d.toISOString().slice(0, 10);
    setForm((f) => ({
      ...f,
      exceptions: [...f.exceptions, { date, kind: "block" as const }],
    }));
  };

  const removeException = (index: number) => {
    setForm((f) => ({
      ...f,
      exceptions: f.exceptions.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <p className="text-sm text-gray-600">
        Students who are enrolled with you only see reschedule options that fall inside these
        hours. Times use your chosen timezone. Add at least one weekly window so learners can
        reschedule.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Could not load availability"}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-900" htmlFor="tz">
          Timezone (IANA)
        </label>
        <input
          id="tz"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value.trim() }))}
          placeholder="America/New_York"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Weekly windows</span>
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add window
          </button>
        </div>
        <ul className="space-y-3">
          {form.weeklyRules.map((rule, i) => (
            <li
              key={`${rule.weekday}-${i}`}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="min-w-[100px]">
                <label className="sr-only">Day</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  value={rule.weekday}
                  onChange={(e) =>
                    updateRule(i, { weekday: parseInt(e.target.value, 10) })
                  }
                >
                  {WD_LABEL.map((label, d) => (
                    <option key={label} value={d}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">From</label>
                <input
                  type="time"
                  className="block rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  value={minToTime(rule.startMin)}
                  onChange={(e) => updateRule(i, { startMin: timeToMin(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">To</label>
                <input
                  type="time"
                  className="block rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  value={minToTime(Math.min(rule.endMin, 1439))}
                  onChange={(e) => updateRule(i, { endMin: Math.max(timeToMin(e.target.value), rule.startMin + 1) })}
                />
              </div>
              <button
                type="button"
                aria-label="Remove window"
                onClick={() => removeRule(i)}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Blocked dates (optional)</span>
          <button
            type="button"
            onClick={addException}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        <ul className="space-y-2">
          {form.exceptions.map((ex, i) => (
            <li key={`${ex.date}-${i}`} className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={ex.date}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const exceptions = [...f.exceptions];
                    exceptions[i] = { ...exceptions[i], date: v };
                    return { ...f, exceptions };
                  });
                }}
              />
              <select
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={ex.kind}
                onChange={(e) => {
                  const kind = e.target.value as "block" | "open";
                  setForm((f) => {
                    const exceptions = [...f.exceptions];
                    exceptions[i] = { ...exceptions[i], kind };
                    return { ...f, exceptions };
                  });
                }}
              >
                <option value="block">Block day</option>
                <option value="open">Open day</option>
              </select>
              <button
                type="button"
                aria-label="Remove exception"
                onClick={() => removeException(i)}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-900" htmlFor="buf">
          Buffer between sessions (minutes)
        </label>
        <input
          id="buf"
          type="number"
          min={0}
          max={240}
          className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={form.bufferMinutes}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              bufferMinutes: parseInt(e.target.value, 10) || 0,
            }))
          }
        />
      </div>

      <button
        type="button"
        disabled={update.isPending}
        onClick={() => update.mutate(form)}
        className="rounded-xl bg-[#2d6a32] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#245528] disabled:opacity-50"
      >
        {update.isPending ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
