/**
 * Pure UI gating helpers for the subscriptions settings page trial CTA.
 */

export function showTrialBanner(eligibleForTrial: boolean): boolean {
  return eligibleForTrial;
}

export function subscribeCtaLabel(
  eligibleForTrial: boolean
): 'Start free trial' | 'Subscribe' {
  return eligibleForTrial ? 'Start free trial' : 'Subscribe';
}
