import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionUser();

  redirect(session ? "/hub" : "/login");
}
