import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { updateSponsoredCampaignStatus } from "@/lib/channels/server";

const statuses = new Set(["approved", "active", "paused", "ended", "rejected"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "admin" || auth.user.telegram_id !== process.env.ADMIN_TELEGRAM_ID) {
    return jsonError("Accès administrateur requis.", 403);
  }
  const { campaignId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (!UUID.test(campaignId) || !statuses.has(status)) return jsonError("Mise à jour invalide.", 422);
  try {
    const result = await updateSponsoredCampaignStatus(
      auth.user.id,
      campaignId,
      status as "approved" | "active" | "paused" | "ended" | "rejected"
    );
    return result.updated ? NextResponse.json(result) : jsonError("Campagne introuvable.", 404);
  } catch (error) {
    console.error("Sponsored campaign moderation failed:", error instanceof Error ? error.message : "unknown");
    return jsonError("Mise à jour impossible.", 500);
  }
}
