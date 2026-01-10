import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/services/cloudinary.service";
import config from "@/lib/api/config";
import { logger } from "@/lib/api/logger";

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

interface GenerateAudioRequest {
  texts: Array<{
    id: string; // Unique identifier for this text
    text: string; // The text to convert to speech
    voiceId?: string; // Optional specific voice
  }>;
  drillType: string;
  drillId?: string;
}

interface AudioResult {
  id: string;
  audioUrl: string;
  success: boolean;
  error?: string;
}

/**
 * Generate TTS audio using ElevenLabs and upload to Cloudinary
 * This endpoint is called by the admin when creating/updating drills
 */
async function generateTTSAudio(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM" // Rachel voice
): Promise<Buffer> {
  if (!ELEVEN_LABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const response = await fetch(`${ELEVEN_LABS_API_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": ELEVEN_LABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to generate audio";
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.detail?.message || error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAudioRequest = await request.json();
    const { texts, drillType, drillId } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "No texts provided for audio generation" },
        { status: 400 }
      );
    }

    logger.info("Generating TTS audio for drill", {
      drillType,
      drillId,
      textCount: texts.length,
    });

    const results: AudioResult[] = [];

    // Process texts sequentially to avoid rate limiting
    for (const item of texts) {
      try {
        // Skip empty texts
        if (!item.text || item.text.trim().length === 0) {
          results.push({
            id: item.id,
            audioUrl: "",
            success: false,
            error: "Empty text",
          });
          continue;
        }

        // Generate TTS audio
        const audioBuffer = await generateTTSAudio(item.text, item.voiceId);

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(audioBuffer, {
          folder: `eklan/drills/${drillType}/${drillId || "temp"}`,
          publicId: `audio_${item.id}_${Date.now()}`,
          resourceType: "raw", // For audio files
          transformation: undefined, // No transformation for audio
        });

        results.push({
          id: item.id,
          audioUrl: uploadResult.secureUrl,
          success: true,
        });

        logger.info("Generated audio for text", {
          id: item.id,
          text: item.text.substring(0, 50),
          audioUrl: uploadResult.secureUrl,
        });

        // Small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error: any) {
        logger.error("Failed to generate audio for text", {
          id: item.id,
          error: error.message,
        });
        results.push({
          id: item.id,
          audioUrl: "",
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: texts.length,
          success: successCount,
          failed: failCount,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error generating audio", { error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to generate audio" },
      { status: 500 }
    );
  }
}

