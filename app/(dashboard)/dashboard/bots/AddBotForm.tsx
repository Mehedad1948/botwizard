"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Loader2 } from "lucide-react";
import { FormEvent, useRef, useState, useTransition } from "react";
import { addBotAction } from "./actions";

export function AddBotForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await addBotAction(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      formRef.current?.reset();
      setSuccess("ربات با موفقیت ثبت و وب‌هوک آن فعال شد.");
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4 sm:flex-nowrap"
    >
      <div className="w-full flex-1 space-y-2">
        <label htmlFor="token" className="text-sm font-medium">
          توکن ربات
        </label>
        <Input
          type="password"
          id="token"
          name="token"
          autoComplete="off"
          placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
          dir="ltr"
          required
        />
        <p className="text-xs text-muted-foreground">
          توکن محرمانه است و پس از ثبت در صفحه نمایش داده نمی‌شود.
        </p>
      </div>
      <Button
        type="submit"
        variant="brand-dark"
        size="brand-sm"
        disabled={pending}
        className="w-full whitespace-nowrap sm:w-auto"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Bot />}
        {pending ? "در حال بررسی و اتصال..." : "افزودن ربات"}
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
      {success && <p className="w-full text-xs text-green-600">{success}</p>}
    </form>
  );
}
