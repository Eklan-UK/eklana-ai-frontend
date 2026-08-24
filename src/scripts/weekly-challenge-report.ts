// npx tsx --env-file=.env.local src/scripts/weekly-challenge-report.ts

import { connectToDatabase, disconnectFromDatabase } from '@/lib/api/db';
import WeeklyChallengeModel from '@/models/weekly-challenge';
import UserModel from '@/models/user';

const DRILL_LABELS: Record<string, string> = {
  pronunciation: 'Pronunciation',
  vocabulary: 'Vocabulary',
  key_phrases: 'Scenario Pressure Test',
  roleplay: 'Roleplay',
  fill_blank: 'Fill in the Blank',
};

function summariseContent(drillType: string, content: any): string[] {
  if (!content) return ['  (no content)'];

  switch (drillType) {
    case 'pronunciation': {
      const items: any[] = content.pronunciation_items ?? [];
      if (items.length === 0) return ['  (no items)'];
      return items.map((item, i) => `  ${i + 1}. "${item.word}" [${item.sound ?? '?'}] — ${item.sentence}`);
    }

    case 'vocabulary': {
      const items: any[] = content.vocabulary_items ?? content.target_sentences ?? [];
      if (items.length === 0) return ['  (no items)'];
      return items.map((item, i) => {
        const sentence = item.sentence ?? item.text ?? '?';
        const blank = item.blanks?.[0]?.correctAnswer ?? item.word ?? '?';
        return `  ${i + 1}. ${sentence}  → answer: "${blank}"`;
      });
    }

    case 'key_phrases': {
      const items: any[] = content.key_phrase_items ?? [];
      if (items.length === 0) return ['  (no items)'];
      return items.map((item, i) =>
        `  ${i + 1}. [${item.respondentName ?? 'Speaker'}] ${item.prompt}  → correct: "${item.correctAnswer}"`
      );
    }

    case 'roleplay': {
      const scenes: any[] = content.roleplay_scenes ?? [];
      if (scenes.length === 0) return ['  (no scenes)'];

      const studentName: string = content.student_character_name ?? 'Student';
      const aiNames: string[] = content.ai_character_names ?? [];

      const resolveSpeaker = (speaker: string): string => {
        if (speaker === 'student') return studentName;
        const match = speaker.match(/^ai_(\d+)$/);
        if (match) return aiNames[Number(match[1])] ?? speaker;
        return speaker;
      };

      const lines: string[] = [];
      scenes.forEach((scene, i) => {
        const title = scene.scene_name || scene.scene_title || `Scene ${i + 1}`;
        lines.push(`  SCENE ${i + 1}: ${title}`);
        const dialogue: any[] = scene.dialogue ?? [];
        if (dialogue.length === 0) {
          lines.push('    (no dialogue)');
        } else {
          for (const turn of dialogue) {
            const speakerName = resolveSpeaker(turn.speaker);
            lines.push(`    ${speakerName}: "${turn.text}"`);
          }
        }
      });
      return lines;
    }

    case 'fill_blank': {
      const items: any[] = content.fill_blank_items ?? [];
      if (items.length === 0) return ['  (no items)'];
      return items.map((item, i) => `  ${i + 1}. ${item.sentence}`);
    }

    default:
      return [`  (unknown drill type: ${drillType})`];
  }
}

async function main() {
  await connectToDatabase();

  const challenges = await WeeklyChallengeModel.find({
    weekStartDate: { $gte: new Date('2026-06-22T00:00:00.000Z') },
    'content.drillSequence.0': { $exists: true },
  })
    .sort({ generatedAt: -1 })
    .lean();

  if (challenges.length === 0) {
    console.log('No weekly challenges found.');
    await disconnectFromDatabase();
    return;
  }

  const learnerIds = [...new Set(challenges.map((c) => String(c.learnerId)))];
  const users = await UserModel.find({ _id: { $in: learnerIds } })
    .select('_id firstName lastName email')
    .lean();

  const userMap = new Map(
    users.map((u) => [
      String(u._id),
      { name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), email: u.email },
    ]),
  );

  const HR = '═'.repeat(70);
  const hr = '─'.repeat(70);

  console.log(`\nWeekly Challenge Report — ${challenges.length} challenge${challenges.length !== 1 ? 's' : ''}\n`);

  for (const challenge of challenges) {
    const user = userMap.get(String(challenge.learnerId));
    const name = user?.name ?? '(unknown)';
    const email = user?.email ?? '(unknown)';
    const generatedAt = challenge.generatedAt
      ? challenge.generatedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
      : '—';
    const sequence: any[] = challenge.content?.drillSequence ?? [];
    const totalMin = challenge.content?.totalEstimatedMinutes;
    const summary = challenge.content?.summaryMessage;

    console.log(HR);
    console.log(`  ${name}  <${email}>`);
    console.log(`  Generated: ${generatedAt}${totalMin != null ? `   Est. ${totalMin} min` : ''}`);
    if (summary) console.log(`  Summary:   ${summary}`);
    console.log('');

    for (const drill of sequence) {
      const label = DRILL_LABELS[drill.drillType] ?? drill.drillType;
      console.log(`  ${label.toUpperCase()}`);
      console.log(`  ${drill.instructions}`);
      const contentLines = summariseContent(drill.drillType, drill.generatedContent);
      for (const line of contentLines) console.log(line);
      console.log('');
    }
  }

  console.log(HR);
  console.log();

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
