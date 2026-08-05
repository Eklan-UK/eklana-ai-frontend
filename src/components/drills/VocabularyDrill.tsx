"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import {
  CheckCircle,
  ChevronLeft,
  Mic,
  Loader2,
  Lock,
  Send,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { pronunciationAPI } from "@/lib/api";
import { completeLearnerDrill } from "@/lib/drill/complete-learner-drill";
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
  CheckpointScreen,
  type PerformanceReviewAnalyticsRow,
  type PerformanceReviewGroup,
} from "./shared";
import { DrillBookmarkToggle } from "@/components/drills/DrillBookmarkToggle";
import { BookmarkButton } from "@/components/common/BookmarkButton";
import { playPracticeFeedback } from "@/lib/practice-feedback";
import {
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoint,
} from "@/lib/drill/drill-checkpoint";
import { useLocalDrillProgress } from "@/hooks/useLocalDrillProgress";

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

const MAX_RECORDING_SECONDS = 120;
const PASS_THRESHOLD = 65;

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
            ? "bg-sky-500/15 border-2 border-sky-500"
            : isWordPassed
              ? "bg-emerald-500/10 border border-emerald-500/40"
              : "bg-muted border border-border"
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          {isWordPassed && currentScreen !== "word" && (
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span
            className={`text-sm font-medium ${
              currentScreen === "word"
                ? "text-sky-800 dark:text-sky-200"
                : isWordPassed
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground"
            }`}
          >
            Word
          </span>
        </div>
      </div>
      <div
        className={`flex-1 p-3 rounded-lg text-center ${
          currentScreen === "sentence"
            ? "bg-sky-500/15 border-2 border-sky-500"
            : isSentencePassed
              ? "bg-emerald-500/10 border border-emerald-500/40"
              : !isWordPassed
                ? "bg-muted border border-border opacity-50"
                : "bg-muted border border-border"
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          {!isWordPassed && currentScreen !== "sentence" && (
            <Lock className="w-4 h-4 text-muted-foreground" />
          )}
          {isSentencePassed && currentScreen !== "sentence" && (
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span
            className={`text-sm font-medium ${
              currentScreen === "sentence"
                ? "text-sky-800 dark:text-sky-200"
                : isSentencePassed
                  ? "text-emerald-700 dark:text-emerald-300"
                  : !isWordPassed
                    ? "text-muted-foreground"
                    : "text-muted-foreground"
            }`}
          >
            Sentence
          </span>
        </div>
      </div>
    </div>
  );
}

export default function VocabularyDrill({
  drill,
  assignmentId,
}: VocabularyDrillProps) {
  const queryClient = useQueryClient();
  const localProgress = useLocalDrillProgress({
    drillId: String(drill._id),
    drillType: "vocabulary",
    assignmentId,
  });
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
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [checkpointCount, setCheckpointCount] = useState(0);
  const [isLoadingCheckpoint, setIsLoadingCheckpoint] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [pendingSubmitBlob, setPendingSubmitBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const targetSentences = useMemo(() => {
    if (drill.vocabulary_items?.length) {
      return drill.vocabulary_items.map((item: any) => {
        const correctAnswer = item.blanks?.[0]?.correctAnswer ?? '';
        return {
          word: correctAnswer,
          text: (item.sentence ?? '').replace(/___/g, correctAnswer),
          translation: undefined,
          wordTranslation: undefined,
        };
      });
    }
    return drill.target_sentences || [];
  }, [drill.vocabulary_items, drill.target_sentences]);
  const currentSentence = targetSentences[currentIndex];
  const currentProgress = wordProgress[currentIndex] || {
    wordPassed: false,
    wordScore: null,
    sentencePassed: false,
    sentenceScore: null,
  };

  useEffect(() => {
    const createEmptyProgress = (): Record<number, WordProgress> => {
      const initialProgress: Record<number, WordProgress> = {};
      targetSentences.forEach((_: any, index: number) => {
        initialProgress[index] = {
          wordPassed: false,
          wordScore: null,
          sentencePassed: false,
          sentenceScore: null,
        };
      });
      return initialProgress;
    };

    if (!localProgress.isReady) return;

    let cancelled = false;
    setIsLoadingCheckpoint(true);
    setShowCheckpoint(false);

    const applyPartial = (
      resumeFromIndex: number,
      completedCount: number,
      partial: Record<string, unknown>,
    ) => {
      setCurrentIndex(resumeFromIndex);
      if (partial.wordProgress) {
        setWordProgress(partial.wordProgress as Record<number, WordProgress>);
      } else {
        setWordProgress(createEmptyProgress());
      }
      if (partial.sessionReviewAnalytics) {
        setSessionReviewAnalytics(
          partial.sessionReviewAnalytics as PerformanceReviewAnalyticsRow[],
        );
      }
      setCheckpointCount(completedCount);
    };

    const local = localProgress.hydrate();
    if (local) {
      applyPartial(local.resumeFromIndex, local.completedItemCount, local.partialResults);
      setIsLoadingCheckpoint(false);
      return;
    }

    if (!assignmentId) {
      setWordProgress(createEmptyProgress());
      setIsLoadingCheckpoint(false);
      return;
    }

    loadCheckpoint(String(drill._id), assignmentId).then((cp) => {
      if (cancelled) return;
      if (cp) {
        applyPartial(cp.resumeFromIndex, cp.completedItemCount, cp.partialResults);
      } else {
        setWordProgress(createEmptyProgress());
      }
      setIsLoadingCheckpoint(false);
    });

    return () => {
      cancelled = true;
    };
  }, [localProgress.isReady, assignmentId, drill._id, targetSentences.length]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentScreen]);

  useEffect(() => {
    return () => {
      revokeRecordingPreview();
    };
  }, [revokeRecordingPreview]);

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

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.includes(",")
          ? base64String.split(",")[1]
          : base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!currentSentence) return;

    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      const textToAnalyze =
        currentScreen === "word"
          ? currentSentence.word || currentSentence.text.split(" ")[0]
          : currentSentence.text;

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
          }
          return {
            ...prev,
            [currentIndex]: {
              ...current,
              sentencePassed: passed,
              sentenceScore: score,
            },
          };
        });

        if (passed) {
          playPracticeFeedback("success");
          toast.success(
            `Great! You scored ${score.toFixed(0)}% - ${
              currentScreen === "word" ? "Word" : "Sentence"
            } passed!`
          );
        } else {
          playPracticeFeedback("failure");
          toast.warning(
            `Score: ${score.toFixed(0)}%. You need at least ${PASS_THRESHOLD}% to pass. Try again!`
          );
        }

        try {
          const audioBase64 = await blobToBase64(audioBlob);
          await pronunciationAPI.createDrillAttempt({
            text: textToAnalyze,
            audioBase64,
            drillId: drill._id,
            drillType: "vocabulary",
            passingThreshold: PASS_THRESHOLD,
          });
        } catch (error) {
          console.error("Failed to record pronunciation attempt:", error);
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

    if (currentIndex < targetSentences.length - 1) {
      const completedCount = Object.values(wordProgress).filter(
        (p) => p.wordPassed && p.sentencePassed,
      ).length;

      setCurrentIndex(currentIndex + 1);
      setCurrentScreen("word");
      setPronunciationScore(null);
      discardPendingRecording();

      localProgress.persist({
        resumeFromIndex: currentIndex + 1,
        completedItemCount: completedCount,
        partialResults: { wordProgress, sessionReviewAnalytics },
        startedAt: new Date(startTime).toISOString(),
      });

      if (completedCount > 0 && completedCount % 5 === 0 && assignmentId) {
        void saveCheckpoint(String(drill._id), {
          assignmentId,
          drillType: "vocabulary",
          resumeFromIndex: currentIndex + 1,
          completedItemCount: completedCount,
          partialResults: { wordProgress, sessionReviewAnalytics },
          startedAt: new Date(startTime),
        });
        setCheckpointCount(completedCount);
        setShowCheckpoint(true);
      }
    } else {
      discardPendingRecording();
      setPronunciationScore(null);
      setShowReview(true);
    }
  };

  const handlePreviousItem = () => {
    if (currentIndex === 0 || isRecording || isAnalyzing) return;
    setCurrentIndex(currentIndex - 1);
    setCurrentScreen("word");
    setPronunciationScore(null);
    discardPendingRecording();
  };

  const handleSubmit = async () => {
    if (!assignmentId) {
      toast.error("Assignment ID is missing. Cannot submit drill.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const totalItems = targetSentences.length;
      const passedItems = Object.values(wordProgress).filter(
        (p) => p.wordPassed && p.sentencePassed
      ).length;
      const score = Math.round((passedItems / totalItems) * 100);

      const wordScores = targetSentences.map((sentence: any, index: number) => {
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
          word: sentence.word || sentence.text.split(" ")[0],
          score: overallScore,
          attempts: 1,
          pronunciationScore: overallScore,
        };
      });

      await completeLearnerDrill(queryClient, drill._id, {
        drillAssignmentId: assignmentId,
        score,
        timeSpent,
        vocabularyResults: { wordScores },
        performanceReviewSnapshot: {
          version: 1,
          ui: "drillPerformance",
          avgScore: reviewAvgScore,
          statsLine: reviewStatsLine,
          passThreshold: PASS_THRESHOLD,
          sectionHeading: "Item-by-Item Analysis",
          groups: JSON.parse(JSON.stringify(reviewGroups)),
        },
        platform: "web",
      });

      void clearCheckpoint(String(drill._id), assignmentId);
      localProgress.clear();
      setShowReview(false);
      setIsCompleted(true);
      toast.success("Drill completed! Great job!");

      trackActivity("drill", drill._id, "completed", {
        title: drill.title,
        type: drill.type,
        score,
      });
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
    setPronunciationScore(null);
    discardPendingRecording();
    setIsRecording(false);
    clearRecordingTimers();
    setShowCheckpoint(false);
    setCheckpointCount(0);
    localProgress.clear();
    if (assignmentId) void clearCheckpoint(String(drill._id), assignmentId);
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
        const sentence = targetSentences[sceneIndex];
        const preview =
          (sentence?.word || sentence?.text || `Item ${sceneIndex + 1}`).slice(0, 48) +
          ((sentence?.word || sentence?.text || "").length > 48 ? "…" : "");
        return {
          sceneIndex,
          sceneTitle: `Item ${sceneIndex + 1}: ${preview}`,
          rows: rows.sort((x, y) => x.turnIndex - y.turnIndex),
        };
      });
  }, [sessionReviewAnalytics, targetSentences]);

  const reviewAvgScore = useMemo(() => {
    if (sessionReviewAnalytics.length > 0) {
      return Math.round(
        sessionReviewAnalytics.reduce((s, r) => s + r.score, 0) /
          sessionReviewAnalytics.length
      );
    }
    const scores: number[] = [];
    for (let i = 0; i < targetSentences.length; i++) {
      const p = wordProgress[i];
      if (p?.wordScore != null && p?.sentenceScore != null) {
        scores.push((p.wordScore + p.sentenceScore) / 2);
      }
    }
    return scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }, [sessionReviewAnalytics, wordProgress, targetSentences.length]);

  const reviewStatsLine = useMemo(() => {
    const passedItems = Object.values(wordProgress).filter(
      (p) => p.wordPassed && p.sentencePassed
    ).length;
    const n = sessionReviewAnalytics.length;
    return `${passedItems} of ${targetSentences.length} items passed · ${n} scored attempts`;
  }, [wordProgress, sessionReviewAnalytics.length, targetSentences.length]);

  const inDrillReviewRow: PerformanceReviewAnalyticsRow | null = useMemo(() => {
    if (!pronunciationScore) return null;
    const sentence = targetSentences[currentIndex];
    if (!sentence) return null;
    const turnIdx = currentScreen === "word" ? 0 : 1;
    const textForRow =
      currentScreen === "word"
        ? sentence.word || sentence.text.split(" ")[0]
        : sentence.text;
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
    targetSentences,
    currentIndex,
    currentScreen,
    sessionReviewAnalytics,
  ]);

  if (isLoadingCheckpoint) {
    return (
      <DrillLayout title={drill.title} headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DrillLayout>
    );
  }

  if (showCheckpoint) {
    return (
      <CheckpointScreen
        completedCount={checkpointCount}
        totalCount={targetSentences.length}
        drillTitle={drill.title}
        onContinue={() => setShowCheckpoint(false)}
        onExit={() => {
          window.location.href = "/account/drills";
        }}
      />
    );
  }

  if (isCompleted) {
    return (
      <DrillCompletionScreen
        drillType="vocabulary"
        returnPath="/account/drills"
        returnLabel="Back to My Plan"
        celebrate={false}
      />
    );
  }

  if (showReview) {
    return (
      <DrillLayout title="Review Performance" hideNavigation headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
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

  if (!currentSentence) {
    return (
      <DrillLayout title={drill.title} headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}>
        <Card className="text-center py-8">
          <p className="text-muted-foreground">
            No vocabulary items found in this drill.
          </p>
        </Card>
      </DrillLayout>
    );
  }

  const currentWord =
    currentSentence.word || currentSentence.text.split(" ")[0];
  const currentText =
    currentScreen === "word" ? currentWord : currentSentence.text;
  const isWordPassed = currentProgress.wordPassed;
  const isSentencePassed = currentProgress.sentencePassed;
  const canContinueToSentence = isWordPassed;
  const canProceedToNext = isWordPassed && isSentencePassed;

  const awaitingSubmit =
    !!pendingSubmitBlob &&
    !isAnalyzing &&
    !pronunciationScore;
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
    <DrillLayout
      title={drill.title}
      headerRight={<DrillBookmarkToggle drillId={String(drill._id)} />}
    >
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 h-[calc(100svh-8.75rem)] max-h-[calc(100svh-8.75rem)] md:h-[calc(100svh-9.25rem)] md:max-h-[calc(100svh-9.25rem)]">
        <div className="shrink-0 space-y-4">
          <DrillProgress
            current={currentIndex + 1}
            total={targetSentences.length}
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
              <div className="mb-6">
                <h2 className="text-sm font-medium text-foreground mb-2">
                  {currentScreen === "word"
                    ? "Pronounce the Word"
                    : "Pronounce the Sentence"}
                </h2>
                <div className="flex items-center justify-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                    {currentText}
                  </h1>
                  {currentScreen === "word" ? (
                    <BookmarkButton
                      itemType="word"
                      content={currentText}
                      translation={currentSentence.wordTranslation}
                      context={currentSentence.text}
                      sourceDrillId={String(drill._id)}
                    />
                  ) : null}
                </div>
                {currentScreen === "word" && currentSentence.wordTranslation && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {currentSentence.wordTranslation}
                  </p>
                )}
                {currentScreen === "sentence" && currentSentence.translation && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {currentSentence.translation}
                  </p>
                )}
              </div>

              {currentScreen === "sentence" && !isWordPassed && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-foreground">
                    <Lock className="w-4 h-4" />
                    <p className="text-sm font-medium">
                      Complete word pronunciation first (65%+ required)
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Listen to the correct pronunciation
                </h3>
                <TTSButton
                  text={currentText}
                  size="lg"
                  variant="button"
                  autoPlay={false}
                  audioUrl={
                    currentScreen === "word"
                      ? currentSentence.wordAudioUrl
                      : currentSentence.sentenceAudioUrl
                  }
                />
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Record your pronunciation
                </h3>
                <p className="text-sm text-muted-foreground">
                  Use the microphone at the bottom — tap to record, then submit or re-record from
                  the preview.
                </p>
                {isAnalyzing && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <p className="text-sm text-muted-foreground">
                      Analyzing your pronunciation — longer recordings may take a moment...
                    </p>
                  </div>
                )}
                {pronunciationScore && !isAnalyzing && (
                  <p className="text-sm text-green-600 mt-4 font-medium">
                    ✓ Analysis complete! Your breakdown is below.
                  </p>
                )}
              </div>

              <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4">
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
              <h3 className="text-sm font-bold text-foreground px-1">Your performance</h3>
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
                  discardPendingRecording();
                }}
                disabled={isRecording || isAnalyzing}
              >
                Back to Word
              </Button>
            )}

            {currentIndex > 0 && (
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={handlePreviousItem}
                disabled={isRecording || isAnalyzing}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
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
                        ? "bg-muted cursor-not-allowed"
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
