import LoginPageClient from "@/components/auth/LoginPageClient";
import { getSession } from "@/lib/session";
import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function LoginPage() {
  const session = await getSession();

  if (session?.userId) {
    redirect("/dashboard");
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950"
      dir="rtl"
    >
      <Suspense
        fallback={<Loader2 className="h-8 w-8 animate-spin text-amber-500" />}
      >
        <LoginPageClient />
      </Suspense>
    </main>
  );
}
