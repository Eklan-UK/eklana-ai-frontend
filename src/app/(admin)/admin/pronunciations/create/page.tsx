"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useCreatePronunciationProblem } from "@/hooks/usePronunciations";
import { toast } from "sonner";

export default function CreatePronunciationProblemPage() {
  const router = useRouter();
  const createMutation = useCreatePronunciationProblem();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    phonemes: [] as string[],
    phonemeInput: "",
    type: "" as "" | "word" | "sound" | "sentence", // Optional: words can have different types
    difficulty: "intermediate",
    estimatedTimeMinutes: "",
    order: "0",
  });

  const handleAddPhoneme = () => {
    const trimmed = formData.phonemeInput.trim();
    if (trimmed && !formData.phonemes.includes(trimmed)) {
      setFormData({
        ...formData,
        phonemes: [...formData.phonemes, trimmed],
        phonemeInput: "",
      });
    }
  };

  const handleRemovePhoneme = (phoneme: string) => {
    setFormData({
      ...formData,
      phonemes: formData.phonemes.filter((p) => p !== phoneme),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || formData.phonemes.length === 0) {
      toast.error("Title and at least one phoneme are required");
      return;
    }

    createMutation.mutate(
      {
        title: formData.title,
        description: formData.description || undefined,
        phonemes: formData.phonemes,
        type: formData.type || undefined, // Optional field
        difficulty: formData.difficulty,
        estimatedTimeMinutes: formData.estimatedTimeMinutes
          ? parseInt(formData.estimatedTimeMinutes)
          : undefined,
        order: parseInt(formData.order) || 0,
      },
      {
        onSuccess: (response) => {
          const problemSlug = response.data?.problem?.slug;
          if (problemSlug) {
            router.push(`/admin/pronunciations/${problemSlug}/words`);
          } else {
            router.push("/admin/pronunciations");
          }
        },
      }
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/pronunciations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Pronunciation Problem</h1>
          <p className="text-gray-500 text-sm">
            Create a new pronunciation problem. You'll add words to it next.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
        {/* Title */}
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Practice the R-L sound"
            required
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the pronunciation practice"
            rows={3}
          />
        </div>

        {/* Type */}
        <div>
          <Label htmlFor="type">Primary Type (Optional)</Label>
          <Select
            id="type"
            value={formData.type}
            onChange={(e) => {
              const value = e.target.value as "" | "word" | "sound" | "sentence";
              setFormData({ ...formData, type: value });
            }}
          >
            <option value="">None (Mixed types)</option>
            <option value="word">Word</option>
            <option value="sound">Sound</option>
            <option value="sentence">Sentence</option>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Optional: Set a primary type for this problem to help with filtering. Individual words can have different types.
          </p>
        </div>

        {/* Phonemes */}
        <div>
          <Label htmlFor="phonemes">Target Phonemes *</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="phonemes"
              value={formData.phonemeInput}
              onChange={(e) => setFormData({ ...formData, phonemeInput: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPhoneme();
                }
              }}
              placeholder="e.g., r, l, th"
            />
            <Button
              type="button"
              onClick={handleAddPhoneme}
              variant="outline"
              disabled={!formData.phonemeInput.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {formData.phonemes.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.phonemes.map((phoneme, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                >
                  {phoneme}
                  <button
                    type="button"
                    onClick={() => handleRemovePhoneme(phoneme)}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-600 mt-2 font-medium">
              ⚠ You must add at least one phoneme before creating the problem
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Type a phoneme and click the + button to add it (e.g., r, l, th, θ)
          </p>
        </div>

        {/* Difficulty */}
        <div>
          <Label htmlFor="difficulty">Difficulty Level *</Label>
          <Select
            id="difficulty"
            value={formData.difficulty}
            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </div>

        {/* Estimated Time */}
        <div>
          <Label htmlFor="estimatedTimeMinutes">Estimated Time (Minutes, Optional)</Label>
          <Input
            id="estimatedTimeMinutes"
            type="number"
            min="1"
            value={formData.estimatedTimeMinutes}
            onChange={(e) => setFormData({ ...formData, estimatedTimeMinutes: e.target.value })}
            placeholder="e.g., 5"
          />
        </div>

        {/* Order */}
        <div>
          <Label htmlFor="order">Display Order (Optional)</Label>
          <Input
            id="order"
            type="number"
            min="0"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: e.target.value })}
            placeholder="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Lower numbers appear first. Default is 0.
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 pt-4">
          <Link href="/admin/pronunciations">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={
              createMutation.isPending ||
              !formData.title.trim() ||
              formData.phonemes.length === 0
            }
            title={
              !formData.title.trim()
                ? "Please enter a title"
                : formData.phonemes.length === 0
                ? "Please add at least one phoneme"
                : undefined
            }
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Problem"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

