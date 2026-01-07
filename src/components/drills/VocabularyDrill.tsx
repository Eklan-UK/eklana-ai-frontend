"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { LetterLevelFeedback } from "@/components/ui/LetterLevelFeedback";
import { ArrowLeft, CheckCircle, Mic, Loader2, Volume2, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { drillAPI } from "@/lib/api";
import type { TextScore } from "@/services/speechace.service";
import { speechaceService } from "@/services/speechace.service";

interface VocabularyDrillProps {
  drill: any;
  assignmentId?: string;
}

type Screen = "word" | "sentence";

interface WordProgress {
  wordPassed: boolean;
  wordScore: number | null;
  sentencePassed: boolean;
  sentenceScore: number | null;
}

export default function VocabularyDrill({ drill, assignmentId }: VocabularyDrillProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentScreen, setCurrentScreen] = useState<Screen>("word");
  const [wordProgress, setWordProgress] = useState<Record<number, WordProgress>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const targetSentences = drill.target_sentences || [];
  const currentSentence = targetSentences[currentIndex];
  const currentProgress = wordProgress[currentIndex] || {
    wordPassed: false,
    wordScore: null,
    sentencePassed: false,
    sentenceScore: null,
  };

  // Initialize progress tracking
  useEffect(() => {
    const initialProgress: Record<number, WordProgress> = {};
    targetSentences.forEach((_: any, index: number) => {
      initialProgress[index] = {
        wordPassed: false,
        wordScore: null,
        sentencePassed: false,
        sentenceScore: null,
      };
    });
    setWordProgress(initialProgress);
  }, [targetSentences.length]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        // Auto-analyze after recording stops
        await analyzePronunciation(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setPronunciationScore(null);
    } catch (error: any) {
      toast.error("Failed to access microphone: " + error.message);
      console.error("Error accessing microphone:", error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Analyze pronunciation with SpeechAce
  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!currentSentence) return;

    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      // Determine text to analyze based on current screen
      const textToAnalyze =
        currentScreen === "word"
          ? currentSentence.word || currentSentence.text.split(" ")[0]
          : currentSentence.text;

      // Call SpeechAce API
      const speechAceResponse = await speechaceService.scorePronunciation(
        textToAnalyze,
        audioBlob
      );

      const result = speechAceResponse.data as any;
      let textScore: TextScore | null = null;

      // Parse response (same logic as pronunciation practice page)
      if (result?.textScore && typeof result.textScore === "object") {
        textScore = result.textScore as TextScore;
      } else if (result?.text_score && typeof result.text_score === "object") {
        textScore = result.text_score as TextScore;
      } else if (result?.data?.text_score) {
        textScore = result.data.text_score as TextScore;
      }

      if (textScore) {
        setPronunciationScore(textScore);
        const score = textScore.speechace_score.pronunciation;
        const passed = score >= 65;

        // Update progress based on current screen
        setWordProgress((prev) => {
          const current = prev[currentIndex] || {
            wordPassed: false,
            wordScore: null,
            sentencePassed: false,
            sentenceScore: null,
          };

          if (currentScreen === "word") {
            return {
              ...prev,
              [currentIndex]: {
                ...current,
                wordPassed: passed,
                wordScore: score,
              },
            };
          } else {
            return {
              ...prev,
              [currentIndex]: {
                ...current,
                sentencePassed: passed,
                sentenceScore: score,
              },
            };
          }
        });

        if (passed) {
          toast.success(
            `Great! You scored ${score.toFixed(0)}% - ${currentScreen === "word" ? "Word" : "Sentence"} passed!`
          );
        } else {
          toast.warning(
            `Score: ${score.toFixed(0)}%. You need at least 65% to pass. Try again!`
          );
        }
      } else {
        throw new Error("Invalid response from SpeechAce - missing textScore");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze pronunciation");
      console.error("Error analyzing pronunciation:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Try again - reset current attempt
  const handleTryAgain = () => {
    setPronunciationScore(null);
    setAudioBlob(null);
  };

  // Continue to sentence screen (only if word passed)
  const handleContinueToSentence = () => {
    if (currentProgress.wordPassed) {
      setCurrentScreen("sentence");
      setPronunciationScore(null);
      setAudioBlob(null);
    } else {
      toast.error("You must pass the word pronunciation (65%+) before proceeding to the sentence");
    }
  };

  // Move to next vocabulary item (only if both passed)
  const handleNext = () => {
    if (!currentProgress.wordPassed || !currentProgress.sentencePassed) {
      toast.error("You must pass both word and sentence pronunciation before proceeding");
      return;
    }

    if (currentIndex < targetSentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentScreen("word");
      setPronunciationScore(null);
      setAudioBlob(null);
    } else {
      // All items completed - submit
      handleSubmit();
    }
  };

  // Submit drill completion
  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Calculate overall score based on passed items
      const totalItems = targetSentences.length;
      const passedItems = Object.values(wordProgress).filter(
        (p) => p.wordPassed && p.sentencePassed
      ).length;
      const score = Math.round((passedItems / totalItems) * 100);

      // Prepare vocabulary results with pronunciation scores
      const wordScores = targetSentences.map((sentence: any, index: number) => {
        const progress = wordProgress[index] || {
          wordPassed: false,
          wordScore: null,
          sentencePassed: false,
          sentenceScore: null,
        };
        return {
          word: sentence.word || sentence.text.split(" ")[0],
          sentence: sentence.text,
          wordScore: progress.wordScore || 0,
          sentenceScore: progress.sentenceScore || 0,
          wordPassed: progress.wordPassed,
          sentencePassed: progress.sentencePassed,
          attempts: 1, // Could track actual attempts if needed
        };
      });

      // Submit to API
      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        vocabularyResults: {
          wordScores,
        },
        platform: "web",
      });

      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      // Track completion in recent activities
      try {
        await fetch("/api/v1/activities/recent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "drill",
            resourceId: drill._id,
            action: "completed",
            metadata: {
              title: drill.title,
              type: drill.type,
              score,
            },
          }),
        });
      } catch (error) {
        console.error("Failed to track activity:", error);
      }
    } catch (error: any) {
      toast.error("Failed to submit drill: " + (error.message || "Unknown error"));
      console.error("Error submitting drill:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title="Drill Completed" />

        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job!</h2>
            <p className="text-gray-600 mb-6">You've completed the vocabulary drill.</p>
            <Link href="/account">
              <Button variant="primary" size="lg" fullWidth>
                Continue Learning
              </Button>
            </Link>
          </Card>
        </div>

        <BottomNav />
      </div>
    );
  }

  if (!currentSentence) {
    return (
      <div className="min-h-screen bg-white pb-20 md:pb-0">
        <div className="h-6"></div>
        <Header title={drill.title} />
        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="text-center py-8">
            <p className="text-gray-600">No vocabulary items found in this drill.</p>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  const currentWord = currentSentence.word || currentSentence.text.split(" ")[0];
  const currentText =
    currentScreen === "word" ? currentWord : currentSentence.text;
  const isWordPassed = currentProgress.wordPassed;
  const isSentencePassed = currentProgress.sentencePassed;
  const canContinueToSentence = isWordPassed;
  const canProceedToNext = isWordPassed && isSentencePassed;

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title={drill.title} />

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>
              Item {currentIndex + 1} of {targetSentences.length}
            </span>
            <span>{Math.round(((currentIndex + 1) / targetSentences.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / targetSentences.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Screen Indicator */}
        <div className="mb-4 flex gap-2">
          <div
            className={`flex-1 p-3 rounded-lg text-center ${
              currentScreen === "word"
                ? "bg-blue-100 border-2 border-blue-500"
                : isWordPassed
                  ? "bg-green-50 border border-green-300"
                  : "bg-gray-100 border border-gray-300"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {isWordPassed && currentScreen !== "word" && (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  currentScreen === "word" ? "text-blue-700" : isWordPassed ? "text-green-700" : "text-gray-600"
                }`}
              >
                Word
              </span>
            </div>
          </div>
          <div
            className={`flex-1 p-3 rounded-lg text-center ${
              currentScreen === "sentence"
                ? "bg-blue-100 border-2 border-blue-500"
                : isSentencePassed
                  ? "bg-green-50 border border-green-300"
                  : !isWordPassed
                    ? "bg-gray-100 border border-gray-300 opacity-50"
                    : "bg-gray-100 border border-gray-300"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {!isWordPassed && currentScreen !== "sentence" && (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
              {isSentencePassed && currentScreen !== "sentence" && (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  currentScreen === "sentence"
                    ? "text-blue-700"
                    : isSentencePassed
                      ? "text-green-700"
                      : !isWordPassed
                        ? "text-gray-400"
                        : "text-gray-600"
                }`}
              >
                Sentence
              </span>
            </div>
          </div>
        </div>

        <Card className="mb-4">
          <div className="text-center py-6">
            {/* Word/Sentence Display */}
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-700 mb-2">
                {currentScreen === "word" ? "Pronounce the Word" : "Pronounce the Sentence"}
              </h2>
              <div className="flex items-center justify-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {currentText}
                </h1>
                <TTSButton
                  text={currentText}
                  size="lg"
                  autoPlay={autoPlayAudio && !pronunciationScore}
                />
              </div>
              {currentScreen === "word" && currentSentence.wordTranslation && (
                <p className="text-sm text-gray-500 mt-2">{currentSentence.wordTranslation}</p>
              )}
              {currentScreen === "sentence" && currentSentence.translation && (
                <p className="text-sm text-gray-500 mt-2">{currentSentence.translation}</p>
              )}
            </div>

            {/* Lock message for sentence screen */}
            {currentScreen === "sentence" && !isWordPassed && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-yellow-800">
                  <Lock className="w-4 h-4" />
                  <p className="text-sm font-medium">
                    Complete word pronunciation first (65%+ required)
                  </p>
                </div>
              </div>
            )}

            {/* Listen Section */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Listen to the correct pronunciation
              </h3>
              <TTSButton
                text={currentText}
                size="lg"
                variant="button"
                autoPlay={autoPlayAudio && !pronunciationScore}
              />
            </div>

            {/* Record Section */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Record your pronunciation
              </h3>
              <div className="relative">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isAnalyzing || (currentScreen === "sentence" && !isWordPassed)}
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : "bg-blue-500 hover:bg-blue-600"
                  }`}
                >
                  <Mic className="w-12 h-12 text-white" />
                </button>
                {isRecording && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
                    Recording... Tap to stop
                  </div>
                )}
              </div>
              {!isRecording && !isAnalyzing && !pronunciationScore && (
                <p className="text-sm text-gray-500 mt-4">
                  Tap the microphone to start recording
                </p>
              )}
              {isAnalyzing && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">Analyzing your pronunciation...</p>
                </div>
              )}
              {pronunciationScore && !isAnalyzing && (
                <p className="text-sm text-green-600 mt-4 font-medium">
                  ✓ Analysis complete! Scroll down to see your score.
                </p>
              )}
            </div>

            {/* Auto-play toggle */}
            <label className="flex items-center justify-center gap-2 text-sm text-gray-600 mt-4">
              <input
                type="checkbox"
                checked={autoPlayAudio}
                onChange={(e) => setAutoPlayAudio(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span>Auto-play pronunciation</span>
            </label>
          </div>
        </Card>

        {/* Word Quality Analytics Section */}
        {pronunciationScore && (
          <div className="mb-4 space-y-4">
            {/* Overall Score Indicator (simple) */}
            <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      pronunciationScore.speechace_score.pronunciation >= 65
                        ? "bg-green-100"
                        : "bg-yellow-100"
                    }`}
                  >
                    <span
                      className={`text-2xl font-bold ${
                        pronunciationScore.speechace_score.pronunciation >= 65
                          ? "text-green-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {Math.round(pronunciationScore.speechace_score.pronunciation)}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-600">Pronunciation Score</p>
                    <p className="text-xs text-gray-500">
                      {pronunciationScore.speechace_score.pronunciation >= 65
                        ? "✓ Passed"
                        : "Need 65% to pass"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Word Quality Analytics */}
            {pronunciationScore.word_score_list.map((wordScore, wordIndex) => (
              <Card key={wordIndex}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {wordScore.word}
                    </h3>
                    <p className="text-xs text-gray-500">Word Quality Score</p>
                  </div>
                  <div
                    className={`w-14 h-14 rounded-full ${
                      wordScore.quality_score >= 80
                        ? "bg-green-100"
                        : wordScore.quality_score >= 70
                          ? "bg-yellow-100"
                          : "bg-red-100"
                    } flex items-center justify-center`}
                  >
                    <span
                      className={`text-lg font-bold ${
                        wordScore.quality_score >= 80
                          ? "text-green-600"
                          : wordScore.quality_score >= 70
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {Math.round(wordScore.quality_score)}
                    </span>
                  </div>
                </div>

                {/* Syllable Breakdown */}
                {wordScore.syllable_score_list.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      Syllables
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      {wordScore.syllable_score_list.map((syllable, sylIndex) => (
                        <div
                          key={sylIndex}
                          className="flex-1 min-w-[80px] p-2 bg-gray-50 rounded-lg"
                        >
                          <p className="text-xs font-medium text-gray-900 mb-1">
                            {syllable.letters}
                          </p>
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold ${
                                syllable.quality_score >= 80
                                  ? "text-green-600"
                                  : syllable.quality_score >= 70
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {Math.round(syllable.quality_score)}
                            </span>
                            {syllable.stress_level !== null && (
                              <span className="text-xs text-gray-500">
                                Stress: {syllable.stress_level}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phone (Phoneme) Breakdown */}
                {wordScore.phone_score_list.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Phonemes</h4>
                    <div className="flex gap-1 flex-wrap">
                      {wordScore.phone_score_list.map((phone, phoneIndex) => (
                        <div
                          key={phoneIndex}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            phone.quality_score >= 80
                              ? "bg-green-100 text-green-600"
                              : phone.quality_score >= 70
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-red-100 text-red-600"
                          }`}
                          title={`${phone.phone}: ${Math.round(phone.quality_score)}%`}
                        >
                          {phone.phone}
                          <span className="ml-1 text-[10px]">
                            {Math.round(phone.quality_score)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {/* Letter-level Feedback for word screen */}
            {currentScreen === "word" &&
              pronunciationScore.word_score_list.length > 0 && (
                <LetterLevelFeedback
                  word={currentWord}
                  wordScore={pronunciationScore.word_score_list[0]}
                />
              )}

            {/* Pass/Fail Message */}
            {pronunciationScore.speechace_score.pronunciation < 65 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 text-center">
                  You need at least 65% to pass. Try again!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {currentScreen === "word" && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleContinueToSentence}
              disabled={!canContinueToSentence || isRecording || isAnalyzing}
            >
              {canContinueToSentence ? (
                "Continue to Sentence"
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Pass Word First (65%+)
                </>
              )}
            </Button>
          )}

          {currentScreen === "sentence" && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleNext}
              disabled={!canProceedToNext || isRecording || isAnalyzing}
            >
              {canProceedToNext ? (
                currentIndex === targetSentences.length - 1 ? (
                  "Complete Drill"
                ) : (
                  "Next Item"
                )
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Pass Sentence First (65%+)
                </>
              )}
            </Button>
          )}

          {pronunciationScore && (
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={handleTryAgain}
              disabled={isRecording || isAnalyzing}
            >
              Try Again
            </Button>
          )}

          {currentScreen === "sentence" && (
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                setCurrentScreen("word");
                setPronunciationScore(null);
                setAudioBlob(null);
              }}
              disabled={isRecording || isAnalyzing}
            >
              Back to Word
            </Button>
          )}

          {currentIndex > 0 && currentScreen === "word" && (
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                setCurrentIndex(currentIndex - 1);
                setCurrentScreen("word");
                setPronunciationScore(null);
                setAudioBlob(null);
              }}
              disabled={isRecording || isAnalyzing}
            >
              Previous Item
            </Button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
