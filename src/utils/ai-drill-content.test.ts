import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeAiGeneratedToParsedContent } from "./ai-drill-content";

describe("normalizeAiGeneratedToParsedContent", () => {
  it("maps vocabulary target_sentences to items", () => {
    const result = normalizeAiGeneratedToParsedContent("vocabulary", {
      target_sentences: [{ word: "test", text: "A test.", translation: "테스트" }],
    });
    assert.equal(result.type, "vocabulary");
    assert.equal(result.extractedData.items.length, 1);
    assert.equal(result.extractedData.items[0].word, "test");
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
    assert.equal(result.type, "roleplay");
    assert.equal(result.extractedData.items[0].roleplay_scenes.length, 1);
    assert.equal(result.extractedData.items[0].student_character_name, "Nurse");
    assert.equal(result.extractedData.items[0].context, "ICU");
  });

  it("maps summary article fields to items with title", () => {
    const result = normalizeAiGeneratedToParsedContent("summary", {
      article_title: "My Article",
      article_content: "Content here",
    });
    assert.equal(result.extractedData.title, "My Article");
    assert.equal(result.extractedData.items[0].content, "Content here");
  });

  it("maps fill_blank_items directly including context", () => {
    const result = normalizeAiGeneratedToParsedContent("fill_blank", {
      fill_blank_items: [
        {
          context: "You haven't seen your colleague for several shifts, so you say:",
          sentence: "The ___ is red.",
          blanks: [{ position: 0, correctAnswer: "apple", options: ["apple", "banana"], hint: "" }],
        },
      ],
    });
    assert.equal(result.extractedData.items.length, 1);
    assert.equal(
      result.extractedData.items[0].context,
      "You haven't seen your colleague for several shifts, so you say:",
    );
    assert.ok(String(result.extractedData.items[0].sentence).includes("___"));
  });
});
