import type { ReactNode } from "react";

import { requirePlatformSlug } from "@/services/bot-platforms/server";

export default async function PlatformDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  requirePlatformSlug(platform);
  return children;
}
