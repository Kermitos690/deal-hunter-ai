import { serviceDb } from "@/lib/db/server";
import type { AppUser, DealScore, ProductCandidate } from "@/types";
import {
  channelTargetsForDeal,
  safeSponsoredDestination,
  sponsoredPlacementsAllowedForPlan,
  type SponsoredCampaignInput,
  validateSponsoredCampaignInput
} from "./rules";

export const channelsEnabled = () => process.env.ENABLE_CHANNELS === "true";
export const sponsoredPlacementsEnabled = () => process.env.ENABLE_SPONSORED_PLACEMENTS === "true";

function dbFailure(operation: string, error: { message?: string } | null) {
  if (error) throw new Error(`${operation}: ${error.message ?? "database error"}`);
}

export async function listChannelsForUser(userId: string) {
  if (!channelsEnabled()) return [];
  const db = serviceDb();
  const [{ data: channels, error: channelsError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    db.from("channels")
      .select("id,slug,name,description,category,sort_order")
      .eq("status", "active")
      .eq("is_public", true)
      .order("sort_order", { ascending: true }),
    db.from("channel_subscriptions")
      .select("channel_id,notification_mode")
      .eq("user_id", userId)
  ]);
  dbFailure("Lecture des canaux", channelsError);
  dbFailure("Lecture des abonnements aux canaux", subscriptionsError);
  const subscriptionsByChannel = new Map((subscriptions ?? []).map((row: any) => [row.channel_id, row.notification_mode]));
  return (channels ?? []).map((channel: any) => ({
    ...channel,
    subscribed: subscriptionsByChannel.has(channel.id),
    notificationMode: subscriptionsByChannel.get(channel.id) ?? null
  }));
}

export async function subscribeToChannel(userId: string, slug: string, mode = "dashboard") {
  if (!channelsEnabled()) return { subscribed: false, reason: "disabled" as const };
  const { data, error } = await serviceDb().rpc("subscribe_channel", {
    p_user_id: userId,
    p_channel_slug: slug,
    p_notification_mode: mode
  });
  dbFailure("Abonnement au canal", error);
  return { subscribed: Boolean(data), reason: null };
}

export async function unsubscribeFromChannel(userId: string, slug: string) {
  if (!channelsEnabled()) return { unsubscribed: false, reason: "disabled" as const };
  const { data, error } = await serviceDb().rpc("unsubscribe_channel", {
    p_user_id: userId,
    p_channel_slug: slug
  });
  dbFailure("Désabonnement du canal", error);
  return { unsubscribed: Boolean(data), reason: null };
}

export async function publishDealToChannels(input: {
  candidate: ProductCandidate;
  score: DealScore;
  productId: string;
  dealScoreId: string;
  alertId: string;
}) {
  if (!channelsEnabled()) return { published: 0, targets: [] as string[] };
  const targets = channelTargetsForDeal(input.candidate, input.score);
  if (!targets.length) return { published: 0, targets: [] as string[] };
  const db = serviceDb();
  const slugs = targets.map((target) => target.slug);
  const { data: channels, error: channelError } = await db
    .from("channels")
    .select("id,slug")
    .in("slug", slugs)
    .eq("status", "active")
    .eq("is_public", true);
  dbFailure("Résolution des canaux", channelError);
  if (!channels?.length) return { published: 0, targets: [] as string[] };

  const summary = [
    `Score ${input.score.totalScore}/100`,
    `marge nette estimée ${input.score.estimatedNetProfit.toFixed(0)} CHF`,
    `ROI ${input.score.estimatedRoiPercent.toFixed(1)} %`,
    `confiance ${input.score.marketConfidence}`
  ].join(" · ");
  const { error: postError } = await db.from("channel_posts").upsert(
    channels.map((channel: any) => ({
      channel_id: channel.id,
      post_type: "deal",
      product_id: input.productId,
      deal_score_id: input.dealScoreId,
      source_alert_id: input.alertId,
      title: input.candidate.title,
      summary,
      image_url: input.candidate.imageUrls[0] ?? null,
      destination_url: input.candidate.productUrl,
      rank_score: input.score.totalScore,
      status: "published",
      published_at: new Date().toISOString()
    })),
    { onConflict: "channel_id,product_id" }
  );
  dbFailure("Publication du deal dans les canaux", postError);
  return { published: channels.length, targets: channels.map((channel: any) => channel.slug) };
}

