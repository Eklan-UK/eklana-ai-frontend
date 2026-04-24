"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";

export default function LanguagePage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const languages = [
    { code: "en", name: "English" },
    { code: "ko", name: "Korean" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await userAPI.getCurrent({ cache: false });
        const p = (res as { profile?: { language?: string } }).profile;
        if (mounted) setSelected(p?.language?.trim() || "");
      } catch {
        toast.error("Could not load your profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userAPI.updatePreferences({ language: selected });
      await queryClient.invalidateQueries({ queryKey: ["user-current"] });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-6"></div>

      <Header showBack title="App Language" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="text-base text-gray-600 mb-6">
          Choose your preferred language for the app interface.
        </p>

        <div className="space-y-2 mb-6">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => setSelected(language.name)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selected === language.name
                    ? "bg-green-50 ring-2 ring-green-600"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-900">
                    {language.name}
                  </span>
                  {selected === language.name && (
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M13 4L6 11L3 8"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading || saving || !selected}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
