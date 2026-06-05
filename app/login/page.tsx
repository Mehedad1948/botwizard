import TelegramLoginWidget from "@/components/auth/TelegramLoginWidget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSession();
  
  // If already logged in, redirect to dashboard
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">ورود به پنل کاربری</CardTitle>
          <CardDescription>
            برای استفاده از امکانات AutoPromo از طریق تلگرام وارد شوید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TelegramLoginWidget />
          <p className="text-sm text-muted-foreground mt-4">
            با ورود، شما قوانین استفاده از سرویس را می‌پذیرید.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
