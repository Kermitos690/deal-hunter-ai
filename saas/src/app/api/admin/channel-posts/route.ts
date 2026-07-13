import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { createEditorialPost } from "@/lib/channels/admin";

export async function POST(request: Request) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "admin" || auth.user.telegram_id !== process.env.ADMIN_TELEGRAM_ID) {
    return jsonError("Accès administrateur requis.", 403);
  }
  try {
    const body = await request.json();
    const result = await createEditorialPost({
      channelId: String(body.channelId ?? ""),
      title: String(body.title ?? ""),
      summary: body.summary ? String(body.summary) : null,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      destinationUrl: body.destinationUrl ? String(body.destinationUrl) : null,
      expiresAt: body.expiresAt ? String(body.expiresAt) : null
    });
    return result.created
      ? NextResponse.json(result, { status: 201 })
      : jsonError(result.errors.join(" "), 422, result.errors);
  } catch (error) {
    console.error("Editorial channel post failed:", error instanceof Error ? error.message : "unknown");
    return jsonError("Publication impossible.", 500);
  }
}
