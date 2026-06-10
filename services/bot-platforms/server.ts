import { notFound } from "next/navigation";

import {
  isPlatformSlug,
  type PlatformSlug,
} from "@/services/bot-platforms/config";

export function requirePlatformSlug(value: string): PlatformSlug {
  if (!isPlatformSlug(value)) notFound();
  return value;
}
