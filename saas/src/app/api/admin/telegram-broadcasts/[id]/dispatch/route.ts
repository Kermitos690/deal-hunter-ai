import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { approveBroadcast, dispatchBroadcastBatch, listBroadcasts } from "@/telegram/broadcast";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  confirmation: z.literal("DIFFUSER"),
  batch_size: z.number().int().min(1).max(50).default(25),
  approve: z.boolean().default(false)
});

export async function POST(request: Request, { params }: Context) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Confirmation DIFFUSER requise.", 422, parsed.error.flatten());
  const { id } = await params;

  try {
    const broadcasts = await listBroadcasts();
    const current = broadcasts.find((broadcast) => broadcast.broadcast_id === id);
    if (!current) return jsonError("Diffusion introuvable.", 404);
    if (!current.preview_sent_at) return jsonError("Envoie d’abord un aperçu à ton compte Telegram.", 409);
    if (parsed.data.approve && !current.approved_at) await approveBroadcast(id, auth.user.id);
    if (!parsed.data.approve && !current.approved_at) return jsonError("Validation finale requise.", 409);

    const result = await dispatchBroadcastBatch(id, auth.user.id, parsed.data.batch_size);
    const updated = (await listBroadcasts()).find((broadcast) => broadcast.broadcast_id === id) ?? null;
    return NextResponse.json({ ...result, broadcast: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Diffusion impossible.", 500);
  }
}
