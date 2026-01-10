/**
 * Service for pre-generating TTS audio for drills
 * Audio is generated server-side and uploaded to Cloudinary
 */

interface AudioGenerationItem {
  id: string;
  text: string;
  voiceId?: string;
}

interface AudioGenerationResult {
  id: string;
  audioUrl: string;
  success: boolean;
  error?: string;
}

interface GenerateAudioResponse {
  success: boolean;
  data?: {
    results: AudioGenerationResult[];
    summary: {
      total: number;
      success: number;
      failed: number;
    };
  };
  error?: string;
}

/**
 * Generate TTS audio for multiple texts
 * @param texts - Array of texts to convert to audio
 * @param drillType - Type of drill for organization
 * @param drillId - Optional drill ID for folder organization
 */
export async function generateDrillAudio(
  texts: AudioGenerationItem[],
  drillType: string,
  drillId?: string
): Promise<GenerateAudioResponse> {
  try {
    const response = await fetch("/api/v1/drills/generate-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        texts,
        drillType,
        drillId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate audio");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Failed to generate drill audio:", error);
    return {
      success: false,
      error: error.message || "Failed to generate audio",
    };
  }
}

/**
 * Helper to extract texts from vocabulary drill items
 */
export function extractVocabularyTexts(
  items: Array<{ word?: string; text: string }>
): AudioGenerationItem[] {
  const texts: AudioGenerationItem[] = [];
  
  items.forEach((item, index) => {
    // Add word audio
    if (item.word && item.word.trim()) {
      texts.push({
        id: `vocab_${index}_word`,
        text: item.word.trim(),
      });
    }
    
    // Add sentence audio
    if (item.text && item.text.trim()) {
      texts.push({
        id: `vocab_${index}_sentence`,
        text: item.text.trim(),
      });
    }
  });
  
  return texts;
}

/**
 * Helper to extract texts from roleplay dialogue
 */
export function extractRoleplayTexts(
  scenes: Array<{
    scene_name: string;
    dialogue: Array<{ speaker: string; text: string }>;
  }>
): AudioGenerationItem[] {
  const texts: AudioGenerationItem[] = [];
  
  scenes.forEach((scene, sceneIndex) => {
    scene.dialogue.forEach((turn, turnIndex) => {
      if (turn.text && turn.text.trim()) {
        texts.push({
          id: `roleplay_s${sceneIndex}_t${turnIndex}`,
          text: turn.text.trim(),
        });
      }
    });
  });
  
  return texts;
}

/**
 * Helper to extract texts from matching pairs
 */
export function extractMatchingTexts(
  pairs: Array<{ left: string; right: string }>
): AudioGenerationItem[] {
  const texts: AudioGenerationItem[] = [];
  
  pairs.forEach((pair, index) => {
    if (pair.left && pair.left.trim()) {
      texts.push({
        id: `matching_${index}_left`,
        text: pair.left.trim(),
      });
    }
    if (pair.right && pair.right.trim()) {
      texts.push({
        id: `matching_${index}_right`,
        text: pair.right.trim(),
      });
    }
  });
  
  return texts;
}

/**
 * Helper to extract text from summary/listening content
 */
export function extractContentText(
  content: string,
  type: "summary" | "listening"
): AudioGenerationItem[] {
  if (!content || !content.trim()) return [];
  
  return [
    {
      id: `${type}_content`,
      text: content.trim(),
    },
  ];
}

/**
 * Apply generated audio URLs back to drill data
 */
export function applyAudioUrls(
  drillData: any,
  results: AudioGenerationResult[]
): any {
  const urlMap = new Map(
    results.filter((r) => r.success).map((r) => [r.id, r.audioUrl])
  );

  const updated = { ...drillData };

  // Apply to vocabulary items
  if (updated.target_sentences) {
    updated.target_sentences = updated.target_sentences.map(
      (item: any, index: number) => ({
        ...item,
        wordAudioUrl: urlMap.get(`vocab_${index}_word`) || "",
        sentenceAudioUrl: urlMap.get(`vocab_${index}_sentence`) || "",
      })
    );
  }

  // Apply to roleplay scenes
  if (updated.roleplay_scenes) {
    updated.roleplay_scenes = updated.roleplay_scenes.map(
      (scene: any, sceneIndex: number) => ({
        ...scene,
        dialogue: scene.dialogue.map((turn: any, turnIndex: number) => ({
          ...turn,
          audioUrl: urlMap.get(`roleplay_s${sceneIndex}_t${turnIndex}`) || "",
        })),
      })
    );
  }

  // Apply to matching pairs
  if (updated.matching_pairs) {
    updated.matching_pairs = updated.matching_pairs.map(
      (pair: any, index: number) => ({
        ...pair,
        leftAudioUrl: urlMap.get(`matching_${index}_left`) || "",
        rightAudioUrl: urlMap.get(`matching_${index}_right`) || "",
      })
    );
  }

  // Apply to summary content
  if (urlMap.has("summary_content")) {
    updated.article_audio_url = urlMap.get("summary_content");
  }

  // Apply to listening content
  if (urlMap.has("listening_content")) {
    updated.listening_drill_audio_url = urlMap.get("listening_content");
  }

  return updated;
}

