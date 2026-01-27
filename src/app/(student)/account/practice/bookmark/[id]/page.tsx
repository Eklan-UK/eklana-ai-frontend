"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { TTSButton } from "@/components/ui/TTSButton";
import type { TextScore } from "@/services/speechace.service";
import { speechaceService } from "@/services/speechace.service";
import { WordAnalytics } from "@/components/drills/shared/WordAnalytics";
import { DrillLayout } from "@/components/drills/shared";
import { Bookmark as BookmarkIcon, Mic, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

interface Bookmark {
  _id: string;
  content: string;
  translation?: string;
  context?: string;
  type: 'word' | 'sentence';
}

// Reusing the RecordButton style from VocabularyDrill for consistency
function RecordButton({
  isRecording,
  isAnalyzing,
  onStart,
  onStop,
}: {
  isRecording: boolean;
  isAnalyzing: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="relative group">
      <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
        isRecording ? "bg-red-200 scale-125 opacity-50 animate-pulse" : "bg-transparent scale-100"
      }`} />
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={isAnalyzing}
        className={`relative w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 ring-4 ring-red-100"
            : "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        }`}
      >
        {isAnalyzing ? (
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        ) : (
          <Mic className={`w-10 h-10 text-white transition-transform duration-300 ${isRecording ? "scale-110" : "scale-100"}`} />
        )}
      </button>
      {isRecording && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold animate-bounce">
            Recording...
          </span>
        </div>
      )}
    </div>
  );
}

export default function BookmarkPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Media recorder ref for cleanup
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchBookmark();
    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [id]);

  const fetchBookmark = async () => {
    try {
      const response = await fetch(`/api/v1/bookmarks/${id}`);
      if (!response.ok) throw new Error('Failed to fetch bookmark');
      const data = await response.json();
      setBookmark(data.bookmark);
    } catch (error) {
      toast.error('Could not load practice item');
      router.push('/account/bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    setPronunciationScore(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await analyzePronunciation(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
    } catch (error) {
      toast.error('Microphone access denied. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const analyzePronunciation = async (audioBlob: Blob) => {
    if (!bookmark) return;
    
    setAnalyzing(true);
    setPronunciationScore(null);

    try {
      // Use scorePronunciation (Blob version) instead of evaluateAudio (File version)
      // to match VocabularyDrill implementation
      const speechAceResponse = await speechaceService.scorePronunciation(
        bookmark.content,
        audioBlob
      );
      
      const result = speechAceResponse.data as any;
      let textScore: TextScore | null = null;

      // Robust response parsing matching VocabularyDrill
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
        
        if (score >= 80) {
          toast.success("Excellent pronunciation!", { icon: "🎉" });
        } else if (score >= 60) {
          toast.info("Good job! Keep practicing.");
        } else {
          toast.info("Try again to improve your score.");
        }
      } else {
        throw new Error("Invalid response from SpeechAce - missing textScore");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to analyze pronunciation");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading || !bookmark) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <DrillLayout 
      title="Practice Bookmark" 
      hideNavigation={true}
      maxWidth="md"
      backgroundGradient="bg-gradient-to-b from-green-50 to-white"
    >
      {/* Target Content Card */}
      <Card className="mb-6 overflow-hidden border-none shadow-lg">
        <div className="bg-white p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <BookmarkIcon className="w-6 h-6 text-green-600" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            {bookmark.content}
          </h1>
          
          {bookmark.translation && (
            <p className="text-lg text-gray-500 mb-6 font-medium">
              {bookmark.translation}
            </p>
          )}

          <TTSButton 
            text={bookmark.content} 
            size="lg" 
            variant="button"
            className="rounded-full px-8 shadow-sm hover:shadow-md transition-shadow"
          />
        </div>
        
        {/* Context Section - styled as a footer to the card */}
        {bookmark.context && (
          <div className="bg-gray-50 p-4 border-t border-gray-100">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-gray-700 mb-1">Context</p>
                <p className="text-gray-600 italic leading-relaxed">"{bookmark.context}"</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Recording Section */}
      <div className="flex flex-col items-center justify-center py-8">
        <div className="mb-8 w-full max-w-xs text-center min-h-[120px] flex flex-col items-center justify-center">
          {pronunciationScore ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              {/* Use WordAnalytics component for consistent visualization */}
              <WordAnalytics pronunciationScore={pronunciationScore} />
            </div>
          ) : (
            <div className="text-center text-gray-500 animate-in fade-in duration-500">
              <p className="text-sm font-medium uppercase tracking-wide text-gray-400 mb-2">Instructions</p>
              <p>Listen to the pronunciation above,<br/>then record yourself speaking.</p>
            </div>
          )}
        </div>

        <RecordButton
          isRecording={isRecording}
          isAnalyzing={analyzing}
          onStart={startRecording}
          onStop={stopRecording}
        />
        
        <p className="text-center text-gray-400 text-sm mt-8 font-medium">
          {isRecording ? "Tap to stop recording" : analyzing ? "Analyzing..." : "Tap microphone to start"}
        </p>
      </div>
    </DrillLayout>
  );
}
