import fs from 'fs';
import { generateDrill } from './domain/drills/ai-drill-generator.service';

const drillTypes = ['roleplay', 'vocabulary', 'fill_blank', 'pronunciation', 'key_phrases'];
const params = {
  difficulty: 'intermediate',
  context: 'ICU nurse at Mount Sinai giving handover',
  prompt: 'Prepare a 15-20 minute roleplay between a female Korean Nurse and a patient at Mount Sinai hospital in New York in ICU and specifically within the Rapid Response Unit. Her patients often complain about Vasovagal Syncope. The scenario starts with an emergency/critical situation. The Korean nurse likes to pay close attention to her patient and sometimes uses culturally relevant humor to help patients relax.',
  topic: 'handling_emergency_critical',
  part: '1',
  studentId: '6995750e9882aa80e597d516',
};

function formatVocabulary(result: any): string {
  const items = result?.target_sentences ?? [];
  if (items.length === 0) return '(no vocabulary items returned)';
  return items
    .map((item: any, i: number) => {
      const lines = [`${i + 1}. ${item.word ?? '(no word)'}`];
      if (item.wordTranslation) lines.push(`   Korean: ${item.wordTranslation}`);
      lines.push(`   Sentence: ${item.text ?? ''}`);
      if (item.translation) lines.push(`   Translation: ${item.translation}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatPronunciation(result: any): string {
  const items = result?.pronunciation_items ?? [];
  if (items.length === 0) return '(no pronunciation items returned)';
  return items
    .map(
      (item: any, i: number) =>
        `${i + 1}. Sound: ${item.sound ?? ''}\n   Word: ${item.word ?? ''}\n   Sentence: ${item.sentence ?? ''}`
    )
    .join('\n\n');
}

function formatRoleplay(result: any): string {
  const studentName = result?.student_character_name ?? 'Student';
  const aiNames: string[] = result?.ai_character_names ?? [];
  const scenes = result?.roleplay_scenes ?? [];

  const speakerName = (speaker: string): string => {
    if (speaker === 'student') return studentName;
    const match = /^ai_(\d+)$/.exec(speaker ?? '');
    if (match) return aiNames[Number(match[1])] ?? speaker;
    return speaker;
  };

  if (scenes.length === 0) return '(no roleplay scenes returned)';

  return scenes
    .map((scene: any, i: number) => {
      const header = `Scene ${i + 1}: ${scene.scene_name ?? '(untitled)'}`;
      const dialogue = (scene.dialogue ?? [])
        .map((turn: any) => `  ${speakerName(turn.speaker)}: ${turn.text}`)
        .join('\n');
      return `${header}\n${dialogue}`;
    })
    .join('\n\n');
}

function formatFillBlank(result: any): string {
  const items = result?.fill_blank_items ?? [];
  if (items.length === 0) return '(no fill-in-the-blank items returned)';
  return items
    .map((item: any, i: number) => {
      const answers = (item.blanks ?? [])
        .map((b: any) => `"${b.correctAnswer}"`)
        .join(', ');
      return `${i + 1}. ${item.sentence ?? ''}\n   Correct answer(s): ${answers}`;
    })
    .join('\n\n');
}

function formatKeyPhrases(result: any): string {
  const items = result?.key_phrase_items ?? [];
  if (items.length === 0) return '(no key phrase items returned)';
  return items
    .map(
      (item: any, i: number) =>
        `${i + 1}. ${item.respondentName ? `${item.respondentName}: ` : ''}"${item.prompt ?? ''}"\n   Correct answer: ${item.correctAnswer ?? ''}`
    )
    .join('\n\n');
}

const formatters: Record<string, (result: any) => string> = {
  vocabulary: formatVocabulary,
  pronunciation: formatPronunciation,
  roleplay: formatRoleplay,
  fill_blank: formatFillBlank,
  key_phrases: formatKeyPhrases,
};

async function run() {
  const sections: string[] = [];

  for (const drillType of drillTypes) {
    console.log(`\n=== Generating ${drillType} ===`);
    const heading = `\n${'='.repeat(60)}\n${drillType.toUpperCase()}\n${'='.repeat(60)}\n`;
    try {
      const result = await generateDrill({ ...params, drillType: drillType as any });
      const formatter = formatters[drillType] ?? ((r: any) => JSON.stringify(r, null, 2));
      sections.push(heading + formatter(result));
    } catch (e: any) {
      console.error(`Failed: ${e.message}`);
      sections.push(heading + `FAILED: ${e.message}`);
    }
  }

  const output = sections.join('\n');
  fs.writeFileSync('drill-preview.txt', output, 'utf8');
  console.log('\nSaved output to drill-preview.txt');
}

run();
