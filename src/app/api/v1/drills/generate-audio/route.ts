import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/services/cloudinary.service";
import { logger } from "@/lib/api/logger";
import { withRole } from "@/lib/api/middleware";
import { generateElevenLabsAudio } from "@/services/tts-provider.service";
import { resolveVoiceId } from "@/services/tts-config";

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
  voiceId?: string
): Promise<Buffer> {
  const arrayBuffer = await generateElevenLabsAudio({
    text,
    voiceId: resolveVoiceId(voiceId),
  });
  return Buffer.from(arrayBuffer);
}

async function postHandler(request: NextRequest) {
  try {
    const startedAt = Date.now();
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
        telemetry: {
          route: "/api/v1/drills/generate-audio",
          provider_status: "mixed",
          cache_hit: false,
          voice_id: "mixed",
          text_len: texts.reduce((sum, item) => sum + (item.text?.length || 0), 0),
          latency_ms: Date.now() - startedAt,
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

export const POST = withRole(["admin", "tutor"], postHandler);

