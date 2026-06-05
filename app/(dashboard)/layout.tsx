import { ReactNode } from "react";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // Basic protection: if no session, redirect to login
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (Right side for RTL) */}
      <aside className="w-64 border-l bg-card hidden md:flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-primary">Bot Wizard</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="block px-4 py-2 rounded-md hover:bg-muted transition-colors">
            داشبورد
          </Link>
          <Link href="/dashboard/bots" className="block px-4 py-2 rounded-md hover:bg-muted transition-colors">
            مدیریت ربات‌ها
          </Link>
          <Link href="/dashboard/campaigns" className="block px-4 py-2 rounded-md hover:bg-muted transition-colors">
            کمپین‌ها
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <h1 className="font-semibold md:hidden">BotWizard</h1>
          <div className="mr-auto">
            {/* User profile / Logout placeholder */}
            <span className="text-sm text-muted-foreground">پروفایل</span>
          </div>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
