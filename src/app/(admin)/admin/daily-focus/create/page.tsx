"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Calendar as CalendarIcon,
  Loader2,
  HelpCircle,
  ChevronDown,
  Volume2,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
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

export default function CreateDailyFocusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generatingTTS, setGeneratingTTS] = useState(false);
  const [ttsGenerated, setTtsGenerated] = useState(false);

  // Basic info
  const [title, setTitle] = useState("");
  const [focusType, setFocusType] = useState("grammar");
  const [practiceFormat, setPracticeFormat] = useState("fill-in-blank");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [showExplanations, setShowExplanations] = useState(true);

  // Questions
  const [fillInBlankQuestions, setFillInBlankQuestions] = useState<
    FillInBlankQuestion[]
  >([{ sentence: "", correctAnswer: "", options: [], hint: "", explanation: "" }]);

  const [matchingQuestions, setMatchingQuestions] = useState<MatchingQuestion[]>(
    [{ left: "", right: "", hint: "", explanation: "" }]
  );

  const [multipleChoiceQuestions, setMultipleChoiceQuestions] = useState<
    MultipleChoiceQuestion[]
  >([{ question: "", options: ["", "", "", ""], correctIndex: 0, hint: "", explanation: "" }]);

  const [vocabularyQuestions, setVocabularyQuestions] = useState<
    VocabularyQuestion[]
  >([{ word: "", definition: "", exampleSentence: "", pronunciation: "", hint: "", explanation: "" }]);

  // Handlers for fill-in-blank questions
  const addFillInBlankQuestion = () => {
    setFillInBlankQuestions([
      ...fillInBlankQuestions,
      { sentence: "", correctAnswer: "", options: [], hint: "", explanation: "" },
    ]);
  };

  const removeFillInBlankQuestion = (index: number) => {
    if (fillInBlankQuestions.length > 1) {
      setFillInBlankQuestions(fillInBlankQuestions.filter((_, i) => i !== index));
    }
  };

  const updateFillInBlankQuestion = (
    index: number,
    field: keyof FillInBlankQuestion,
    value: any
  ) => {
    const updated = [...fillInBlankQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setFillInBlankQuestions(updated);
  };

  // Handlers for matching questions
  const addMatchingQuestion = () => {
    setMatchingQuestions([
      ...matchingQuestions,
      { left: "", right: "", hint: "", explanation: "" },
    ]);
  };

  const removeMatchingQuestion = (index: number) => {
    if (matchingQuestions.length > 1) {
      setMatchingQuestions(matchingQuestions.filter((_, i) => i !== index));
    }
  };

  const updateMatchingQuestion = (
    index: number,
    field: keyof MatchingQuestion,
    value: string
  ) => {
    const updated = [...matchingQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setMatchingQuestions(updated);
  };

  // Handlers for multiple choice questions
  const addMultipleChoiceQuestion = () => {
    setMultipleChoiceQuestions([
      ...multipleChoiceQuestions,
      { question: "", options: ["", "", "", ""], correctIndex: 0, hint: "", explanation: "" },
    ]);
  };

  const removeMultipleChoiceQuestion = (index: number) => {
    if (multipleChoiceQuestions.length > 1) {
      setMultipleChoiceQuestions(multipleChoiceQuestions.filter((_, i) => i !== index));
    }
  };

  const updateMultipleChoiceQuestion = (
    index: number,
    field: keyof MultipleChoiceQuestion,
    value: any
  ) => {
    const updated = [...multipleChoiceQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setMultipleChoiceQuestions(updated);
  };

  const updateMultipleChoiceOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...multipleChoiceQuestions];
    updated[qIndex].options[oIndex] = value;
    setMultipleChoiceQuestions(updated);
  };

  // Handlers for vocabulary questions
  const addVocabularyQuestion = () => {
    setVocabularyQuestions([
      ...vocabularyQuestions,
      { word: "", definition: "", exampleSentence: "", pronunciation: "", hint: "", explanation: "" },
    ]);
  };

  const removeVocabularyQuestion = (index: number) => {
    if (vocabularyQuestions.length > 1) {
      setVocabularyQuestions(vocabularyQuestions.filter((_, i) => i !== index));
    }
  };

  const updateVocabularyQuestion = (
    index: number,
    field: keyof VocabularyQuestion,
    value: string
  ) => {
    const updated = [...vocabularyQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setVocabularyQuestions(updated);
  };

  // Generate TTS audio for all questions
  const generateTTSAudio = async () => {
    setGeneratingTTS(true);
    
    try {
      // Collect all texts that need TTS
      const textsToGenerate: Array<{ id: string; text: string }> = [];
      
      // Fill-in-blank questions
      if (practiceFormat === "fill-in-blank" || practiceFormat === "mixed") {
        fillInBlankQuestions.forEach((q, idx) => {
          if (q.sentence.trim()) {
            // Replace blank marker with "blank" for better TTS
            const sentenceForTTS = q.sentence.replace(/___/g, "blank");
            textsToGenerate.push({ id: `fib-sentence-${idx}`, text: sentenceForTTS });
          }
          q.options.forEach((opt, oIdx) => {
            if (opt.trim()) {
              textsToGenerate.push({ id: `fib-option-${idx}-${oIdx}`, text: opt });
            }
          });
        });
      }
      
      // Matching questions
      if (practiceFormat === "matching" || practiceFormat === "mixed") {
        matchingQuestions.forEach((q, idx) => {
          if (q.left.trim()) {
            textsToGenerate.push({ id: `match-left-${idx}`, text: q.left });
          }
          if (q.right.trim()) {
            textsToGenerate.push({ id: `match-right-${idx}`, text: q.right });
          }
        });
      }
      
      // Multiple choice questions
      if (practiceFormat === "multiple-choice" || practiceFormat === "mixed") {
        multipleChoiceQuestions.forEach((q, idx) => {
          if (q.question.trim()) {
            textsToGenerate.push({ id: `mc-question-${idx}`, text: q.question });
          }
          q.options.forEach((opt, oIdx) => {
            if (opt.trim()) {
              textsToGenerate.push({ id: `mc-option-${idx}-${oIdx}`, text: opt });
            }
          });
        });
      }
      
      // Vocabulary questions
      if (practiceFormat === "vocabulary" || practiceFormat === "mixed") {
        vocabularyQuestions.forEach((q, idx) => {
          if (q.word.trim()) {
            textsToGenerate.push({ id: `vocab-word-${idx}`, text: q.word });
          }
          // Only generate definition TTS if not grammar focus
          if (q.definition.trim() && focusType !== "grammar") {
            textsToGenerate.push({ id: `vocab-def-${idx}`, text: q.definition });
          }
          if (q.exampleSentence.trim()) {
            textsToGenerate.push({ id: `vocab-example-${idx}`, text: q.exampleSentence });
          }
        });
      }
      
      if (textsToGenerate.length === 0) {
        toast.error("No text content to generate audio for");
        setGeneratingTTS(false);
        return;
      }
      
      toast.info(`Generating audio for ${textsToGenerate.length} items...`);
      
      // Call batch TTS API
      const response = await fetch("/api/v1/tts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texts: textsToGenerate }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate TTS audio");
      }
      
      const result = await response.json();
      const { results, summary } = result.data;
      
      // Map audio URLs back to questions
      const audioMap = new Map<string, string>();
      results.forEach((r: { id: string; audioUrl: string | null }) => {
        if (r.audioUrl) {
          audioMap.set(r.id, r.audioUrl);
        }
      });
      
      // Update fill-in-blank questions with audio URLs
      if (practiceFormat === "fill-in-blank" || practiceFormat === "mixed") {
        const updatedFib = fillInBlankQuestions.map((q, idx) => ({
          ...q,
          sentenceAudioUrl: audioMap.get(`fib-sentence-${idx}`) || "",
          optionsAudioUrls: q.options.map((_, oIdx) => audioMap.get(`fib-option-${idx}-${oIdx}`) || ""),
        }));
        setFillInBlankQuestions(updatedFib);
      }
      
      // Update matching questions with audio URLs
      if (practiceFormat === "matching" || practiceFormat === "mixed") {
        const updatedMatching = matchingQuestions.map((q, idx) => ({
          ...q,
          leftAudioUrl: audioMap.get(`match-left-${idx}`) || "",
          rightAudioUrl: audioMap.get(`match-right-${idx}`) || "",
        }));
        setMatchingQuestions(updatedMatching);
      }
      
      // Update multiple choice questions with audio URLs
      if (practiceFormat === "multiple-choice" || practiceFormat === "mixed") {
        const updatedMc = multipleChoiceQuestions.map((q, idx) => ({
          ...q,
          questionAudioUrl: audioMap.get(`mc-question-${idx}`) || "",
          optionsAudioUrls: q.options.map((_, oIdx) => audioMap.get(`mc-option-${idx}-${oIdx}`) || ""),
        }));
        setMultipleChoiceQuestions(updatedMc);
      }
      
      // Update vocabulary questions with audio URLs
      if (practiceFormat === "vocabulary" || practiceFormat === "mixed") {
        const updatedVocab = vocabularyQuestions.map((q, idx) => ({
          ...q,
          wordAudioUrl: audioMap.get(`vocab-word-${idx}`) || "",
          definitionAudioUrl: audioMap.get(`vocab-def-${idx}`) || "",
          exampleAudioUrl: audioMap.get(`vocab-example-${idx}`) || "",
        }));
        setVocabularyQuestions(updatedVocab);
      }
      
      setTtsGenerated(true);
      toast.success(`Audio generated: ${summary.success} of ${summary.total} items (${summary.cached} cached)`);
    } catch (error: any) {
      console.error("TTS generation error:", error);
      toast.error(error.message || "Failed to generate TTS audio");
    } finally {
      setGeneratingTTS(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!date) {
      toast.error("Please select a date");
      return;
    }

    // Prepare questions based on practice format
    let questionsValid = false;
    
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
    };

    if (practiceFormat === "fill-in-blank" || practiceFormat === "mixed") {
      const validQuestions = fillInBlankQuestions.filter(
        (q) => q.sentence.trim() && q.correctAnswer.trim()
      );
      if (validQuestions.length > 0) {
        data.fillInBlankQuestions = validQuestions;
        questionsValid = true;
      }
    }

    if (practiceFormat === "matching" || practiceFormat === "mixed") {
      const validQuestions = matchingQuestions.filter(
        (q) => q.left.trim() && q.right.trim()
      );
      if (validQuestions.length > 0) {
        data.matchingQuestions = validQuestions;
        questionsValid = true;
      }
    }

    if (practiceFormat === "multiple-choice" || practiceFormat === "mixed") {
      const validQuestions = multipleChoiceQuestions.filter(
        (q) => q.question.trim() && q.options.some((o) => o.trim())
      );
      if (validQuestions.length > 0) {
        data.multipleChoiceQuestions = validQuestions;
        questionsValid = true;
      }
    }

    if (practiceFormat === "vocabulary" || practiceFormat === "mixed") {
      const validQuestions = vocabularyQuestions.filter(
        (q) => q.word.trim() && q.definition.trim()
      );
      if (validQuestions.length > 0) {
        data.vocabularyQuestions = validQuestions;
        questionsValid = true;
      }
    }

    if (!questionsValid) {
      toast.error("Please add at least one complete question");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/v1/daily-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create daily focus");
      }

      toast.success("Daily focus created successfully!");
      router.push("/admin/daily-focus");
    } catch (error: any) {
      toast.error(error.message || "Failed to create daily focus");
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionEditor = () => {
    switch (practiceFormat) {
      case "fill-in-blank":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Fill-in-the-Blank Questions
              </h2>
              <button
                onClick={addFillInBlankQuestion}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>

            <p className="text-sm text-gray-500 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Use ___ (three underscores) to mark the blank in the sentence
            </p>

            {fillInBlankQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
              >
                <button
                  onClick={() => removeFillInBlankQuestion(idx)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>

                <h4 className="text-sm font-bold text-gray-900 mb-4">
                  Question {idx + 1}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Sentence with blank <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.sentence}
                      onChange={(e) =>
                        updateFillInBlankQuestion(idx, "sentence", e.target.value)
                      }
                      placeholder="e.g. She ___ to the store yesterday."
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Correct Answer <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.correctAnswer}
                      onChange={(e) =>
                        updateFillInBlankQuestion(idx, "correctAnswer", e.target.value)
                      }
                      placeholder="e.g. went"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Options (comma-separated, optional)
                    </label>
                    <input
                      type="text"
                      value={q.options.join(", ")}
                      onChange={(e) =>
                        updateFillInBlankQuestion(
                          idx,
                          "options",
                          e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="e.g. went, go, goes, going"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Hint (optional)
                      </label>
                      <input
                        type="text"
                        value={q.hint}
                        onChange={(e) =>
                          updateFillInBlankQuestion(idx, "hint", e.target.value)
                        }
                        placeholder="e.g. Past tense of 'go'"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Explanation (optional)
                      </label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) =>
                          updateFillInBlankQuestion(idx, "explanation", e.target.value)
                        }
                        placeholder="e.g. We use 'went' for past actions"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "matching":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Matching Pairs</h2>
              <button
                onClick={addMatchingQuestion}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" /> Add Pair
              </button>
            </div>

            {matchingQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
              >
                <button
                  onClick={() => removeMatchingQuestion(idx)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>

                <h4 className="text-sm font-bold text-gray-900 mb-4">
                  Pair {idx + 1}
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Left Item <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.left}
                      onChange={(e) =>
                        updateMatchingQuestion(idx, "left", e.target.value)
                      }
                      placeholder="e.g. Hello"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Right Item (Match) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.right}
                      onChange={(e) =>
                        updateMatchingQuestion(idx, "right", e.target.value)
                      }
                      placeholder="e.g. 안녕하세요"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Hint (optional)
                    </label>
                    <input
                      type="text"
                      value={q.hint}
                      onChange={(e) =>
                        updateMatchingQuestion(idx, "hint", e.target.value)
                      }
                      placeholder="Optional hint"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Explanation (optional)
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        updateMatchingQuestion(idx, "explanation", e.target.value)
                      }
                      placeholder="Optional explanation"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "multiple-choice":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Multiple Choice Questions
              </h2>
              <button
                onClick={addMultipleChoiceQuestion}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>

            {multipleChoiceQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
              >
                <button
                  onClick={() => removeMultipleChoiceQuestion(idx)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>

                <h4 className="text-sm font-bold text-gray-900 mb-4">
                  Question {idx + 1}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Question <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) =>
                        updateMultipleChoiceQuestion(idx, "question", e.target.value)
                      }
                      placeholder="e.g. Which word is a verb?"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Options <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {q.options.map((option, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={q.correctIndex === oIdx}
                            onChange={() =>
                              updateMultipleChoiceQuestion(idx, "correctIndex", oIdx)
                            }
                            className="w-4 h-4 text-green-600"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) =>
                              updateMultipleChoiceOption(idx, oIdx, e.target.value)
                            }
                            placeholder={`Option ${oIdx + 1}`}
                            className="flex-1 px-4 py-2 bg-white border border-gray-100 rounded-xl"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the radio button for the correct answer
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Hint (optional)
                      </label>
                      <input
                        type="text"
                        value={q.hint}
                        onChange={(e) =>
                          updateMultipleChoiceQuestion(idx, "hint", e.target.value)
                        }
                        placeholder="Optional hint"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Explanation (optional)
                      </label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) =>
                          updateMultipleChoiceQuestion(idx, "explanation", e.target.value)
                        }
                        placeholder="Optional explanation"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case "vocabulary":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Vocabulary Items
              </h2>
              <button
                onClick={addVocabularyQuestion}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-[#3d8c40] font-bold text-sm rounded-xl hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" /> Add Word
              </button>
            </div>

            {vocabularyQuestions.map((q, idx) => (
              <div
                key={idx}
                className="p-6 bg-gray-50/50 rounded-2xl relative border border-gray-100"
              >
                <button
                  onClick={() => removeVocabularyQuestion(idx)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>

                <h4 className="text-sm font-bold text-gray-900 mb-4">
                  Word {idx + 1}
                </h4>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Word <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={q.word}
                        onChange={(e) =>
                          updateVocabularyQuestion(idx, "word", e.target.value)
                        }
                        placeholder="e.g. Ubiquitous"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Pronunciation (optional)
                      </label>
                      <input
                        type="text"
                        value={q.pronunciation}
                        onChange={(e) =>
                          updateVocabularyQuestion(idx, "pronunciation", e.target.value)
                        }
                        placeholder="e.g. /juːˈbɪkwɪtəs/"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Definition <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.definition}
                      onChange={(e) =>
                        updateVocabularyQuestion(idx, "definition", e.target.value)
                      }
                      placeholder="e.g. Present, appearing, or found everywhere"
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">
                      Example Sentence (optional)
                    </label>
                    <input
                      type="text"
                      value={q.exampleSentence}
                      onChange={(e) =>
                        updateVocabularyQuestion(idx, "exampleSentence", e.target.value)
                      }
                      placeholder="e.g. Smartphones have become ubiquitous in modern society."
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Hint (optional)
                      </label>
                      <input
                        type="text"
                        value={q.hint}
                        onChange={(e) =>
                          updateVocabularyQuestion(idx, "hint", e.target.value)
                        }
                        placeholder="Optional hint"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        Explanation (optional)
                      </label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) =>
                          updateVocabularyQuestion(idx, "explanation", e.target.value)
                        }
                        placeholder="Optional explanation"
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => router.back()}
          className="p-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Daily Focus
          </h1>
          <p className="text-gray-500 text-sm">
            Create practice content for a specific day
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Questions Section */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            {renderQuestionEditor()}
          </div>
        </div>

        {/* Settings Section */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Settings</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grammar: Subject-Verb Agreement"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Focus Type
                  </label>
                  <div className="relative">
                    <select
                      value={focusType}
                      onChange={(e) => setFocusType(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
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
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Practice Format
                  </label>
                  <div className="relative">
                    <select
                      value={practiceFormat}
                      onChange={(e) => setPracticeFormat(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
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
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Difficulty
                  </label>
                  <div className="relative">
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Est. Minutes
                  </label>
                  <input
                    type="number"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 5)}
                    min="1"
                    max="60"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the focus..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showExplanations"
                  checked={showExplanations}
                  onChange={(e) => setShowExplanations(e.target.checked)}
                  className="w-4 h-4 rounded text-green-600 accent-green-600"
                />
                <label htmlFor="showExplanations" className="text-sm text-gray-700">
                  Show explanations after submission
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-100 p-6 flex gap-4 z-10">
        <button
          onClick={generateTTSAudio}
          disabled={loading || generatingTTS}
          className={`px-6 py-3.5 font-bold rounded-full transition-all flex items-center gap-2 ${
            ttsGenerated
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {generatingTTS ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Audio...
            </>
          ) : ttsGenerated ? (
            <>
              <Check className="w-4 h-4" />
              Audio Generated
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              Generate Audio
            </>
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || generatingTTS}
          className="px-8 py-3.5 bg-[#418b43] text-white font-bold rounded-full hover:bg-[#3a7c3b] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Daily Focus"
          )}
        </button>
        <button
          onClick={() => router.back()}
          disabled={loading || generatingTTS}
          className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-full hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

