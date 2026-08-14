/** Labels for learning-goal ids stored on Profile.learningGoals (settings + onboarding). */
export const LEARNING_GOAL_ID_LABELS: Record<string, string> = {
  // Settings → goals page
  speak: "Speak confidently in meetings",
  travel: "Travel confidently",
  academic: "Academic success",
  social: "Make friends and socialize",
  career: "Advance my career",
  // Onboarding learning-goals
  conversations: "Speak naturally in conversations",
  professional: "Sound professional at work",
  interviews: "Prepare for Interviews",
  // Settings → goals page (Figma desktop)
  work_korea_foreign: "Working for a foreign company in Korea",
  working_holiday: "Working holiday / planning to travel",
  grad_school: "Planning for graduate school",
  love_languages: "I love learning languages",
  future_opportunities: "Preparing for future opportunities",
};

export function formatProfileLearningGoalsShort(profile: {
  learningGoals?: string[] | null;
  learningGoal?: string | null;
}): string {
  if (profile.learningGoals && profile.learningGoals.length > 0) {
    const labels = profile.learningGoals.map(
      (id) => LEARNING_GOAL_ID_LABELS[id] || id
    );
    if (labels.length <= 2) return labels.join(" · ");
    return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2}`;
  }
  if (profile.learningGoal?.trim()) {
    const t = profile.learningGoal.trim();
    if (t.length > 40) return `${t.slice(0, 37)}…`;
    return t;
  }
  return "Not set";
}

/** @deprecated Override removed — plan label now reflects real Stripe subscription state. */
export const STUDENT_PLAN_LABEL_OVERRIDE: string | null = null;

/** Copy shown under the current plan when the user is subscribed (Pro). */
export const CURRENT_PLAN_CARD_MESSAGE_PRO =
  "You have full access to AI features — dive in!";

/** Copy shown under the current plan when the user is on the free plan. */
export const CURRENT_PLAN_CARD_MESSAGE_FREE =
  "Upgrade to Pro to unlock Eklan Simulation Room and all AI features.";

/** Native title + hover tooltip for UI locked behind a Pro subscription. */
export const PRO_FEATURE_LOCK_HOVER_MESSAGE =
  "Upgrade to Pro to use this feature.";

/** @deprecated Use CURRENT_PLAN_CARD_MESSAGE_PRO / CURRENT_PLAN_CARD_MESSAGE_FREE. */
export const CURRENT_PLAN_CARD_MESSAGE = CURRENT_PLAN_CARD_MESSAGE_PRO;

export function getPlanCardMessage(isSubscribed: boolean): string {
  return isSubscribed ? CURRENT_PLAN_CARD_MESSAGE_PRO : CURRENT_PLAN_CARD_MESSAGE_FREE;
}

export function planTitleFromUser(user: any | null | undefined): string {
  if (!user) return "—";
  const plan = (user.subscriptionPlan || "free").toLowerCase();
  if (plan === "premium" || user.isSubscribed === true) {
    return "Pro";
  }
  return "Free";
}

export function formatSubscriptionExpiryLine(user: any | null | undefined): string | null {
  if (!user?.subscriptionExpiresAt) return null;
  try {
    const d = new Date(user.subscriptionExpiresAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}
