"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { CheckCircle, XCircle, Mic, Loader2, Square, Send } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { drillAPI } from "@/lib/api";
import { completeWeeklyChallengeItem } from "@/lib/challenges/weekly-challenge-client";
import type { WeeklyChallengeMeta } from "./DrillPracticeInterface";
import type { TextScore } from "@/services/speechace.service";
import { speechaceService } from "@/services/speechace.service";
import { trackActivity } from "@/utils/activity-cache";
import {
  DrillCompletionScreen,
  DrillLayout,
  DrillProgress,
  DrillPerformanceReview,
  DrillLineReviewAccordion,
  RecordingPreviewBar,
  type PerformanceReviewAnalyticsRow,
  type PerformanceReviewGroup,
} from "./shared";
import { preloadTTSAudio } from "@/hooks/useTTS";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface KeyPhrasesDrillProps {
  drill: any;
  assignmentId?: string;
  weeklyChallengeMeta?: WeeklyChallengeMeta;
}

interface ItemResult {
  prompt: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  pronunciationScore?: number;
  textScore?: Record<string, unknown>;
  attempts: number;
}

const MAX_RECORDING_SECONDS = 120;
const PASS_THRESHOLD = 65;

/** Compact, borderless cards for key phrases practice UI */
const KP_GHOST_CARD = "w-full bg-transparent border-0 shadow-none";

