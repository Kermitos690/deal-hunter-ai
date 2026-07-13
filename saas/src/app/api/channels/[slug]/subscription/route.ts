import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { subscribeToChannel, unsubscribeFromChannel } from "@/lib/channels/server";

const modes = new Set(["dashboard", "telegram", "both", "none"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (process.env.ENABLE_CHANNELS !== "true") return jsonError("Canaux désactivés.", 503);
  const { slug } = await context.params;
  const body = await request.json().catch(() => ({}));
  const mode = String(body.notificationMode ?? "dashboard");
  if (!modes.has(mode)) return jsonError("Mode de notification invalide.", 422);
  try {
    const result = await subscribeToChannel(auth.user.id, slug, mode);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Channel subscription failed:", error instanceof Error ? error.message : "unknown");
    return jsonError("Abonnement au canal impossible.", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (process.env.ENABLE_CHANNELS !== "true") return jsonError("Canaux désactivés.", 503);
  const { slug } = await context.params;
  try {
    return NextResponse.json(await unsubscribeFromChannel(auth.user.id, slug));
  } catch (error) {
    console.error("Channel unsubscribe failed:", error instanceof Error ? error.message : "unknown");
    return jsonError("Désabonnement impossible.", 500);
  }
}
