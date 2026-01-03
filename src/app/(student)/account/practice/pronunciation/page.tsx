"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TTSButton } from "@/components/ui/TTSButton";
import { PronunciationScore } from "@/components/ui/PronunciationScore";
import { Mic, Play, Pause, Volume2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { speechaceService, type TextScore } from "@/services/speechace.service";
import { toast } from "sonner";

export default function PronunciationPracticePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWord, setCurrentWord] = useState(0);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<TextScore | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  const words = [
    {
      word: "Really",
      phonetic: "/'ri:.əl.i/",
      difficulty: "Beginner-Intermediate",
      time: "5-7 minutes",
      description: "Practice the R-L sound distinction",
    },
    {
      word: "Through",
      phonetic: "/θru:/",
      difficulty: "Intermediate",
      time: "3-5 minutes",
      description: "Master the 'th' sound",
    },
    {
      word: "Schedule",
      phonetic: "/'ʃed.ju:l/",
      difficulty: "Advanced",
      time: "4-6 minutes",
      description: "Practice the 'sch' sound",
    },
  ];

  const current = words[currentWord];

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Analyze pronunciation
        await analyzePronunciation(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      toast.error('Failed to access microphone: ' + error.message);
      console.error('Error accessing microphone:', error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Analyze pronunciation with Speechace
  const analyzePronunciation = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    setPronunciationScore(null);

    try {
      const result = await speechaceService.scorePronunciation(
        current.word,
        audioBlob,
        `word-${current.word}-${Date.now()}`
      );

      if (result.data?.text_score) {
        setPronunciationScore(result.data.text_score);
        toast.success('Pronunciation analyzed successfully!');
      } else {
        throw new Error('Invalid response from pronunciation service');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to analyze pronunciation');
      console.error('Error analyzing pronunciation:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reset for next word
  const handleNextWord = () => {
    setPronunciationScore(null);
    setAudioBlob(null);
    setCurrentWord(currentWord + 1);
    if (autoPlayAudio) {
      setTimeout(() => {
        // TTS will be triggered by TTSButton autoPlay
      }, 300);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Pronunciation Practice" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {words.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index <= currentWord ? "bg-green-600 w-8" : "bg-gray-300 w-2"
              }`}
            />
          ))}
        </div>

        {/* Word Card */}
        <Card className="mb-6 bg-gradient-to-br from-green-50 to-blue-50">
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                {current.word}
              </h1>
              <TTSButton
                text={current.word}
                size="lg"
                autoPlay={autoPlayAudio}
              />
            </div>
            <p className="text-lg md:text-xl text-gray-600 mb-6">
              {current.phonetic}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-1">
                <Volume2 className="w-4 h-4" />
                <span>{current.difficulty}</span>
              </div>
              <span>•</span>
              <span>{current.time}</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{current.description}</p>
            <label className="flex items-center justify-center gap-2 text-sm text-gray-600">
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

        {/* Listen Section */}
        <Card className="mb-6">
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Listen to the correct pronunciation
            </h3>
            <div className="flex items-center justify-center gap-4">
              <TTSButton
                text={current.word}
                size="lg"
                variant="button"
                autoPlay={autoPlayAudio}
              />
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Click to hear &quot;{current.word}&quot; pronounced correctly
            </p>
          </div>
        </Card>

        {/* Record Section */}
        <Card className="mb-6">
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Record your pronunciation
            </h3>
            <div className="relative">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isAnalyzing}
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
        </Card>

        {/* Pronunciation Score Section */}
        {pronunciationScore && (
          <div className="mb-6">
            <PronunciationScore textScore={pronunciationScore} />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {pronunciationScore && currentWord < words.length - 1 && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleNextWord}
              disabled={isRecording || isAnalyzing}
            >
              Next Word
            </Button>
          )}
          {pronunciationScore && currentWord === words.length - 1 && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() =>
                router.push("/account/practice/pronunciation/completed")
              }
              disabled={isRecording || isAnalyzing}
            >
              Complete Practice
            </Button>
          )}
          {pronunciationScore && (
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => {
                setPronunciationScore(null);
                setAudioBlob(null);
              }}
              disabled={isRecording || isAnalyzing}
            >
              Try Again
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.back()}
            disabled={isRecording || isAnalyzing}
          >
            Back to Practice
          </Button>
        </div>
      </div>
    </div>
  );
}
