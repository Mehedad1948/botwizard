import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ErrorStateProps = {
  code: string;
  title: string;
  description: string;
  icon: ReactNode;
  actions: ReactNode;
  reference?: string;
  compact?: boolean;
};

export function ErrorState({
  code,
  title,
  description,
  icon,
  actions,
  reference,
  compact = false,
}: ErrorStateProps) {
  return (
    <main
      className={cn(
        "flex w-full items-center justify-center px-4 py-10",
        compact ? "min-h-[60vh]" : "min-h-svh"
      )}
    >
      <div className="w-full max-w-xl rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive [&_svg]:size-8">
          {icon}
        </div>
        <p className="mb-2 text-sm font-semibold tracking-widest text-muted-foreground">
          {code}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
          {description}
        </p>
        <div className="mt-7 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          {actions}
        </div>
        {reference && (
          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            کد پیگیری:{" "}
            <span className="font-mono" dir="ltr">
              {reference}
            </span>
          </p>
        )}
      </div>
    </main>
  );
}
