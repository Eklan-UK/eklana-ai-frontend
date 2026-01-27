"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Calendar as CalendarIcon,
  Loader2,
  HelpCircle,
  ChevronDown,
  Trash2,
  Volume2,
  Check,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

interface FillInBlankQuestion {
  sentence: string;
  sentenceAudioUrl?: string;
  correctAnswer: string;
  options: string[];
  optionsAudioUrls?: string[];
  hint: string;
  explanation: string;
}

interface MatchingQuestion {
  left: string;
  leftAudioUrl?: string;
  right: string;
  rightAudioUrl?: string;
  hint: string;
  explanation: string;
}

interface MultipleChoiceQuestion {
  question: string;
  questionAudioUrl?: string;
  options: string[];
  optionsAudioUrls?: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
}

interface VocabularyQuestion {
  word: string;
  wordAudioUrl?: string;
  definition: string;
  definitionAudioUrl?: string;
  exampleSentence: string;
  exampleAudioUrl?: string;
  pronunciation: string;
  hint: string;
  explanation: string;
}

export default function EditDailyFocusPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingTTS, setGeneratingTTS] = useState(false);
  const [ttsGenerated, setTtsGenerated] = useState(false);

  // Basic info
  const [title, setTitle] = useState("");
  const [focusType, setFocusType] = useState("grammar");
  const [practiceFormat, setPracticeFormat] = useState("fill-in-blank");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [showExplanations, setShowExplanations] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Questions
  const [fillInBlankQuestions, setFillInBlankQuestions] = useState<FillInBlankQuestion[]>([]);
  const [matchingQuestions, setMatchingQuestions] = useState<MatchingQuestion[]>([]);
  const [multipleChoiceQuestions, setMultipleChoiceQuestions] = useState<MultipleChoiceQuestion[]>([]);
  const [vocabularyQuestions, setVocabularyQuestions] = useState<VocabularyQuestion[]>([]);

  // Analytics (read-only)
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [averageScore, setAverageScore] = useState(0);

  useEffect(() => {
    fetchDailyFocus();
  }, [id]);

  const fetchDailyFocus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/daily-focus/${id}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch daily focus");
      }

      const data = await response.json();
      const focus = data.dailyFocus;

      // Set basic info
      setTitle(focus.title || "");
      setFocusType(focus.focusType || "grammar");
      setPracticeFormat(focus.practiceFormat || "fill-in-blank");
      setDescription(focus.description || "");
      setDate(focus.date ? new Date(focus.date).toISOString().split("T")[0] : "");
      setEstimatedMinutes(focus.estimatedMinutes || 5);
      setDifficulty(focus.difficulty || "intermediate");
      setShowExplanations(focus.showExplanationsAfterSubmission !== false);
      setIsActive(focus.isActive !== false);

      // Set questions
      setFillInBlankQuestions(
        focus.fillInBlankQuestions?.map((q: any) => ({
          sentence: q.sentence || "",
          correctAnswer: q.correctAnswer || "",
          options: q.options || [],
          hint: q.hint || "",
          explanation: q.explanation || "",
        })) || []
      );

      setMatchingQuestions(
        focus.matchingQuestions?.map((q: any) => ({
          left: q.left || "",
          right: q.right || "",
          hint: q.hint || "",
          explanation: q.explanation || "",
        })) || []
      );

      setMultipleChoiceQuestions(
        focus.multipleChoiceQuestions?.map((q: any) => ({
          question: q.question || "",
          options: q.options || ["", "", "", ""],
          correctIndex: q.correctIndex || 0,
          hint: q.hint || "",
          explanation: q.explanation || "",
        })) || []
      );

      setVocabularyQuestions(
        focus.vocabularyQuestions?.map((q: any) => ({
          word: q.word || "",
          definition: q.definition || "",
          exampleSentence: q.exampleSentence || "",
          pronunciation: q.pronunciation || "",
          hint: q.hint || "",
          explanation: q.explanation || "",
        })) || []
      );

      // Set analytics
      setTotalCompletions(focus.totalCompletions || 0);
      setAverageScore(focus.averageScore || 0);
    } catch (error: any) {
      toast.error(error.message || "Failed to load daily focus");
      router.push("/admin/daily-focus");
    } finally {
      setLoading(false);
    }
  };

  // Question handlers (same as create page)
  const addFillInBlankQuestion = () => {
    setFillInBlankQuestions([
      ...fillInBlankQuestions,
      { sentence: "", correctAnswer: "", options: [], hint: "", explanation: "" },
    ]);
  };

  const removeFillInBlankQuestion = (index: number) => {
    setFillInBlankQuestions(fillInBlankQuestions.filter((_, i) => i !== index));
  };

  const updateFillInBlankQuestion = (index: number, field: keyof FillInBlankQuestion, value: any) => {
    const updated = [...fillInBlankQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setFillInBlankQuestions(updated);
  };

  const addMatchingQuestion = () => {
    setMatchingQuestions([...matchingQuestions, { left: "", right: "", hint: "", explanation: "" }]);
  };

  const removeMatchingQuestion = (index: number) => {
    setMatchingQuestions(matchingQuestions.filter((_, i) => i !== index));
  };

  const updateMatchingQuestion = (index: number, field: keyof MatchingQuestion, value: string) => {
    const updated = [...matchingQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setMatchingQuestions(updated);
  };

  const addMultipleChoiceQuestion = () => {
    setMultipleChoiceQuestions([
      ...multipleChoiceQuestions,
      { question: "", options: ["", "", "", ""], correctIndex: 0, hint: "", explanation: "" },
    ]);
  };

  const removeMultipleChoiceQuestion = (index: number) => {
    setMultipleChoiceQuestions(multipleChoiceQuestions.filter((_, i) => i !== index));
  };

  const updateMultipleChoiceQuestion = (index: number, field: keyof MultipleChoiceQuestion, value: any) => {
    const updated = [...multipleChoiceQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setMultipleChoiceQuestions(updated);
  };

  const updateMultipleChoiceOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...multipleChoiceQuestions];
    updated[qIndex].options[oIndex] = value;
    setMultipleChoiceQuestions(updated);
  };

  const addVocabularyQuestion = () => {
    setVocabularyQuestions([
      ...vocabularyQuestions,
      { word: "", definition: "", exampleSentence: "", pronunciation: "", hint: "", explanation: "" },
    ]);
  };

  const removeVocabularyQuestion = (index: number) => {
    setVocabularyQuestions(vocabularyQuestions.filter((_, i) => i !== index));
  };

  const updateVocabularyQuestion = (index: number, field: keyof VocabularyQuestion, value: string) => {
    const updated = [...vocabularyQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setVocabularyQuestions(updated);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this daily focus? This action cannot be undone.")) return;

    try {
      const response = await fetch(`/api/v1/daily-focus/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete daily focus");
      }

      toast.success("Daily focus deleted successfully");
      router.push("/admin/daily-focus");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete daily focus");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!date) {
      toast.error("Please select a date");
      return;
    }

    // Ensure date is stored as UTC midnight for consistent querying
    const [year, month, day] = date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    const data: any = {
      title: title.trim(),
      focusType,
      practiceFormat,
      description: description.trim(),
      date: utcDate.toISOString(),
      estimatedMinutes,
      difficulty,
      showExplanationsAfterSubmission: showExplanations,
      isActive,
    };

    // Add questions based on practice format
    const validFillIn = fillInBlankQuestions.filter((q) => q.sentence.trim() && q.correctAnswer.trim());
    const validMatching = matchingQuestions.filter((q) => q.left.trim() && q.right.trim());
    const validMC = multipleChoiceQuestions.filter((q) => q.question.trim() && q.options.some((o) => o.trim()));
    const validVocab = vocabularyQuestions.filter((q) => q.word.trim() && q.definition.trim());

    if (validFillIn.length > 0) data.fillInBlankQuestions = validFillIn;
    if (validMatching.length > 0) data.matchingQuestions = validMatching;
    if (validMC.length > 0) data.multipleChoiceQuestions = validMC;
    if (validVocab.length > 0) data.vocabularyQuestions = validVocab;

    const hasQuestions = validFillIn.length > 0 || validMatching.length > 0 || validMC.length > 0 || validVocab.length > 0;
    if (!hasQuestions) {
      toast.error("Please add at least one complete question");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/v1/daily-focus/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update daily focus");
      }

      toast.success("Daily focus updated successfully!");
      router.push("/admin/daily-focus");
    } catch (error: any) {
      toast.error(error.message || "Failed to update daily focus");
    } finally {
      setSaving(false);
    }
  };

  const renderQuestionEditor = () => {
    const format = practiceFormat;
    
    if (format === "fill-in-blank" || format === "mixed") {
      return (
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Fill-in-the-Blank Questions</h2>
            <button
              onClick={addFillInBlankQuestion}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          <p className="text-sm text-gray-500 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Use ___ (three underscores) to mark the blank
          </p>

          {fillInBlankQuestions.map((q, idx) => (
            <div key={idx} className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100">
              <button onClick={() => removeFillInBlankQuestion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Question {idx + 1}</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Sentence with blank *</label>
                  <input type="text" value={q.sentence} onChange={(e) => updateFillInBlankQuestion(idx, "sentence", e.target.value)} placeholder="e.g. She ___ to the store." className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Correct Answer *</label>
                  <input type="text" value={q.correctAnswer} onChange={(e) => updateFillInBlankQuestion(idx, "correctAnswer", e.target.value)} placeholder="e.g. went" className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Options (comma-separated)</label>
                  <input type="text" value={q.options.join(", ")} onChange={(e) => updateFillInBlankQuestion(idx, "options", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="e.g. went, go, goes" className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Hint</label>
                    <input type="text" value={q.hint} onChange={(e) => updateFillInBlankQuestion(idx, "hint", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Explanation</label>
                    <input type="text" value={q.explanation} onChange={(e) => updateFillInBlankQuestion(idx, "explanation", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (format === "matching" || format === "mixed") {
      return (
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Matching Pairs</h2>
            <button onClick={addMatchingQuestion} className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50">
              <Plus className="w-4 h-4" /> Add Pair
            </button>
          </div>

          {matchingQuestions.map((q, idx) => (
            <div key={idx} className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100">
              <button onClick={() => removeMatchingQuestion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Pair {idx + 1}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Left *</label>
                  <input type="text" value={q.left} onChange={(e) => updateMatchingQuestion(idx, "left", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Right (Match) *</label>
                  <input type="text" value={q.right} onChange={(e) => updateMatchingQuestion(idx, "right", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (format === "multiple-choice" || format === "mixed") {
      return (
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Multiple Choice Questions</h2>
            <button onClick={addMultipleChoiceQuestion} className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50">
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          {multipleChoiceQuestions.map((q, idx) => (
            <div key={idx} className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100">
              <button onClick={() => removeMultipleChoiceQuestion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Question {idx + 1}</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Question *</label>
                  <input type="text" value={q.question} onChange={(e) => updateMultipleChoiceQuestion(idx, "question", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Options *</label>
                  {q.options.map((option, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2 mb-2">
                      <input type="radio" name={`correct-${idx}`} checked={q.correctIndex === oIdx} onChange={() => updateMultipleChoiceQuestion(idx, "correctIndex", oIdx)} className="w-4 h-4 text-green-600" />
                      <input type="text" value={option} onChange={(e) => updateMultipleChoiceOption(idx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="flex-1 px-4 py-2 bg-white border border-gray-100 rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (format === "vocabulary" || format === "mixed") {
      return (
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Vocabulary Items</h2>
            <button onClick={addVocabularyQuestion} className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50">
              <Plus className="w-4 h-4" /> Add Word
            </button>
          </div>

          {vocabularyQuestions.map((q, idx) => (
            <div key={idx} className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100">
              <button onClick={() => removeVocabularyQuestion(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Word {idx + 1}</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Word *</label>
                    <input type="text" value={q.word} onChange={(e) => updateVocabularyQuestion(idx, "word", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Pronunciation</label>
                    <input type="text" value={q.pronunciation} onChange={(e) => updateVocabularyQuestion(idx, "pronunciation", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Definition *</label>
                  <input type="text" value={q.definition} onChange={(e) => updateVocabularyQuestion(idx, "definition", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Example Sentence</label>
                  <input type="text" value={q.exampleSentence} onChange={(e) => updateVocabularyQuestion(idx, "exampleSentence", e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#418b43]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.back()} className="p-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Daily Focus</h1>
            <p className="text-gray-500 text-sm">Update practice content</p>
          </div>
        </div>
        <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>

      {/* Analytics Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
        <h3 className="text-sm font-bold text-blue-900 mb-3">Analytics</h3>
        <div className="flex gap-8">
          <div>
            <p className="text-2xl font-bold text-blue-700">{totalCompletions}</p>
            <p className="text-xs text-blue-600">Total Completions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{averageScore.toFixed(0)}%</p>
            <p className="text-xs text-blue-600">Average Score</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Questions */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            {renderQuestionEditor()}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Settings</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Date *</label>
                <div className="relative">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl" />
                  <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Focus Type</label>
                  <div className="relative">
                    <select value={focusType} onChange={(e) => setFocusType(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none">
                      <option value="grammar">Grammar</option>
                      <option value="vocabulary">Vocabulary</option>
                      <option value="matching">Matching</option>
                      <option value="pronunciation">Pronunciation</option>
                      <option value="general">General</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Practice Format</label>
                  <div className="relative">
                    <select value={practiceFormat} onChange={(e) => setPracticeFormat(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none">
                      <option value="fill-in-blank">Fill in the Blank</option>
                      <option value="matching">Matching</option>
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="vocabulary">Vocabulary</option>
                      <option value="mixed">Mixed</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Difficulty</label>
                  <div className="relative">
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Est. Minutes</label>
                  <input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 5)} min="1" max="60" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl" />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="showExplanations" checked={showExplanations} onChange={(e) => setShowExplanations(e.target.checked)} className="w-4 h-4 rounded text-green-600 accent-green-600" />
                <label htmlFor="showExplanations" className="text-sm text-gray-700">Show explanations after submission</label>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded text-green-600 accent-green-600" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible to users)</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-100 p-6 flex gap-4 z-10">
        <button onClick={handleSubmit} disabled={saving} className="px-8 py-3.5 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
        </button>
        <button onClick={() => router.back()} disabled={saving} className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

