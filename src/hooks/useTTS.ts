import { useState, useCallback, useRef } from "react";
import { generateTTS } from "@/services/tts.service";
import { toast } from "sonner";

interface UseTTSOptions {
  autoPlay?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const { autoPlay = true, onPlayStart, onPlayEnd, onError } = options;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const playAudio = useCallback(
    async (text: string, voiceId?: string) => {
      try {
        // Stop any currently playing audio and clean up
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        // Clean up previous object URL
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        setIsGenerating(true);
        setIsPlaying(false);

        // Generate TTS audio (streams directly from backend, returns Blob)
        const audioBlob = await generateTTS({
          text,
          voiceId,
        });

        // Create object URL from blob (no CORS issues since it's a local blob URL)
        const audioObjectUrl = URL.createObjectURL(audioBlob);
        objectUrlRef.current = audioObjectUrl;
        setCurrentAudioUrl(audioObjectUrl);

        // Always create audio element, but only play if autoPlay is true
        const audio = new Audio(audioObjectUrl);
        audioRef.current = audio;

        // Preload the audio to start loading immediately
        audio.preload = "auto";

        // Set up event handlers
        audio.onplay = () => {
          setIsPlaying(true);
          setIsGenerating(false);
          onPlayStart?.();
        };

        // Clean up object URL when audio is done
        audio.onended = () => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
          setIsPlaying(false);
          onPlayEnd?.();
        };

        audio.onerror = (e) => {
          setIsPlaying(false);
          setIsGenerating(false);
          const error = new Error("Failed to play audio");
          console.error("Error playing audio:", e);
          onError?.(error);
          toast.error("Failed to play audio");
        };

        // Function to play audio
        const playAudioNow = async () => {
          try {
            await audio.play();
          } catch (playErr: any) {
            console.error("Error playing audio:", playErr);
            setIsGenerating(false);
            setIsPlaying(false);
            onError?.(new Error("Failed to play audio"));
            toast.error("Failed to play audio. Please try again.");
          }
        };

        // Try to play immediately - audio might already be cached/ready
        const attemptPlay = () => {
          if (audio.readyState >= 2) {
            // HAVE_CURRENT_DATA or higher - can play
            playAudioNow();
          } else {
            // Wait for audio to be ready, then play
            const playWhenReady = () => {
              playAudioNow();
            };

            // Use multiple events to ensure we catch when audio is ready
            audio.addEventListener("canplay", playWhenReady, { once: true });
            audio.addEventListener("canplaythrough", playWhenReady, {
              once: true,
            });
            audio.addEventListener("loadeddata", playWhenReady, {
              once: true,
            });

            // Fallback: try after a short delay if still not ready
            setTimeout(() => {
              if (audio.readyState >= 2) {
                playAudioNow();
              }
            }, 100);
          }
        };

        // Start loading and attempt to play
        audio.load(); // Explicitly start loading

        // Always attempt to play when playAudio is called
        // The autoPlay option is for controlling automatic playback in other contexts
        attemptPlay();
      } catch (error: any) {
        setIsGenerating(false);
        setIsPlaying(false);
        onError?.(error);
        toast.error(error.message || "Failed to generate speech");
      }
    },
    [autoPlay, onPlayStart, onPlayEnd, onError]
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    // Clean up object URL when stopping
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  return {
    playAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
    isGenerating,
    isPlaying,
    currentAudioUrl,
  };
}
