import type { IUser } from "@/models/user";

export function isUserSubscribed(
  user: Pick<IUser, "subscriptionPlan" | "subscriptionExpiresAt"> | null | undefined
): boolean {
  if (!user) return false;
  if (user.subscriptionPlan !== "premium") return false;
  if (!user.subscriptionExpiresAt) return false;
  const expiresAt =
    user.subscriptionExpiresAt instanceof Date
      ? user.subscriptionExpiresAt
      : new Date(user.subscriptionExpiresAt as unknown as string);
  return expiresAt.getTime() > Date.now();
}





