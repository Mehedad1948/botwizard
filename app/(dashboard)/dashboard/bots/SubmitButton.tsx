"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button 
      type="submit" 
      disabled={pending} 
      className="h-10 px-6 py-2 w-full sm:w-auto whitespace-nowrap"
    >
      {pending ? "در حال بررسی و افزودن..." : "افزودن ربات"}
    </Button>
  );
}
