"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { PlatformSlug } from "@/services/bot-platforms/config";
import { createPairingCodeAction } from "./actions";

export function PairingCodeButton({
  platform,
  botId,
}: {
  platform: PlatformSlug;
  botId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");

  const generate = () => {
    setError("");
    startTransition(async () => {
      const result = await createPairingCodeAction(platform, botId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCommand(result.pairingCommand ?? "");
    });
  };

  return (
    <div className="w-full space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs leading-5 text-amber-800">
        مالک بله هنوز به این ربات متصل نشده است.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={generate}
      >
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {pending ? "در حال ساخت..." : "ساخت کد اتصال جدید"}
      </Button>
      {command && (
        <code
          className="block rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800"
          dir="ltr"
        >
          {command}
        </code>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
