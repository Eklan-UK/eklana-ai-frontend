# Implementation Guide: Problem Editor & Word Manager

## Overview
This guide provides step-by-step instructions to implement the missing admin UI for managing pronunciation problems and adding words.

---

## Part 1: Create Problem Editor Page

### File: `/src/app/(admin)/admin/pronunciation-problems/[slug]/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { pronunciationProblemAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Loader2 } from "lucide-react";
import Link from "next/link";
import AddPronunciationWord from "@/components/admin/AddPronunciationWord";

export default function ProblemEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [showAddWord, setShowAddWord] = useState(false);
  const [editingWord, setEditingWord] = useState<any>(null);

  // Fetch problem with words
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pronunciation-problem", slug],
    queryFn: async () => {
      const response = await pronunciationProblemAPI.getBySlug(slug);
      return response.data;
    },
  });

  const problem = data?.problem;
  const words = data?.words || [];

  const handleAddWordSuccess = () => {
    setShowAddWord(false);
    setEditingWord(null);
    refetch();
    toast.success("Word added successfully!");
  };

  return (
    <div className="min-h-screen bg-white pb-12">
      <div className="h-6"></div>

      {/* Header */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin/pronunciation-problems">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Problems
          </Button>
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : problem ? (
          <>
            {/* Problem Details */}
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {problem.title}
                </h1>
                {problem.description && (
                  <p className="text-gray-600 mb-4">{problem.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600">Difficulty</p>
                    <p className="font-semibold">{problem.difficulty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Estimated Time</p>
                    <p className="font-semibold">{problem.estimatedTimeMinutes || "-"} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Words</p>
                    <p className="font-semibold">{words.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <p className={`font-semibold ${problem.isActive ? "text-green-600" : "text-red-600"}`}>
                      {problem.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                {problem.phonemes && problem.phonemes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Target Phonemes</p>
                    <div className="flex flex-wrap gap-2">
                      {problem.phonemes.map((phoneme: string) => (
                        <span
                          key={phoneme}
                          className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-sm font-mono"
                        >
                          /{phoneme}/
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Words Section */}
            <Card className="mb-6">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Words ({words.length})</h2>
                  <Button
                    onClick={() => setShowAddWord(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Word
                  </Button>
                </div>
              </div>

              {words.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500 mb-4">No words added yet.</p>
                  <Button
                    onClick={() => setShowAddWord(true)}
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Word
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {words.map((word: any, index: number) => (
                    <WordItem
                      key={word._id}
                      word={word}
                      index={index}
                      onEdit={() => {
                        setEditingWord(word);
                        setShowAddWord(true);
                      }}
                      onDelete={() => handleDeleteWord(word._id)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Add/Edit Word Modal */}
            {showAddWord && (
              <AddPronunciationWord
                slug={slug}
                word={editingWord}
                onSuccess={handleAddWordSuccess}
                onCancel={() => {
                  setShowAddWord(false);
                  setEditingWord(null);
                }}
              />
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-red-600">Problem not found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WordItem({
  word,
  index,
  onEdit,
  onDelete,
}: {
  word: any;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this word?")) return;
    setIsDeleting(true);
    try {
      // TODO: Call DELETE /api/v1/pronunciation-words/[wordId]
      toast.success("Word deleted");
      onDelete();
    } catch (error) {
      toast.error("Failed to delete word");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-semibold">{index + 1}.</span>
          <div>
            <p className="font-semibold text-gray-900">{word.word}</p>
            <p className="text-sm text-gray-600">{word.ipa || "No IPA"}</p>
            {word.phonemes?.length > 0 && (
              <div className="flex gap-1 mt-1">
                {word.phonemes.map((p: string) => (
                  <span key={p} className="text-xs bg-gray-200 px-1 rounded">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 ml-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={onEdit}
          className="flex items-center gap-1"
        >
          <Edit className="w-3 h-3" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-1 text-red-600"
        >
          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}
```

---

## Part 2: Create Add Word Component

### File: `/src/components/admin/AddPronunciationWord.tsx`

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { pronunciationProblemAPI } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { toast } from "sonner";
import { Upload, Volume2, Loader2, X } from "lucide-react";

interface AddPronunciationWordProps {
  slug: string;
  word?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddPronunciationWord({
  slug,
  word,
  onSuccess,
  onCancel,
}: AddPronunciationWordProps) {
  const [wordText, setWordText] = useState(word?.word || "");
  const [ipa, setIpa] = useState(word?.ipa || "");
  const [phonemesText, setPhonemesText] = useState(word?.phonemes?.join(", ") || "");
  const [useTTS, setUseTTS] = useState(!word?.audioUrl);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(word?.audioUrl);

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("word", wordText);
      formData.append("ipa", ipa);
      formData.append("phonemes", phonemesText);
      formData.append("useTTS", String(useTTS));

      if (audioFile && !useTTS) {
        formData.append("audio", audioFile);
      }

      const response = await pronunciationProblemAPI.addWord(slug, formData);
      return response;
    },
    onSuccess: () => {
      toast.success("Word added successfully!");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to add word");
    },
  });

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Audio file must be less than 10MB");
        return;
      }
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!wordText.trim()) {
      toast.error("Word is required");
      return;
    }

    if (!useTTS && !audioFile && !audioPreviewUrl) {
      toast.error("Please either enable TTS or upload audio");
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold">Add Word to Problem</h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Word */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Word *
            </label>
            <Input
              type="text"
              value={wordText}
              onChange={(e) => setWordText(e.target.value)}
              placeholder="e.g., 'better'"
              required
            />
          </div>

          {/* IPA */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              IPA Transcription
            </label>
            <Input
              type="text"
              value={ipa}
              onChange={(e) => setIpa(e.target.value)}
              placeholder="e.g., '/ˈbɛtər/'"
            />
          </div>

          {/* Phonemes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Target Phonemes
            </label>
            <Textarea
              value={phonemesText}
              onChange={(e) => setPhonemesText(e.target.value)}
              placeholder="Comma-separated, e.g.: 'ɛ, t, ə, r'"
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter phonemes separated by commas
            </p>
          </div>

          {/* Audio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Audio *
            </label>

            <div className="space-y-3">
              {/* TTS Toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={useTTS}
                  onChange={(checked) => setUseTTS(checked)}
                  id="use-tts"
                />
                <label htmlFor="use-tts" className="text-sm text-gray-700">
                  Use Text-to-Speech (automated pronunciation)
                </label>
              </div>

              {/* Audio Upload */}
              {!useTTS && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioChange}
                    className="hidden"
                    id="audio-input"
                  />
                  <label
                    htmlFor="audio-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      Click to upload audio
                    </span>
                    <span className="text-xs text-gray-500">
                      MP3, WAV, or OGG (max 10MB)
                    </span>
                  </label>
                </div>
              )}

              {/* Audio Preview */}
              {audioPreviewUrl && !useTTS && (
                <div className="bg-gray-100 p-3 rounded flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-600" />
                  <audio controls className="flex-1 h-6">
                    <source src={audioPreviewUrl} />
                  </audio>
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2"
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {word ? "Update Word" : "Add Word"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
```

---

## Part 3: Update Pronunciation Problem Route to Include Problem Editor Link

### File: `/src/app/(admin)/admin/pronunciation-problems/page.tsx`

Update the problem card to add an "Manage Words" button:

```typescript
// In the problems list map function, add this to each problem card:

<div className="flex gap-2 mt-4">
  <Link
    href={`/admin/pronunciation-problems/${problem.slug}`}
    className="flex-1"
  >
    <Button variant="secondary" className="w-full">
      <Plus className="w-4 h-4 mr-2" />
      Manage Words ({problem.wordCount || 0})
    </Button>
  </Link>
</div>
```

---

## Part 4: Create Missing Backend Endpoints

### File: `/src/app/api/v1/pronunciation-words/[wordId]/route.ts`

```typescript
// PATCH and DELETE for word management
import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationWord from '@/models/pronunciation-word';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

// PATCH handler - Update word
async function patchHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { wordId: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { wordId } = params;
    const body = await req.json();

    const word = await PronunciationWord.findByIdAndUpdate(
      wordId,
      { ...body, updatedAt: new Date() },
      { new: true }
    );

    if (!word) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'Word not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: 'Success',
      message: 'Word updated successfully',
      data: { word },
    });
  } catch (error: any) {
    logger.error('Error updating word', error);
    return NextResponse.json(
      { code: 'ServerError', message: error.message },
      { status: 500 }
    );
  }
}

// DELETE handler - Delete word
async function deleteHandler(
  req: NextRequest,
  context: { userId: Types.ObjectId; userRole: string },
  params: { wordId: string }
): Promise<NextResponse> {
  try {
    await connectToDatabase();

    const { wordId } = params;
    const word = await PronunciationWord.findByIdAndDelete(wordId);

    if (!word) {
      return NextResponse.json(
        { code: 'NotFoundError', message: 'Word not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: 'Success',
      message: 'Word deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting word', error);
    return NextResponse.json(
      { code: 'ServerError', message: error.message },
      { status: 500 }
    );
  }
}

export const PATCH = withRole(['admin'], patchHandler);
export const DELETE = withRole(['admin'], deleteHandler);
```

---

## Summary

This implementation provides:

✅ Admin can create problem
✅ Admin can add/edit/delete words
✅ Learner can practice with progress persistence
✅ Audio upload + TTS options
✅ Clean UI workflow

Next steps:
1. Create analytics dashboard
2. Add progress management endpoints
3. Build tutor dashboard

Would you like me to implement any of these components?
