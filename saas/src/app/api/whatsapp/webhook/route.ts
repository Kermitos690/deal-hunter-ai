import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { scanResultText } from "@/telegram/bot";
import { normalizeWhatsAppPhone, sendWhatsAppText } from "@/whatsapp/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return jsonError("Webhook WhatsApp refusé.", 403);
}

type WhatsAppMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

function extractMessages(payload: any): WhatsAppMessage[] {
  return (payload.entry ?? []).flatMap((entry: any) =>
    (entry.changes ?? []).flatMap((change: any) => change.value?.messages ?? [])
  );
}

async function userForPhone(phone: string, displayName?: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const db = serviceDb();
  const { data: existing } = await db
    .from("users")
    .select("*")
    .eq("whatsapp_phone", normalizedPhone)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await db
    .from("users")
    .insert({
      whatsapp_phone: normalizedPhone,
      whatsapp_alerts_enabled: true,
      whatsapp_opt_in_at: new Date().toISOString(),
      display_name: displayName || "WhatsApp User",
      role: "user"
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function replyHelp(to: string) {
  await sendWhatsAppText(to, [
    "Deal Hunter AI sur WhatsApp est actif.",
    "",
    "Commandes :",
    "• scan — lance le premier radar actif lié à ce numéro",
    "• radars — liste tes radars actifs",
    "• aide — affiche ce message",
    "",
    "Pour lier ton compte existant, envoie dans Telegram : /whatsapp +41..."
  ].join("\n"));
}

async function replyRadars(to: string, userId: string) {
  const { data } = await serviceDb()
    .from("radars")
    .select("id,name,is_active,max_buy_price")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data?.length) {
    await sendWhatsAppText(to, "Aucun radar lié à ce numéro. Crée ou lie un radar depuis Telegram avec /whatsapp +41...");
    return;
  }

  await sendWhatsAppText(to, data.map((radar: any) =>
    `${radar.is_active ? "🟢" : "⏸"} ${radar.name} — max ${radar.max_buy_price} CHF`
  ).join("\n"));
}

async function replyScan(to: string, userId: string) {
  const { data: radar } = await serviceDb()
    .from("radars")
    .select("id,name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("next_scan_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!radar) {
    await sendWhatsAppText(to, "Aucun radar actif lié à ce numéro. Envoie /whatsapp +41... dans Telegram pour lier ton compte existant.");
    return;
  }

  await sendWhatsAppText(to, `Scan lancé pour : ${radar.name}`);
  const result = await runRadarScan(radar.id, userId);
  await sendWhatsAppText(to, scanResultText(result));
}

async function handleMessage(message: WhatsAppMessage, displayName?: string) {
  if (!message.id || !message.from) return;
  const db = serviceDb();
  const { error: dedupeError } = await db.from("processed_whatsapp_messages").insert({ message_id: message.id });
  if (dedupeError?.code === "23505") return;
  if (dedupeError) throw dedupeError;

  if (message.type && message.type !== "text") {
    await sendWhatsAppText(message.from, "Je comprends seulement les messages texte pour l’instant. Écris aide, radars ou scan.");
    return;
  }

  const user = await userForPhone(message.from, displayName);
  const text = (message.text?.body ?? "").trim().toLowerCase();

  if (["start", "aide", "help", "menu", "bonjour", "salut"].includes(text)) {
    await replyHelp(message.from);
    return;
  }
  if (text === "radars") {
    await replyRadars(message.from, user.id);
    return;
  }
  if (text === "scan") {
    await replyScan(message.from, user.id);
    return;
  }

  await replyHelp(message.from);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const messages = extractMessages(payload);
  const contacts = (payload.entry ?? []).flatMap((entry: any) =>
    (entry.changes ?? []).flatMap((change: any) => change.value?.contacts ?? [])
  );
  const names = new Map(contacts.map((contact: any) => [contact.wa_id, contact.profile?.name]));

  try {
    await Promise.all(messages.map((message) => handleMessage(message, names.get(message.from))));
  } catch (error) {
    console.error("Traitement WhatsApp impossible:", error instanceof Error ? error.message : "Erreur inconnue");
    return jsonError("Traitement WhatsApp impossible.", 500);
  }

  return NextResponse.json({ ok: true });
}