async function sponsoredPlacementForChannel(user: AppUser, channel: any) {
  if (!sponsoredPlacementsAllowedForPlan(user.plan, {
    enabled: sponsoredPlacementsEnabled(),
    showOnPaidPlans: process.env.SPONSORED_ON_PAID_PLANS === "true"
  })) return null;

  const db = serviceDb();
  const now = new Date().toISOString();
  const { data: campaigns, error } = await db
    .from("sponsored_campaigns")
    .select("id,channel_id,category,headline,body,image_url,disclosure_label,impressions_count,clicks_count,starts_at,ends_at,sponsors(name)")
    .in("status", ["approved", "active"])
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: true })
    .limit(20);
  dbFailure("Lecture des placements sponsorisés", error);

  const matching = (campaigns ?? []).filter((campaign: any) =>
    campaign.channel_id === channel.id ||
    (!campaign.channel_id && campaign.category && campaign.category === channel.category)
  );
  for (const campaign of matching) {
    const { data: recorded, error: impressionError } = await db.rpc("record_sponsored_impression", {
      p_campaign_id: campaign.id,
      p_user_id: user.id,
      p_channel_id: channel.id
    });
    dbFailure("Enregistrement impression sponsorisée", impressionError);
    if (recorded) return campaign;
  }
  return null;
}

export async function channelFeed(user: AppUser, slug: string) {
  if (!channelsEnabled()) return null;
  const db = serviceDb();
  const { data: channel, error: channelError } = await db
    .from("channels")
    .select("id,slug,name,description,category")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("is_public", true)
    .maybeSingle();
  dbFailure("Lecture du canal", channelError);
  if (!channel) return null;

  const [{ data: subscription, error: subscriptionError }, { data: posts, error: postsError }, sponsored] = await Promise.all([
    db.from("channel_subscriptions")
      .select("id,notification_mode")
      .eq("channel_id", channel.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    db.from("channel_posts")
      .select("id,post_type,title,summary,image_url,destination_url,rank_score,published_at,products(source,price_amount,price_currency,condition_grade),deal_scores(total_score,estimated_net_profit,estimated_roi_percent,market_confidence,recommendation)")
      .eq("channel_id", channel.id)
      .eq("status", "published")
      .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
      .order("published_at", { ascending: false })
      .order("rank_score", { ascending: false })
      .limit(50),
    sponsoredPlacementForChannel(user, channel)
  ]);
  dbFailure("Lecture abonnement du canal", subscriptionError);
  dbFailure("Lecture du flux du canal", postsError);
  return { channel, subscription, posts: posts ?? [], sponsored };
}

export async function recordSponsoredClick(userId: string, campaignId: string, channelId: string) {
  if (!sponsoredPlacementsEnabled()) return null;
  const { data, error } = await serviceDb().rpc("record_sponsored_click", {
    p_campaign_id: campaignId,
    p_user_id: userId,
    p_channel_id: channelId
  });
  dbFailure("Enregistrement clic sponsorisé", error);
  return typeof data === "string" ? safeSponsoredDestination(data) : null;
}

export async function createSponsoredCampaign(adminUserId: string, input: SponsoredCampaignInput) {
  if (!channelsEnabled()) throw new Error("Channels disabled.");
  const validation = validateSponsoredCampaignInput(input);
  if (!validation.valid) return { created: false, errors: validation.errors };
  const db = serviceDb();
  const { data: sponsor, error: sponsorError } = await db.from("sponsors").insert({
    name: input.sponsorName.trim(),
    website_url: input.websiteUrl || null,
    contact_email: input.contactEmail || null,
    status: "active"
  }).select("id").single();
  dbFailure("Création du sponsor", sponsorError);

  const { data: campaign, error: campaignError } = await db.from("sponsored_campaigns").insert({
    sponsor_id: sponsor.id,
    channel_id: input.channelId || null,
    category: input.category || null,
    name: input.name.trim(),
    headline: input.headline.trim(),
    body: input.body?.trim() || "",
    image_url: input.imageUrl || null,
    destination_url: safeSponsoredDestination(input.destinationUrl),
    disclosure_label: "Sponsorisé",
    status: "draft",
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    impression_limit: input.impressionLimit ?? null,
    click_limit: input.clickLimit ?? null,
    daily_frequency_cap: input.dailyFrequencyCap ?? 1,
    created_by_user_id: adminUserId
  }).select("id,status").single();
  dbFailure("Création de la campagne sponsorisée", campaignError);
  return { created: true, campaign, errors: [] as string[] };
}

export async function updateSponsoredCampaignStatus(
  adminUserId: string,
  campaignId: string,
  status: "approved" | "active" | "paused" | "ended" | "rejected"
) {
  if (!channelsEnabled()) return { updated: false };
  const patch: Record<string, unknown> = { status };
  if (status === "approved" || status === "active") {
    patch.approved_by_user_id = adminUserId;
    patch.approved_at = new Date().toISOString();
  }
  const { data, error } = await serviceDb().from("sponsored_campaigns")
    .update(patch)
    .eq("id", campaignId)
    .select("id,status")
    .maybeSingle();
  dbFailure("Mise à jour de campagne sponsorisée", error);
  return { updated: Boolean(data), campaign: data };
}
