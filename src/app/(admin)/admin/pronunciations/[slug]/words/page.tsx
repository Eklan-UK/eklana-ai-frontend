"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Upload, Loader2, X, Plus, Volume2, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import {
  usePronunciationProblem,
  usePronunciationProblemWords,
  useAddPronunciationWord,
} from "@/hooks/usePronunciations";
import { toast } from "sonner";

export default function ManageWordsPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const { data: problemData, isLoading: problemLoading } = usePronunciationProblem(slug);
  const { data: wordsData, isLoading: wordsLoading } = usePronunciationProblemWords(slug);
  const addWordMutation = useAddPronunciationWord();

  const problem = problemData?.problem;
  const words = wordsData?.words || [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    word: "",
    ipa: "",
    phonemes: [] as string[],
    phonemeInput: "",
    difficulty: "intermediate",
    order: "",
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("audio/")) {
        toast.error("Please select an audio file");
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Audio file must be less than 10MB");
        return;
      }

      setAudioFile(file);
      setAudioPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.word || !formData.ipa || formData.phonemes.length === 0) {
      toast.error("Word, IPA, and at least one phoneme are required");
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append("word", formData.word);
    formDataToSend.append("ipa", formData.ipa);
    formDataToSend.append("phonemes", formData.phonemes.join(","));
    // Type is automatically inherited from the problem, no need to send it
    formDataToSend.append("difficulty", formData.difficulty);
    formDataToSend.append("order", formData.order || "0");

    if (audioFile) {
      formDataToSend.append("audio", audioFile);
    }

    addWordMutation.mutate(
      { slug, formData: formDataToSend },
      {
        onSuccess: () => {
          // Reset form
          setFormData({
            word: "",
            ipa: "",
            phonemes: [],
            phonemeInput: "",
            difficulty: "intermediate",
            order: "",
          });
          setAudioFile(null);
          setAudioPreview(null);
          setShowAddForm(false);
        },
      }
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-700",
      intermediate: "bg-yellow-100 text-yellow-700",
      advanced: "bg-red-100 text-red-700",
    };
    return colors[difficulty] || "bg-gray-100 text-gray-700";
  };

  if (problemLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="space-y-8 pb-12">
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Problem not found</p>
          <Link href="/admin/pronunciations">
            <Button variant="ghost" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Problems
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/pronunciations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{problem.title}</h1>
          <p className="text-gray-500 text-sm">
            {problem.description || "No description"}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-wrap gap-1">
              {problem.phonemes.map((phoneme: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded"
                >
                  {phoneme}
                </span>
              ))}
            </div>
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full ${getDifficultyColor(problem.difficulty)}`}>
              {problem.difficulty}
            </span>
            {problem.estimatedTimeMinutes && (
              <span className="text-xs text-gray-500">
                ~{problem.estimatedTimeMinutes} min
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? "Cancel" : "Add Word"}
        </Button>
      </div>

      {/* Add Word Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Add New Word</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Word */}
              <div>
                <Label htmlFor="word">Word *</Label>
                <Input
                  id="word"
                  value={formData.word}
                  onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                  placeholder="e.g., Really"
                  required
                />
              </div>

              {/* IPA */}
              <div>
                <Label htmlFor="ipa">IPA Transcription *</Label>
                <Input
                  id="ipa"
                  value={formData.ipa}
                  onChange={(e) => setFormData({ ...formData, ipa: e.target.value })}
                  placeholder="e.g., /ˈrɪəli/"
                  required
                />
              </div>
            </div>

            {/* Phonemes */}
            <div>
              <Label htmlFor="phonemes">Phonemes *</Label>
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
                  placeholder="e.g., r, l"
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
              {formData.phonemes.length > 0 && (
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
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              {/* Order */}
              <div>
                <Label htmlFor="order">Order (Optional)</Label>
                <Input
                  id="order"
                  type="number"
                  min="0"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Audio Upload */}
            <div>
              <Label htmlFor="audio">Audio File (Optional - TTS will be used if not provided)</Label>
              <div className="mt-2">
                <label
                  htmlFor="audio"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">MP3, WAV, M4A (MAX. 10MB)</p>
                  </div>
                  <input
                    id="audio"
                    type="file"
                    className="hidden"
                    accept="audio/*"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {audioPreview && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Audio Preview</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null);
                        setAudioPreview(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <audio controls className="w-full" src={audioPreview}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({
                    word: "",
                    ipa: "",
                    phonemes: [],
                    phonemeInput: "",
                    difficulty: "intermediate",
                    order: "",
                  });
                  setAudioFile(null);
                  setAudioPreview(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addWordMutation.isPending || formData.phonemes.length === 0}
              >
                {addWordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Word"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Words List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50">
          <h2 className="flex items-center gap-3 text-lg font-bold text-gray-800">
            <Volume2 className="w-5 h-5 text-gray-400" />
            Words ({words.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          {wordsLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading words...</p>
            </div>
          ) : words.length === 0 ? (
            <div className="p-12 text-center">
              <Volume2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No words added yet. Click "Add Word" to get started.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Word
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    IPA
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Phonemes
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Difficulty
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Audio
                  </th>
                  <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Order
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {words.map((word: any) => (
                  <tr key={word._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-gray-900">{word.word}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm text-gray-700 font-mono">{word.ipa}</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1">
                        {word.phonemes.map((phoneme: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded"
                          >
                            {phoneme}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold rounded-full ${getDifficultyColor(
                          word.difficulty
                        )}`}
                      >
                        {word.difficulty}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {word.audioUrl ? (
                        <audio controls className="h-8" src={word.audioUrl}>
                          Your browser does not support the audio element.
                        </audio>
                      ) : (
                        <span className="text-xs text-gray-400">TTS</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm text-gray-700">{word.order || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


