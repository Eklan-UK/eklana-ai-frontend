"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { CheckCircle, Mic, Loader2, Lock, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { drillAPI, pronunciationAPI } from "@/lib/api";
import type { TextScore } from "@/services/speechace.service";
import { trackActivity } from "@/utils/activity-cache";
import { speechaceService } from "@/services/speechace.service";
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
import { transcriptFromTextScore } from "./shared/speechaceTranscript";
import { BookmarkButton } from "@/components/common/BookmarkButton";

interface PronunciationDrillProps {
  drill: any;
  assignmentId?: string;
}

type Screen = "word" | "sentence";

interface PronunciationTranscriptEntry {
  itemIndex: number;
  screen: Screen;
  expected: string;
  transcript: string;
}

interface WordProgress {
  wordPassed: boolean;
  wordScore: number | null;
  sentencePassed: boolean;
  sentenceScore: number | null;
}

const MAX_RECORDING_SECONDS = 120;
const PASS_THRESHOLD = 65;

// Screen Indicator Component
function ScreenIndicator({
  currentScreen,
  isWordPassed,
  isSentencePassed,
}: {
  currentScreen: Screen;
  isWordPassed: boolean;
  isSentencePassed: boolean;
}) {
  return (
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
              currentScreen === "word"
                ? "text-blue-700"
                : isWordPassed
                ? "text-green-700"
                : "text-gray-600"
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
  );
}

