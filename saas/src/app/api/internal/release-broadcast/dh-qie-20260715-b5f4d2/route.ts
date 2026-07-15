import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/db/server";
import {
  approveBroadcast,
  dispatchBroadcastBatch,
  ensureReleaseBroadcast,
  listBroadcasts,
} from "@/telegram/broadcast";

const CLAIM_ID = -20260715151;

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function responseFrom(current: Awaited<ReturnType<typeof listBroadcasts>>[number] | undefined, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    ok: true,
    remaining: 0,
    has_more: false,
    status: current?.status ?? "completed",
    sent: current?.sent_count ?? 0,
    failed: current?.failed_count ?? 0,
    blocked: current?.blocked_count ?? 0,
    skipped: current?.skipped_count ?? 0,
    ...extra,
  }, { headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminTelegramId) {
    return NextResponse.json({ ok: false, error: "ADMIN_TELEGRAM_ID_MISSING" }, { status: 503 });
  }

  const { data: admin, error: adminError } = await serviceDb()
    .from("users")
    .select("id,telegram_id")
    .eq("telegram_id", adminTelegramId)
    .maybeSingle();

  if (adminError || !admin?.id) {
    return NextResponse.json({ ok: false, error: "ADMIN_USER_NOT_FOUND" }, { status: 503 });
  }

  const release = await ensureReleaseBroadcast(admin.id);
  let current = (await listBroadcasts()).find((item) => item.broadcast_id === release.broadcast_id);

  if (!current?.preview_sent_at) {
    return NextResponse.json({ ok: false, error: "PREVIEW_NOT_VALIDATED" }, { status: 409 });
  }

  if (current.completed_at) {
    return responseFrom(current, { already_completed: true });
  }

  const { error: claimError } = await serviceDb().from("processed_updates").insert({ update_id: CLAIM_ID });
  if (claimError) {
    if (claimError.code === "23505") {
      current = (await listBroadcasts()).find((item) => item.broadcast_id === release.broadcast_id);
      return current?.completed_at
        ? responseFrom(current, { already_completed: true })
        : NextResponse.json({ ok: false, error: "BROADCAST_ALREADY_RUNNING" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "CLAIM_FAILED" }, { status: 500 });
  }

  try {
    if (!current.approved_at) {
      await approveBroadcast(release.broadcast_id, admin.id);
    }

    let processed = 0;
    for (let batchNumber = 0; batchNumber < 100; batchNumber += 1) {
      const batch = await dispatchBroadcastBatch(release.broadcast_id, admin.id, 25);
      processed += batch.processed;
      if (!batch.hasMore) break;
    }

    current = (await listBroadcasts()).find((item) => item.broadcast_id === release.broadcast_id);
    if (!current?.completed_at) {
      throw new Error("BROADCAST_BATCH_LIMIT_REACHED");
    }

    return responseFrom(current, { processed, already_completed: false });
  } catch (error) {
    await serviceDb().from("processed_updates").delete().eq("update_id", CLAIM_ID);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "BROADCAST_FAILED",
    }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
