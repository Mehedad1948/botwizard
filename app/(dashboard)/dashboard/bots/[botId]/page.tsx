import { redirect } from "next/navigation";

export default async function BotRedirectPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  redirect(`/dashboard/telegram/bots/${botId}`);
}
