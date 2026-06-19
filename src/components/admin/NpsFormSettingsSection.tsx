"use client";

import React, { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useNpsFormSettings,
  useUpdateNpsFormSettings,
} from "@/hooks/useAdmin";
import { isValidGoogleFormsUrl } from "@/lib/nps-form-url";

type NpsFormDraft = {
  name: string;
  url: string;
  isActive: boolean;
};

export function NpsFormSettingsSection() {
  const { data: saved, isLoading, isError } = useNpsFormSettings();
  const updateSettings = useUpdateNpsFormSettings();

  const [draft, setDraft] = useState<NpsFormDraft | null>(null);
  const [urlError, setUrlError] = useState<string | undefined>();

  const values: NpsFormDraft = draft ?? {
    name: saved?.name ?? "",
    url: saved?.url ?? "",
    isActive: saved?.isActive ?? false,
  };

  const updateDraft = (patch: Partial<NpsFormDraft>) => {
    setDraft((prev) => ({ ...(prev ?? values), ...patch }));
  };

  const validateUrl = (value: string) => {
    if (!value.trim()) {
      setUrlError("Google Forms URL is required");
      return false;
    }
    if (!isValidGoogleFormsUrl(value)) {
      setUrlError(
        "Enter a valid Google Forms link (docs.google.com/forms or forms.gle)",
      );
      return false;
    }
    setUrlError(undefined);
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = values.name.trim();
    if (!trimmedName) {
      toast.error("Form name is required");
      return;
    }
    if (!validateUrl(values.url)) return;

    try {
      await updateSettings.mutateAsync({
        name: trimmedName,
        url: values.url.trim(),
        isActive: values.isActive,
      });
      setDraft(null);
    } catch {
      /* useUpdateNpsFormSettings shows error toast */
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading NPS form settings…
      </div>
    );
  }

  return (
    <>
      {isError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load NPS form settings. You can still save a new
          configuration below.
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <p className="text-xs leading-relaxed text-gray-600">
            Configure the global post-session NPS Google Form. Admins can
            optionally attach it when scheduling a class series.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-xl space-y-4">
        <div>
          <label
            htmlFor="nps-form-name"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Form name
          </label>
          <input
            id="nps-form-name"
            type="text"
            value={values.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            disabled={updateSettings.isPending}
            placeholder="e.g. Post-session feedback"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="nps-form-url"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Google Forms URL
          </label>
          <input
            id="nps-form-url"
            type="url"
            value={values.url}
            onChange={(e) => {
              updateDraft({ url: e.target.value });
              if (urlError) setUrlError(undefined);
            }}
            onBlur={() => {
              if (values.url.trim()) validateUrl(values.url);
            }}
            disabled={updateSettings.isPending}
            placeholder="https://docs.google.com/forms/d/e/…/viewform"
            className={`w-full rounded-xl border bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
              urlError ? "border-red-300" : "border-gray-200"
            }`}
          />
          {urlError ? (
            <p className="mt-1 text-sm text-red-600">{urlError}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Must be a public Google Forms link (docs.google.com/forms or
              forms.gle).
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Active</p>
            <p className="text-xs text-gray-500">
              Only active forms can be added when scheduling classes
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={values.isActive}
            aria-label="NPS form active"
            disabled={updateSettings.isPending}
            onClick={() => updateDraft({ isActive: !values.isActive })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 ${
              values.isActive ? "bg-[#2d6a32]" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                values.isActive
                  ? "left-0.5 translate-x-5"
                  : "left-0.5 translate-x-0"
              }`}
            />
          </button>
        </div>

        {saved?.updatedAt ? (
          <p className="text-xs text-gray-400">
            Last updated{" "}
            {new Date(saved.updatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={updateSettings.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#418b43] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3a7c3b] disabled:opacity-50"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save NPS form"
          )}
        </button>
      </form>
    </>
  );
}
