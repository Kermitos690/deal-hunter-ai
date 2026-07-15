import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/db/server";
import {
  approveBroadcast,
  dispatchBroadcastBatch,
  ensureReleaseBroadcast,
  listBroadcasts,
} from "@/telegram/broadcast";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminTelegramId) {
    return NextResponse.json({ ok: false, error: "ADMIN_TELEGRAM_ID_MISSING" }, { status: 503 });
  }

  try {
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
      return NextResponse.json({
        ok: true,
        processed: 0,
        remaining: 0,
        has_more: false,
        status: current.status,
        sent: current.sent_count,
        failed: current.failed_count,
        blocked: current.blocked_count,
        skipped: current.skipped_count,
      }, { headers: { "cache-control": "no-store" } });
    }

    if (!current.approved_at) {
      await approveBroadcast(release.broadcast_id, admin.id);
    }

    const batch = await dispatchBroadcastBatch(release.broadcast_id, admin.id, 25);
    current = (await listBroadcasts()).find((item) => item.broadcast_id === release.broadcast_id);

    return NextResponse.json({
      ok: true,
      processed: batch.processed,
      remaining: batch.remaining,
      has_more: batch.hasMore,
      status: current?.status ?? "sending",
      sent: current?.sent_count ?? 0,
      failed: current?.failed_count ?? 0,
      blocked: current?.blocked_count ?? 0,
      skipped: current?.skipped_count ?? 0,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "BROADCAST_FAILED",
    }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