export default function PronunciationDrill({
  drill,
  assignmentId,
}: PronunciationDrillProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentScreen, setCurrentScreen] = useState<Screen>("word");
  const [wordProgress, setWordProgress] = useState<
    Record<number, WordProgress>
  >({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [showReview, setShowReview] = useState(false);
  const [sessionReviewAnalytics, setSessionReviewAnalytics] = useState<
    PerformanceReviewAnalyticsRow[]
  >([]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] =
    useState<TextScore | null>(null);
  const [pendingSubmitBlob, setPendingSubmitBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(
    null
  );
  const [sessionTranscripts, setSessionTranscripts] = useState<
    PronunciationTranscriptEntry[]
  >([]);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
    discardPendingRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when drill step changes
  }, [currentIndex, currentScreen]);

  useEffect(() => {
    return () => {
      revokeRecordingPreview();
    };
  }, [revokeRecordingPreview]);

  const items = useMemo(
    () => drill.pronunciation_items || [],
    [drill.pronunciation_items]
  );
  const currentItem = items[currentIndex];
  const currentProgress = wordProgress[currentIndex] || {
    wordPassed: false,
    wordScore: null,
    sentencePassed: false,
    sentenceScore: null,
  };

  // Initialize progress tracking
  useEffect(() => {
    const initialProgress: Record<number, WordProgress> = {};
    items.forEach((_: any, index: number) => {
      initialProgress[index] = {
        wordPassed: false,
        wordScore: null,
        sentencePassed: false,
        sentenceScore: null,
      };
    });
    setWordProgress(initialProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when item count changes
  }, [items.length]);

  const clearRecordingTimers = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 32000,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
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

  const submitPendingForAnalysis = async () => {
    if (!pendingSubmitBlob) return;
    const blob = pendingSubmitBlob;
    setPendingSubmitBlob(null);
    revokeRecordingPreview();
    await analyzePronunciation(blob);
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.includes(',')
          ? base64String.split(',')[1]
          : base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!currentItem) return;

    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      const textToAnalyze =
        currentScreen === "word"
          ? currentItem.word?.trim() || ""
          : currentItem.sentence?.trim() || "";

      const speechAceResponse = await speechaceService.scorePronunciation(
        textToAnalyze,
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

      if (textScore) {
        setPronunciationScore(textScore);
        const score = textScore.speechace_score.pronunciation;
        const passed = score >= PASS_THRESHOLD;
        const turnIdx = currentScreen === "word" ? 0 : 1;

        setSessionReviewAnalytics((prev) => {
          const existing = prev.find(
            (r) => r.sceneIndex === currentIndex && r.turnIndex === turnIdx
          );
          const attempts = existing ? existing.attempts + 1 : 1;
          const row: PerformanceReviewAnalyticsRow = {
            sceneIndex: currentIndex,
            turnIndex: turnIdx,
            text: textToAnalyze,
            score,
            textScore,
            attempts,
          };
          return [
            ...prev.filter(
              (r) => !(r.sceneIndex === currentIndex && r.turnIndex === turnIdx)
            ),
            row,
          ];
        });

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
            `Great! You scored ${score.toFixed(0)}% - ${
              currentScreen === "word" ? "Word" : "Sentence"
            } passed!`
          );
        } else {
          toast.warning(
            `Score: ${score.toFixed(
              0
            )}%. You need at least ${PASS_THRESHOLD}% to pass. Try again!`
          );
        }

        setSessionTranscripts((prev) => {
          const rest = prev.filter(
            (e) =>
              !(e.itemIndex === currentIndex && e.screen === currentScreen)
          );
          return [
            ...rest,
            {
              itemIndex: currentIndex,
              screen: currentScreen,
              expected: textToAnalyze,
              transcript: transcriptFromTextScore(textScore),
            },
          ];
        });

        // Record pronunciation attempt
        try {
          const audioBase64 = await blobToBase64(audioBlob);
          await pronunciationAPI.createDrillAttempt({
            text: textToAnalyze,
            audioBase64,
            drillId: drill._id,
            drillType: 'pronunciation',
            passingThreshold: PASS_THRESHOLD,
          });
        } catch (error) {
          // Log but don't fail the drill if pronunciation recording fails
          console.error('Failed to record pronunciation attempt:', error);
        }
      } else {
        throw new Error("Invalid response from SpeechAce - missing textScore");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze pronunciation");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTryAgain = () => {
    setPronunciationScore(null);
    discardPendingRecording();
  };

  const handleContinueToSentence = () => {
    if (currentProgress.wordPassed) {
      discardPendingRecording();
      setCurrentScreen("sentence");
      setPronunciationScore(null);
    } else {
      toast.error(
        "You must pass the word pronunciation (65%+) before proceeding to the sentence"
      );
    }
  };

  const handleNext = () => {
    if (!currentProgress.wordPassed || !currentProgress.sentencePassed) {
      toast.error(
        "You must pass both word and sentence pronunciation before proceeding"
      );
      return;
    }

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentScreen("word");
      setPronunciationScore(null);
      discardPendingRecording();
    } else {
      discardPendingRecording();
      setPronunciationScore(null);
      setShowReview(true);
    }
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const totalItems = items.length;
      const passedItems = Object.values(wordProgress).filter(
        (p) => p.wordPassed && p.sentencePassed
      ).length;
      const score = Math.round((passedItems / totalItems) * 100);

      const wordScores = items.map((row: any, index: number) => {
        const progress = wordProgress[index] || {
          wordPassed: false,
          wordScore: null,
          sentencePassed: false,
          sentenceScore: null,
        };

        const wordScore = progress.wordScore || 0;
        const sentenceScore = progress.sentenceScore || 0;
        const overallScore =
          progress.wordPassed && progress.sentencePassed
            ? Math.round((wordScore + sentenceScore) / 2)
            : 0;

        return {
          word: row.word?.trim() || `Item ${index + 1}`,
          score: overallScore,
          attempts: 1,
          pronunciationScore: overallScore,
        };
      });

      await drillAPI.complete(drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        pronunciationResults: { wordScores },
        platform: "web",
      });

      setShowReview(false);
      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      // Track activity locally (no API call)
      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        score,
        });

      // Refresh the page to update drill status
      router.refresh();
    } catch (error: any) {
      toast.error(
        "Failed to submit drill: " + (error.message || "Unknown error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePracticeAgainFromReview = () => {
    setShowReview(false);
    setCurrentIndex(0);
    setCurrentScreen("word");
    setSessionReviewAnalytics([]);
    setSessionTranscripts([]);
    setPronunciationScore(null);
    discardPendingRecording();
    setIsRecording(false);
    clearRecordingTimers();
    const initialProgress: Record<number, WordProgress> = {};
    items.forEach((_: any, index: number) => {
      initialProgress[index] = {
        wordPassed: false,
        wordScore: null,
        sentencePassed: false,
        sentenceScore: null,
      };
    });
    setWordProgress(initialProgress);
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
          (item?.word?.trim() || item?.sentence?.trim() || `Item ${sceneIndex + 1}`).slice(
            0,
            48
          ) +
          ((item?.word?.trim() || item?.sentence?.trim() || "").length > 48 ? "…" : "");
        return {
          sceneIndex,
          sceneTitle: `Item ${sceneIndex + 1}: ${preview}`,
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
    const scores: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const p = wordProgress[i];
      if (p?.wordScore != null && p?.sentenceScore != null) {
        scores.push((p.wordScore + p.sentenceScore) / 2);
      }
    }
    return scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }, [sessionReviewAnalytics, wordProgress, items.length]);

  const reviewStatsLine = useMemo(() => {
    const passedItems = Object.values(wordProgress).filter(
      (p) => p.wordPassed && p.sentencePassed
    ).length;
    const n = sessionReviewAnalytics.length;
    return `${passedItems} of ${items.length} items passed · ${n} scored attempts`;
  }, [wordProgress, sessionReviewAnalytics.length, items.length]);

  const inDrillReviewRow: PerformanceReviewAnalyticsRow | null = useMemo(() => {
    if (!pronunciationScore) return null;
    const item = items[currentIndex];
    if (!item) return null;
    const turnIdx = currentScreen === "word" ? 0 : 1;
    const textForRow =
      currentScreen === "word" ? item.word?.trim() || "" : item.sentence?.trim() || "";
    const match = sessionReviewAnalytics.find(
      (r) => r.sceneIndex === currentIndex && r.turnIndex === turnIdx
    );
    return {
      sceneIndex: currentIndex,
      turnIndex: turnIdx,
      text: textForRow,
      score: pronunciationScore.speechace_score.pronunciation,
      textScore: pronunciationScore,
      attempts: match?.attempts ?? 1,
    };
  }, [
    pronunciationScore,
    items,
    currentIndex,
    currentScreen,
    sessionReviewAnalytics,
  ]);

  if (showReview) {
    return (
      <DrillLayout title="Review Performance" hideNavigation>
        <DrillPerformanceReview
          avgScore={reviewAvgScore}
          statsLine={reviewStatsLine}
          groups={reviewGroups}
          passThreshold={PASS_THRESHOLD}
          sectionHeading="Item-by-Item Analysis"
          onDone={() => void handleSubmit()}
          onPracticeAgain={handlePracticeAgainFromReview}
          isSubmitting={isSubmitting}
        />
      </DrillLayout>
    );
  }

  // Completed state
  if (isCompleted) {
    return (
      <DrillCompletionScreen
        drillType="pronunciation"
        returnPath="/account/drills"
        returnLabel="Back to My Plan"
        refreshOnMount={true}
        extraContent={
          sessionTranscripts.length > 0 ? (
            <Card className="border-gray-200 text-left p-4 shadow-none">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                What we heard from your recordings
              </p>
              <ul className="space-y-3 text-sm text-gray-700">
                {sessionTranscripts.map((row, i) => (
                  <li
                    key={`${row.itemIndex}-${row.screen}-${i}`}
                    className="border-b border-gray-100 last:border-0 pb-3 last:pb-0"
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      Item {row.itemIndex + 1} ·{" "}
                      {row.screen === "word" ? "Word" : "Sentence"}
                    </div>
                    <p className="text-xs text-gray-500 mb-0.5">Target</p>
                    <p className="mb-2">{row.expected}</p>
                    <p className="text-xs text-gray-500 mb-0.5">Transcript</p>
                    <p className="text-gray-900">{row.transcript || "—"}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : undefined
        }
      />
    );
  }

  // No content state
  if (!currentItem) {
    return (
      <DrillLayout title={drill.title}>
        <Card className="text-center py-8">
          <p className="text-gray-600">
            No pronunciation items found in this drill.
          </p>
        </Card>
      </DrillLayout>
    );
  }

  const currentWord = currentItem.word?.trim() || "";
  const currentText =
    currentScreen === "word" ? currentWord : currentItem.sentence?.trim() || "";
  const isWordPassed = currentProgress.wordPassed;
  const isSentencePassed = currentProgress.sentencePassed;
  const canContinueToSentence = isWordPassed;
  const canProceedToNext = isWordPassed && isSentencePassed;
  const awaitingSubmit =
    !!pendingSubmitBlob && !isAnalyzing && !pronunciationScore;
  const readyToSubmitPreview = awaitingSubmit && Boolean(recordingPreviewUrl);
  const dockMainDisabled =
    isAnalyzing ||
    (currentScreen === "sentence" && !isWordPassed) ||
    (awaitingSubmit && !recordingPreviewUrl);

  const handleDockMainClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (readyToSubmitPreview) {
      void submitPendingForAnalysis();
      return;
    }
    void startRecording();
  };

  return (
    <DrillLayout title={drill.title}>
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 h-[calc(100svh-8.75rem)] max-h-[calc(100svh-8.75rem)] md:h-[calc(100svh-9.25rem)] md:max-h-[calc(100svh-9.25rem)]">
        <div className="shrink-0 space-y-4">
          <DrillProgress
            current={currentIndex + 1}
            total={items.length}
          />

          <ScreenIndicator
            currentScreen={currentScreen}
            isWordPassed={isWordPassed}
            isSentencePassed={isSentencePassed}
          />
        </div>

        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-4 ${
            awaitingSubmit ? "pb-48 sm:pb-52" : "pb-28 sm:pb-32"
          }`}
        >
          <Card className="mb-0">
            <div className="text-center py-6">
              {/* Word/Sentence Display */}
              <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-2">
              {currentScreen === "word"
                ? "Pronounce the Word"
                : "Pronounce the Sentence"}
            </h2>
            {currentItem.sound?.trim() && (
              <p className="text-sm text-gray-500 mb-3">
                Sound focus: <span className="font-medium text-gray-700">{currentItem.sound}</span>
              </p>
            )}
            <div className="flex items-center justify-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                {currentText}
              </h1>
              {currentScreen === "word" && (
                <BookmarkButton
                  itemId={currentWord}
                  itemType="word"
                  content={currentWord}
                  sourceDrillId={drill._id}
                  className="ml-2"
                />
              )}
              {currentScreen === "sentence" && (
                <BookmarkButton
                  itemId={currentText}
                  itemType="sentence"
                  content={currentText}
                  sourceDrillId={drill._id}
                  className="ml-2"
                />
              )}
            </div>
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
              autoPlay={false}
              audioUrl={
                currentScreen === "word"
                  ? currentItem.wordAudioUrl
                  : currentItem.sentenceAudioUrl
              }
            />
          </div>

          {/* Record Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Record your pronunciation
            </h3>
            <p className="text-sm text-gray-500">
              Use the microphone at the bottom — tap to record, then submit or re-record from the
              preview.
            </p>
            {isAnalyzing && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <p className="text-sm text-gray-600">
                  Analyzing your pronunciation — longer recordings may take a moment...
                </p>
              </div>
            )}
            {pronunciationScore && !isAnalyzing && (
              <>
                <p className="text-sm text-green-600 mt-4 font-medium">
                  ✓ Analysis complete! Your breakdown is below.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  <span className="font-medium text-gray-700">Transcript: </span>
                  {transcriptFromTextScore(pronunciationScore) || "—"}
                </p>
              </>
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

          {inDrillReviewRow && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 px-1">Your performance</h3>
              <DrillLineReviewAccordion
                key={`${inDrillReviewRow.sceneIndex}-${inDrillReviewRow.turnIndex}-${inDrillReviewRow.attempts}`}
                row={inDrillReviewRow}
                passThreshold={PASS_THRESHOLD}
                lineLabel={currentScreen === "word" ? "Word" : "Sentence"}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 pt-1">
            {currentScreen === "word" && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleContinueToSentence}
                disabled={
                  !canContinueToSentence ||
                  isRecording ||
                  isAnalyzing ||
                  awaitingSubmit
                }
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
                disabled={
                  !canProceedToNext || isRecording || isAnalyzing || awaitingSubmit
                }
              >
                {canProceedToNext ? (
                  currentIndex === items.length - 1 ? (
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
                  discardPendingRecording();
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
                  discardPendingRecording();
                }}
                disabled={isRecording || isAnalyzing}
              >
                Previous Item
              </Button>
            )}
          </div>
        </div>

        {/* Floating recording dock (centered): no full-width sheet */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:bottom-5 md:px-8">
          <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-2">
            {awaitingSubmit && recordingPreviewUrl ? (
              <RecordingPreviewBar
                key={recordingPreviewUrl}
                className="w-full"
                src={recordingPreviewUrl}
                onDiscard={discardPendingRecording}
                onAudioError={() => {
                  toast.error(
                    "Preview cannot play in this browser. You can still submit for feedback."
                  );
                }}
              />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 rounded-full ring-4 ring-white/90 shadow-lg">
                {isRecording && (
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="44" fill="none" stroke="#fecaca" strokeWidth="4" />
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 44}
                      strokeDashoffset={
                        2 * Math.PI * 44 * (1 - recordingSeconds / MAX_RECORDING_SECONDS)
                      }
                      strokeLinecap="round"
                      className="transition-[stroke-dashoffset] duration-1000 linear"
                    />
                  </svg>
                )}
                <button
                  type="button"
                  onClick={handleDockMainClick}
                  disabled={dockMainDisabled}
                  className={`absolute inset-0 flex items-center justify-center rounded-full shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600"
                      : isAnalyzing
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                  aria-label={
                    isRecording
                      ? "Stop recording"
                      : readyToSubmitPreview
                        ? "Submit recording for feedback"
                        : "Start recording"
                  }
                >
                  {isRecording ? (
                    <Square className="h-7 w-7 text-white" />
                  ) : isAnalyzing ? (
                    <Loader2 className="h-7 w-7 animate-spin text-white" />
                  ) : readyToSubmitPreview ? (
                    <Send className="h-8 w-8 text-white" strokeWidth={2} />
                  ) : (
                    <Mic className="h-8 w-8 text-white" />
                  )}
                </button>
              </div>
              {isRecording && (
                <p className="max-w-[16rem] text-center text-xs font-medium leading-snug text-red-600 sm:text-sm">
                  {MAX_RECORDING_SECONDS - recordingSeconds}s left · tap to stop
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DrillLayout>
  );
}
