import { redirect } from "next/navigation";

/** Legacy / bookmarked links used `/streak`; the app lives under `/account/streak`. */
export default function StreakAliasPage() {
  redirect("/account/streak");
}
