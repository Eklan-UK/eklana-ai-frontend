import type { IUser } from "@/models/user";

export function isUserSubscribed(
  user: Pick<IUser, "subscriptionPlan" | "subscriptionExpiresAt">
): boolean {
  if (user.subscriptionPlan !== "premium") return false;
  if (!user.subscriptionExpiresAt) return false;
  return user.subscriptionExpiresAt.getTime() > Date.now();
}





