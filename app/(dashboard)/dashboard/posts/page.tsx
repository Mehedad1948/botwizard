import { redirect } from "next/navigation";

export default function LegacyPostsPage() {
  redirect("/dashboard/campaigns");
}
