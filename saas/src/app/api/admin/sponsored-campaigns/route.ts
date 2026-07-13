import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { createSponsoredCampaign } from "@/lib/channels/server";

function isPrimaryAdmin(user: { role: string; telegram_id: string | null }) {
  return user.role === "admin" && user.telegram_id === process.env.ADMIN_TELEGRAM_ID;
}

export async function POST(request: Request) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isPrimaryAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  if (process.env.ENABLE_CHANNELS !== "true") return jsonError("Canaux désactivés.", 503);
  try {
    const body = await request.json();
    const result = await createSponsoredCampaign(auth.user.id, {
      sponsorName: String(body.sponsorName ?? ""),
      websiteUrl: body.websiteUrl ? String(body.websiteUrl) : null,
      contactEmail: body.contactEmail ? String(body.contactEmail) : null,
      channelId: body.channelId ? String(body.channelId) : null,
      category: body.category ? String(body.category) : null,
      name: String(body.name ?? ""),
      headline: String(body.headline ?? ""),
      body: body.body ? String(body.body) : null,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      destinationUrl: String(body.destinationUrl ?? ""),
      startsAt: body.startsAt ? String(body.startsAt) : null,
      endsAt: body.endsAt ? String(body.endsAt) : null,
      impressionLimit: body.impressionLimit === "" || body.impressionLimit == null ? null : Number(body.impressionLimit),
      clickLimit: body.clickLimit === "" || body.clickLimit == null ? null : Number(body.clickLimit),
      dailyFrequencyCap: body.dailyFrequencyCap == null ? 1 : Number(body.dailyFrequencyCap)
    });
    return result.created
      ? NextResponse.json(result, { status: 201 })
      : jsonError(result.errors.join(" "), 422, result.errors);
  } catch (error) {
    console.error("Sponsored campaign creation failed:", error instanceof Error ? error.message : "unknown");
    return jsonError("Création de campagne impossible.", 500);
  }
}
