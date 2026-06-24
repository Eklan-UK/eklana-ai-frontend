import { describe, expect, it } from "vitest";
import { normalizeAiGeneratedToParsedContent } from "./ai-drill-content";

describe("normalizeAiGeneratedToParsedContent", () => {
  it("maps vocabulary target_sentences to items", () => {
    const result = normalizeAiGeneratedToParsedContent("vocabulary", {
      target_sentences: [{ word: "test", text: "A test.", translation: "테스트" }],
    });
    expect(result.type).toBe("vocabulary");
    expect(result.extractedData.items).toHaveLength(1);
    expect(result.extractedData.items[0].word).toBe("test");
  });

  it("maps roleplay flat fields to nested items[0]", () => {
    const result = normalizeAiGeneratedToParsedContent("roleplay", {
      student_character_name: "Nurse",
      ai_character_names: ["Doctor"],
      drill_intro: "Intro",
      context: "ICU",
      roleplay_scenes: [
        {
          scene_name: "Scene 1",
          dialogue: [{ speaker: "ai_0", text: "Hello", translation: "안녕" }],
        },
      ],
    });
    expect(result.type).toBe("roleplay");
    expect(result.extractedData.items[0].roleplay_scenes).toHaveLength(1);
    expect(result.extractedData.items[0].student_character_name).toBe("Nurse");
    expect(result.extractedData.items[0].context).toBe("ICU");
  });

  it("maps summary article fields to items with title", () => {
    const result = normalizeAiGeneratedToParsedContent("summary", {
      article_title: "My Article",
      article_content: "Content here",
    });
    expect(result.extractedData.title).toBe("My Article");
    expect(result.extractedData.items[0].content).toBe("Content here");
  });

  it("maps fill_blank_items directly", () => {
    const result = normalizeAiGeneratedToParsedContent("fill_blank", {
      fill_blank_items: [
        {
          sentence: "The ___ is red.",
          blanks: [{ position: 0, correctAnswer: "apple", options: ["apple", "banana"], hint: "" }],
        },
      ],
    });
    expect(result.extractedData.items).toHaveLength(1);
    expect(result.extractedData.items[0].sentence).toContain("apple");
  });
});
