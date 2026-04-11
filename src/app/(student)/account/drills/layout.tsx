import type { ReactNode } from "react";
import { generateMetadata } from "@/utils/seo";

export const metadata = generateMetadata({
  title: "My Plans",
  description: "Your assigned drills, next live session, and learning plan",
  path: "/account/drills",
});

export default function DrillsLayout({ children }: { children: ReactNode }) {
  return children;
}
