import { getUserFirstName } from "@/utils/user";
import { getCurrentUser } from "./get-user";
import { HomeGreetingClient } from "./home-greeting-client";

export async function HomeGreetingHeader() {
  const userData = await getCurrentUser();
  const firstName = getUserFirstName(userData?.user);

  return <HomeGreetingClient firstName={firstName} />;
}
