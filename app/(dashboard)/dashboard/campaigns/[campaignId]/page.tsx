import { redirect } from "next/navigation";

export default async function CampaignRedirectPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(`/dashboard/telegram/campaigns/${campaignId}`);
}
