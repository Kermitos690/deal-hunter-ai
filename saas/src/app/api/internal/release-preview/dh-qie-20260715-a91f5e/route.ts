import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/db/server";
import { ensureReleaseBroadcast, sendBroadcastPreview } from "@/telegram/broadcast";

const CLAIM_ID = -20260715091;

export const dynamic = "force-dynamic";

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

  const { error: claimError } = await serviceDb().from("processed_updates").insert({ update_id: CLAIM_ID });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ ok: true, already_sent: true }, { headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({ ok: false, error: "CLAIM_FAILED" }, { status: 500 });
  }

  try {
    const broadcast = await ensureReleaseBroadcast(admin.id);
    const preview = await sendBroadcastPreview(broadcast.broadcast_id, admin.id);
    return NextResponse.json({ ok: true, already_sent: false, preview }, {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    await serviceDb().from("processed_updates").delete().eq("update_id", CLAIM_ID);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "PREVIEW_FAILED"
    }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
