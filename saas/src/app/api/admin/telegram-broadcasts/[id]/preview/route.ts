import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { sendBroadcastPreview } from "@/telegram/broadcast";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const { id } = await params;
  try {
    return NextResponse.json(await sendBroadcastPreview(id, auth.user.id));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Aperçu impossible.", 500);
  }
}