export default function KeyPhrasesDrill({
  drill,
  assignmentId,
  weeklyChallengeMeta,
}: KeyPhrasesDrillProps) {
  const queryClient = useQueryClient();
  const items = useMemo(() => drill.key_phrase_items || [], [drill.key_phrase_items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [itemResults, setItemResults] = useState<Record<number, ItemResult>>({});
  const [attempts, setAttempts] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [startTime] = useState(Date.now());
  const [sessionReviewAnalytics, setSessionReviewAnalytics] = useState<
    PerformanceReviewAnalyticsRow[]
  >([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [pendingSubmitBlob, setPendingSubmitBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentItem = items[currentIndex];
  const currentResult = itemResults[currentIndex];

  const revokeRecordingPreview = useCallback(() => {
    setRecordingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const discardPendingRecording = useCallback(() => {
    setPendingSubmitBlob(null);
    revokeRecordingPreview();
  }, [revokeRecordingPreview]);

  useEffect(() => {
    return () => {
      revokeRecordingPreview();
    };
  }, [revokeRecordingPreview]);

  // Pre-warm prompt TTS for every question while the drill loads / between questions
  useEffect(() => {
    for (const item of items) {
      const prompt = item?.prompt?.trim();
      if (!prompt) continue;
      if (item.promptAudioUrl) {
        const audio = new Audio(item.promptAudioUrl);
        audio.preload = "auto";
        audio.setAttribute("playsinline", "true");
        audio.load();
      } else {
        void preloadTTSAudio(prompt);
      }
    }
  }, [items]);

  const clearRecordingTimers = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (!selectedOption) {
      toast.error("Please select an option first before recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 32000,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setPendingSubmitBlob(blob);
        setRecordingPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setPronunciationScore(null);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
        toast.info("Recording stopped — 2 minute limit reached.");
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error: any) {
      toast.error("Failed to access microphone: " + error.message);
    }
  };

  const stopRecording = () => {
    clearRecordingTimers();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!selectedOption || !currentItem) return;

    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      const speechAceResponse = await speechaceService.scorePronunciation(
        selectedOption,
        audioBlob
      );

      const result = speechAceResponse.data as any;
      let textScore: TextScore | null = null;

      if (result?.textScore && typeof result.textScore === "object") {
        textScore = result.textScore as TextScore;
      } else if (result?.text_score && typeof result.text_score === "object") {
        textScore = result.text_score as TextScore;
      } else if (result?.data?.text_score) {
        textScore = result.data.text_score as TextScore;
      }

      if (!textScore) {
        throw new Error("Invalid response from Speechace — missing textScore");
      }

      setPronunciationScore(textScore);
      const score = textScore.speechace_score.pronunciation;
      const isCorrect = selectedOption === currentItem.correctAnswer;
      const itemScore = isCorrect ? score : 0;
      const passed = isCorrect && score >= PASS_THRESHOLD;
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      setItemResults((prev) => ({
        ...prev,
        [currentIndex]: {
          prompt: currentItem.prompt,
          selectedAnswer: selectedOption,
          correctAnswer: currentItem.correctAnswer,
          isCorrect,
          pronunciationScore: itemScore,
          textScore: textScore as unknown as Record<string, unknown>,
          attempts: newAttempts,
        },
      }));

      setSessionReviewAnalytics((prev) => {
        const filtered = prev.filter(
          (r) => !(r.sceneIndex === currentIndex && r.turnIndex === 0)
        );
        return [
          ...filtered,
          {
            sceneIndex: currentIndex,
            turnIndex: 0,
            text: selectedOption,
            score: itemScore,
            textScore,
            attempts: newAttempts,
          },
        ];
      });

      if (!isCorrect) {
        toast.error(
          `Wrong choice — the correct answer was "${currentItem.correctAnswer}". Score: 0.`
        );
      } else if (passed) {
        toast.success(`Correct! Pronunciation: ${score.toFixed(0)}% ✓`);
      } else {
        toast.warning(
          `Correct choice, but pronunciation needs work: ${score.toFixed(0)}% (need ${PASS_THRESHOLD}%). Try again!`
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze pronunciation");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitPendingForAnalysis = async () => {
    if (!pendingSubmitBlob) return;
    const blob = pendingSubmitBlob;
    setPendingSubmitBlob(null);
    revokeRecordingPreview();
    await analyzePronunciation(blob);
  };

  const handleTryAgain = () => {
    setPronunciationScore(null);
    discardPendingRecording();
    if (currentResult && !currentResult.isCorrect) {
      setSelectedOption(null);
    }
    setAttempts(0);
  };

  const handleNext = () => {
    if (!currentResult?.isCorrect || (currentResult.pronunciationScore ?? 0) < PASS_THRESHOLD) {
      toast.error(
        "You need to select the correct answer and pass pronunciation (65%+) before continuing."
      );
      return;
    }
    discardPendingRecording();
    setPronunciationScore(null);
    setSelectedOption(null);
    setAttempts(0);

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowReview(true);
    }
  };

  const reviewGroups: PerformanceReviewGroup[] = useMemo(() => {
    const map = new Map<number, PerformanceReviewAnalyticsRow[]>();
    for (const row of sessionReviewAnalytics) {
      const list = map.get(row.sceneIndex) ?? [];
      list.push(row);
      map.set(row.sceneIndex, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sceneIndex, rows]) => {
        const item = items[sceneIndex];
        const preview =
          (item?.prompt || `Question ${sceneIndex + 1}`).slice(0, 48) +
          ((item?.prompt || "").length > 48 ? "…" : "");
        return {
          sceneIndex,
          sceneTitle: `Question ${sceneIndex + 1}: ${preview}`,
          rows: rows.sort((x, y) => x.turnIndex - y.turnIndex),
        };
      });
  }, [sessionReviewAnalytics, items]);

  const reviewAvgScore = useMemo(() => {
    if (sessionReviewAnalytics.length > 0) {
      return Math.round(
        sessionReviewAnalytics.reduce((s, r) => s + r.score, 0) /
          sessionReviewAnalytics.length
      );
    }
    const scores = Object.values(itemResults)
      .map((r) => r.pronunciationScore ?? 0)
      .filter((s) => s > 0);
    return scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }, [sessionReviewAnalytics, itemResults]);

  const reviewStatsLine = useMemo(() => {
    const correctItems = Object.values(itemResults).filter((r) => r.isCorrect).length;
    return `${correctItems} of ${items.length} correct · ${sessionReviewAnalytics.length} scored attempts`;
  }, [itemResults, items.length, sessionReviewAnalytics.length]);

  const handleSubmit = async () => {
    if (!assignmentId && !weeklyChallengeMeta) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }
    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const resultList = items.map((_: any, i: number) => {
        const r = itemResults[i];
        return (
          r ?? {
            prompt: items[i].prompt,
            selectedAnswer: "",
            correctAnswer: items[i].correctAnswer,
            isCorrect: false,
            pronunciationScore: 0,
            textScore: undefined,
            attempts: 0,
          }
        );
      });

      const totalItems = items.length;
      const correctItems = resultList.filter((r: ItemResult) => r.isCorrect).length;
      const avgScore =
        totalItems > 0
          ? Math.round(
              resultList.reduce(
                (sum: number, r: ItemResult) => sum + (r.pronunciationScore ?? 0),
                0
              ) / totalItems
            )
          : 0;

      if (weeklyChallengeMeta) {
        await completeWeeklyChallengeItem(queryClient, weeklyChallengeMeta.itemId, {
          score: avgScore,
          weekStartDate: weeklyChallengeMeta.weekStartDate,
        });
      } else {
        await drillAPI.complete(drill._id, {
          drillAssignmentId: assignmentId!,
          score: avgScore,
          timeSpent,
          keyPhrasesResults: {
            items: resultList,
            totalItems,
            correctItems,
            score: avgScore,
          },
          performanceReviewSnapshot: {
            version: 1,
            ui: "drillPerformance",
            avgScore: reviewAvgScore,
            statsLine: reviewStatsLine,
            passThreshold: PASS_THRESHOLD,
            sectionHeading: "Question-by-Question Analysis",
            groups: JSON.parse(JSON.stringify(reviewGroups)),
          },
          platform: "web",
        });
      }

      setShowReview(false);
      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        score: avgScore,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to submit drill");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePracticeAgainFromReview = () => {
    setShowReview(false);
    setCurrentIndex(0);
    setSelectedOption(null);
    setItemResults({});
    setSessionReviewAnalytics([]);
    setPronunciationScore(null);
    discardPendingRecording();
    setAttempts(0);
  };

  const inDrillReviewRow: PerformanceReviewAnalyticsRow | null = useMemo(() => {
    if (!pronunciationScore || !selectedOption) return null;
    const match = sessionReviewAnalytics.find(
      (r) => r.sceneIndex === currentIndex && r.turnIndex === 0
    );
    return {
      sceneIndex: currentIndex,
      turnIndex: 0,
      text: selectedOption,
      score: pronunciationScore.speechace_score.pronunciation,
      textScore: pronunciationScore,
      attempts: match?.attempts ?? (attempts || 1),
    };
  }, [pronunciationScore, selectedOption, currentIndex, sessionReviewAnalytics, attempts]);

  if (isCompleted) {
    const returnPath = weeklyChallengeMeta
      ? `/account/practice/weekly-challenge/${encodeURIComponent(weeklyChallengeMeta.weekStartDate)}`
      : "/account/drills";
    return (
      <DrillCompletionScreen
        drillType={weeklyChallengeMeta ? "Key Phrases" : "key phrases"}
        returnPath={returnPath}
        returnLabel={weeklyChallengeMeta ? "Back to Challenge" : "Back to My Plan"}
      />
    );
  }

  if (showReview) {
    return (
      <DrillLayout title="Review Performance" hideNavigation>
        <DrillPerformanceReview
          avgScore={reviewAvgScore}
          statsLine={reviewStatsLine}
          groups={reviewGroups}
          passThreshold={PASS_THRESHOLD}
          sectionHeading="Question-by-Question Analysis"
          onDone={() => void handleSubmit()}
          onPracticeAgain={handlePracticeAgainFromReview}
          isSubmitting={isSubmitting}
        />
      </DrillLayout>
    );
  }

  if (!currentItem) {
    return (
      <DrillLayout title={drill.title}>
        <Card className="p-6 text-center text-muted-foreground">
          No key phrase items found for this drill.
        </Card>
      </DrillLayout>
    );
  }

  const passed =
    currentResult?.isCorrect &&
    (currentResult.pronunciationScore ?? 0) >= PASS_THRESHOLD;

  const awaitingSubmit = !!pendingSubmitBlob && !isAnalyzing && !pronunciationScore;

  const answeredCount = Object.values(itemResults).filter(
    (r) => r.isCorrect && (r.pronunciationScore ?? 0) >= PASS_THRESHOLD
  ).length;

  return (
    <DrillLayout
      title={drill.title}
      headerRight={
        <BookmarkButton
          itemId={`${drill._id}-kp-${currentIndex}`}
          itemType="sentence"
          content={currentItem.prompt}
          sourceDrillId={drill._id}
        />
      }
    >
      <div className="w-full space-y-6 pb-10">
        <DrillProgress
          current={answeredCount}
          total={items.length}
          label="Question"
          embedded
        />

        <Card padding="sm" className={`${KP_GHOST_CARD} space-y-2`}>
          <p className="text-sm font-semibold text-foreground">
            {currentItem.respondentName?.trim()
              ? `${currentItem.respondentName.trim()} says`
              : "Speaker says"}
          </p>
          <div className="flex items-start justify-between gap-4">
            <p className="min-w-0 flex-1 text-lg font-semibold text-foreground leading-snug break-words pr-1">
              {currentItem.prompt}
            </p>
            <TTSButton
              text={currentItem.prompt}
              audioUrl={currentItem.promptAudioUrl}
              className="shrink-0"
            />
          </div>
        </Card>

        <div className="w-full space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Your response</h3>
          <div className="flex flex-col gap-2.5">
            {currentItem.options.map((option: string, idx: number) => {
              const isSelected = selectedOption === option;
              const isCorrectOption = option === currentItem.correctAnswer;
              const hasResult = !!pronunciationScore;

              let cardStyle =
                "box-border w-full min-h-[3.75rem] rounded-2xl border-2 px-4 py-3.5 text-sm font-medium flex items-center gap-3 text-left transition-colors ";
              if (hasResult) {
                cardStyle += isCorrectOption
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                  : isSelected
                    ? "border-red-400 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100"
                    : "border-border/80 bg-muted/50 text-muted-foreground";
              } else if (isSelected) {
                cardStyle += "border-sky-500 bg-sky-50 text-emerald-900 dark:bg-sky-950/30 dark:text-emerald-800";
              } else {
                cardStyle +=
                  "border-border bg-card text-foreground hover:border-sky-300 hover:bg-sky-50/50 dark:hover:bg-sky-950/20";
              }

              const showCheck = hasResult && isCorrectOption;
              const showX = hasResult && isSelected && !isCorrectOption;
              const showLetter = !showCheck && !showX;

              return (
                <button
                  key={idx}
                  type="button"
                  className={cardStyle + (hasResult ? "" : " cursor-pointer")}
                  disabled={!!pronunciationScore}
                  onClick={() => {
                    if (!pronunciationScore) {
                      setSelectedOption(option);
                      setPronunciationScore(null);
                      discardPendingRecording();
                    }
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center"
                    aria-hidden={!showLetter}
                  >
                    {showCheck && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                    {showX && <XCircle className="h-5 w-5 text-red-500" />}
                    {showLetter && (
                      <span className="box-border flex h-8 w-8 items-center justify-center rounded-full border-2 border-current text-xs font-semibold leading-none">
                        {String.fromCharCode(65 + idx)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 py-0.5 leading-snug break-words">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixed-height action area so selection / scoring does not shift layout */}
        <div className="w-full min-h-[160px] flex flex-col">
          {selectedOption && !pronunciationScore && (
            <Card padding="none" className={`${KP_GHOST_CARD} min-h-[160px] space-y-2`}>
              <p className="text-sm text-muted-foreground">
                Read your chosen response aloud:{" "}
                <span className="font-semibold text-foreground">"{selectedOption}"</span>
              </p>

              <div>
                {awaitingSubmit && recordingPreviewUrl ? (
                  <div className="space-y-3">
                    <RecordingPreviewBar
                      key={recordingPreviewUrl}
                      src={recordingPreviewUrl}
                      onDiscard={discardPendingRecording}
                    />
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => void submitPendingForAnalysis()}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit for feedback
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-h-12">
                    {isRecording ? (
                      <Button
                        variant="outline"
                        onClick={stopRecording}
                        className="flex items-center gap-2 text-red-600 border-red-200"
                      >
                        <Square className="w-4 h-4" />
                        Stop ({MAX_RECORDING_SECONDS - recordingSeconds}s)
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void startRecording()}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                        {isAnalyzing ? "Analyzing…" : "Record"}
                      </Button>
                    )}
                    {isRecording && (
                      <span className="text-sm text-red-500 font-medium animate-pulse">
                        Recording… {recordingSeconds}s
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {!selectedOption && !pronunciationScore && (
            <Card
              padding="none"
              className={`${KP_GHOST_CARD} flex min-h-[160px] items-center justify-center`}
            >
              <p className="text-sm text-muted-foreground text-center">
                Select a response above to record yourself.
              </p>
            </Card>
          )}

          {pronunciationScore && (
            <Card padding="none" className={`${KP_GHOST_CARD} min-h-[160px] space-y-3`}>
              <div className="flex items-start gap-3">
                {passed ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-semibold ${passed ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                  >
                    {currentResult?.isCorrect
                      ? passed
                        ? "Passed!"
                        : `Pronunciation: ${pronunciationScore.speechace_score.pronunciation.toFixed(0)}% — try again`
                      : `Wrong choice — correct: "${currentItem.correctAnswer}"`}
                  </p>
                  {currentResult?.isCorrect && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Pronunciation score:{" "}
                      {pronunciationScore.speechace_score.pronunciation.toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                {!passed && (
                  <Button variant="outline" onClick={handleTryAgain} className="flex-1">
                    Try Again
                  </Button>
                )}
                {passed && (
                  <Button variant="primary" onClick={handleNext} className="flex-1">
                    {currentIndex < items.length - 1 ? "Next Question" : "Review"}
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>

        {inDrillReviewRow && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground px-1">Your performance</h3>
            <DrillLineReviewAccordion
              key={`${inDrillReviewRow.sceneIndex}-${inDrillReviewRow.turnIndex}-${inDrillReviewRow.attempts}`}
              row={inDrillReviewRow}
              passThreshold={PASS_THRESHOLD}
              lineLabel="Response"
            />
          </div>
        )}
      </div>
    </DrillLayout>
  );
}
