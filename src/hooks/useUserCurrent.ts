"use client";

import { useQuery } from "@tanstack/react-query";
import { userAPI } from "@/lib/api";

export type UserCurrentResponse = {
  user: any;
  profile?: any;
  tutorProfile?: any;
};

export function useUserCurrent() {
  return useQuery({
    queryKey: ["user-current"],
    queryFn: () =>
      userAPI.getCurrent({ cache: false }) as Promise<UserCurrentResponse>,
    staleTime: 1000 * 60 * 2,
  });
}
