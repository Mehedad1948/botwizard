import { Loader2 } from "lucide-react";

export default function BotWorkspaceLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      <span>در حال بارگذاری اطلاعات ربات...</span>
    </div>
  );
}
