import { redirect } from "next/navigation";

import { dashboardPath } from "@/services/bot-platforms/config";
import { requirePlatformSlug } from "@/services/bot-platforms/server";

export default async function PostsRedirectPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const platformSlug = requirePlatformSlug(platform);
  redirect(dashboardPath(platformSlug, "campaigns"));
}
