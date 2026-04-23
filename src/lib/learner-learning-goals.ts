/** Labels for learning-goal ids stored on Profile.learningGoals (settings + onboarding). */
export const LEARNING_GOAL_ID_LABELS: Record<string, string> = {
  // Settings → goals page
  speak: "Speak confidently in meetings",
  travel: "Travel and communicate abroad",
  academic: "Academic success",
  social: "Make friends and socialize",
  career: "Advance my career",
  // Onboarding learning-goals
  conversations: "Speak naturally in conversations",
  professional: "Sound professional at work",
  interviews: "Prepare for Interviews",
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

/** When set, learners (`role === "user"`) see this plan label in profile and settings (billing not final). */
export const STUDENT_PLAN_LABEL_OVERRIDE: string | null = "Pro";

/** Copy shown under the current plan on profile and subscriptions (no billing dates). */
export const CURRENT_PLAN_CARD_MESSAGE =
  "You're all set—dive in and make the most of every practice session.";

export function planTitleFromUser(user: any | null | undefined): string {
  if (!user) return "—";
  if (
    STUDENT_PLAN_LABEL_OVERRIDE &&
    (user.role === "user" || user.role === "learner")
  ) {
    return STUDENT_PLAN_LABEL_OVERRIDE;
  }
  const plan = (user.subscriptionPlan || "free").toLowerCase();
  if (plan === "premium" || (user.isSubscribed && plan !== "free")) {
    return "Premium";
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
