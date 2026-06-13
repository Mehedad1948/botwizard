"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ReactNode, useState, useTransition } from "react";

export type DashboardActionResult = {
  success?: boolean;
  error?: string;
};

type ConfirmedActionButtonProps = {
  action: () => Promise<DashboardActionResult>;
  children: ReactNode;
  confirmTitle?: string;
  confirmDescription?: string;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  ariaLabel?: string;
};

export function ConfirmedActionButton({
  action,
  children,
  confirmTitle,
  confirmDescription,
  pendingLabel = "در حال انجام...",
  variant = "outline",
  size = "sm",
  className,
  ariaLabel,
}: ConfirmedActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const needsConfirmation = Boolean(confirmTitle && confirmDescription);

  const runAction = () => {
    setError("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
      } catch {
        setError("انجام عملیات ممکن نشد. دوباره تلاش کنید.");
      }
    });
  };

  const content = pending ? (
    <>
      <Loader2 className="animate-spin" />
      <span>{pendingLabel}</span>
    </>
  ) : (
    children
  );

  if (!needsConfirmation) {
    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          disabled={pending}
          onClick={runAction}
          aria-label={ariaLabel}
        >
          {content}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            disabled={pending}
            aria-label={ariaLabel}
          >
            {content}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={pending}
              onClick={runAction}
            >
              {pending ? pendingLabel : "تأیید و ادامه"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
