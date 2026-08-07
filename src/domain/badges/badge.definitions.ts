import type { BadgeDefinition } from './badge.types';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    badgeId: 'first-steps',
    badgeName: 'First Steps',
    icon: '👣',
    sortOrder: 1,
    beforeDescription: 'You earn this award for completing your first ever drill.',
    afterOutcome:
      "You've earned this award for completing your first drill and officially started your journey toward confident nursing communication.",
    humorousLine: "Looks like someone's been busy.",
  },
  {
    badgeId: 'seven-day-stretch',
    badgeName: '7-Day Stretch',
    icon: '🔥',
    sortOrder: 2,
    beforeDescription:
      'You earn this award for practising for at least 5 minutes every day for 7 consecutive days.',
    afterOutcome:
      "You've earned this award for practicing for at least 5 minutes every day for 7 consecutive days.",
    humorousLine: 'At this point, your phone expects to see you.',
  },
  {
    badgeId: 'done-and-dusted',
    badgeName: 'Done & Dusted',
    icon: '🏆',
    sortOrder: 3,
    beforeDescription: 'You earn this award for completing all drills for the week.',
    afterOutcome: "You've earned this award for completing all drills for the week.",
    humorousLine: 'And they all lived happily ever after... or not. Next?',
  },
  {
    badgeId: 'deja-vu',
    badgeName: 'Déjà Vu',
    icon: '🔭',
    sortOrder: 4,
    beforeDescription:
      'You earn this award for practising a difficult drill at least 10 times.',
    afterOutcome:
      "You've earned this award for practising a difficult drill at least 10 times.",
    humorousLine: 'If this drill could talk, it would know your voice by now.',
  },
  {
    badgeId: 'monthly-challenge',
    badgeName: 'Monthly Challenge',
    icon: '📅',
    sortOrder: 5,
    beforeDescription:
      'You earn this award for practicing at least 5 minutes everyday for 14 consecutive days within a single month.',
    afterOutcome:
      "You've earned this award for practicing at least 5 minutes everyday for 14 consecutive days within a single month.",
    humorousLine:
      'Not every hero wears a cape... Turns out consistency is a superpower.',
  },
  {
    badgeId: 'master-collector',
    badgeName: 'Master Collector',
    icon: '📚',
    sortOrder: 6,
    beforeDescription:
      'You earn this award for saving a drill to revisit and master later.',
    afterOutcome:
      "You've earned this award for saving a drill to revisit and master later.",
    humorousLine: 'This drill is already getting nervous. We love seeing it.',
  },
  {
    badgeId: 'medication-master',
    badgeName: 'Medication Master',
    icon: '💊',
    sortOrder: 7,
    beforeDescription:
      'You earn this award for correctly practicing 50 medication names and explanations.',
    afterOutcome:
      "You've earned this award for correctly practicing 50 medication names and explanations.",
    humorousLine: "Metoprolol is even scared of you now... You're in charge.",
  },
  {
    badgeId: 'handover-hero',
    badgeName: 'Handover Hero',
    icon: '📋',
    sortOrder: 8,
    beforeDescription: 'You earn this award for completing handover drills.',
    afterOutcome: "You've earned this award for completing handover drills.",
    humorousLine: 'Clear. Concise. Complete. Look at you!',
  },
  {
    badgeId: 'nightingale-award',
    badgeName: 'Nightingale Award',
    icon: '👑',
    sortOrder: 9,
    beforeDescription: 'You earn this award for completing Zero Pause Challenge.',
    afterOutcome: "You've earned this award for completing Zero Pause Challenge.",
    humorousLine: 'Florence is looking down on you and smiling.',
  },
  {
    badgeId: 'skill-keeper',
    badgeName: 'Skill Keeper',
    icon: '🔄',
    sortOrder: 10,
    beforeDescription: 'You earn this award for completing your assigned daily refresh.',
    afterOutcome: "You've earned this award for completing your assigned daily refresh.",
    humorousLine: "You keep showing up. That's what stars do.",
  },
];

export const BADGE_BY_ID = new Map(
  BADGE_DEFINITIONS.map((b) => [b.badgeId, b])
);

/** Legacy streak badge id → canonical badge id */
export const LEGACY_BADGE_ID_MAP: Record<string, string> = {
  'week-warrior': 'seven-day-stretch',
};

export function normalizeBadgeId(badgeId: string): string {
  return LEGACY_BADGE_ID_MAP[badgeId] ?? badgeId;
}
