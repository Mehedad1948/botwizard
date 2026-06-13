"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TopicActionResult = {
  success?: boolean;
  error?: string;
};

export function TopicCreateForm({
  action,
  className,
  compact = false,
  submitLabel = "افزودن موضوع",
}: {
  action: (formData: FormData) => Promise<TopicActionResult>;
  className?: string;
  compact?: boolean;
  submitLabel?: string;
  }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, formAction, isPending] = useActionState(
    async (_previousState: TopicActionResult | null, formData: FormData) => {
      try {
        const result = await action(formData);
        if (result.success) {
          formRef.current?.reset();
          router.refresh();
        }

        return result;
      } catch {
        const result: TopicActionResult = {
          error: "ایجاد موضوع انجام نشد. دوباره تلاش کنید.",
        };
        return result;
      }
    },
    null,
  );

  return (
    <form ref={formRef} action={formAction} className={cn("space-y-4", className)}>
      <Input
        name="name"
        required
        maxLength={80}
        placeholder="مثال: خودرو برقی"
        disabled={isPending}
      />
      {!compact && (
        <textarea
          name="description"
          maxLength={240}
          placeholder="توضیح کوتاه اختیاری"
          disabled={isPending}
          className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)] focus:ring-2 focus:ring-[color:var(--dashboard-accent-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}
      {message?.error && (
        <p role="alert" className="text-xs leading-5 text-red-600">
          {message.error}
        </p>
      )}
      {message?.success && (
        <p role="status" className="text-xs leading-5 text-emerald-600">
          موضوع با موفقیت ایجاد شد.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        <Plus />
        {isPending ? "در حال افزودن..." : submitLabel}
      </Button>
    </form>
  );
}
