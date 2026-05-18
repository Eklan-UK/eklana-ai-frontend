import type { IUser } from "@/models/user";

export function isUserSubscribed(
  user:
    | (Pick<IUser, "subscriptionPlan" | "subscriptionExpiresAt"> & {
        stripeSubscriptionStatus?: string | null;
      })
    | null
    | undefined
): boolean {
  if (!user) return false;
  if (user.subscriptionPlan !== "premium") return false;

  // If Stripe reports the subscription as active or trialing, trust it even
  // if we have no locally stored expiry yet (e.g. webhook delivered period_end late).
  const stripeStatus = (user as any).stripeSubscriptionStatus;
  if (stripeStatus === "active" || stripeStatus === "trialing") return true;

  if (!user.subscriptionExpiresAt) return false;
  const expiresAt =
    user.subscriptionExpiresAt instanceof Date
      ? user.subscriptionExpiresAt
      : new Date(user.subscriptionExpiresAt as unknown as string);
  return expiresAt.getTime() > Date.now();
}





