export type WhatsAppSendResult =
  | { skipped: false; messageId: string }
  | { skipped: true; reason: "disabled" | "missing_config" | "api_error"; error?: string };

export function normalizeWhatsAppPhone(value: string) {
  const cleaned = value.trim().replace(/[^+\d]/g, "");
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  return cleaned;
}

export function looksLikeWhatsAppPhone(value: string) {
  return /^\d{8,15}$/.test(normalizeWhatsAppPhone(value));
}

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  if (process.env.ENABLE_WHATSAPP !== "true") return { skipped: true, reason: "disabled" };
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
  if (!token || !phoneNumberId) return { skipped: true, reason: "missing_config" };

  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeWhatsAppPhone(to),
        type: "text",
        text: {
          preview_url: false,
          body: body.slice(0, 4096)
        }
      }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store"
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage = String(payload?.error?.message ?? `HTTP ${response.status}`).slice(0, 240);
      console.error("WhatsApp Cloud API error:", errorMessage);
      return { skipped: true, reason: "api_error", error: errorMessage };
    }

    const messageId = payload?.messages?.[0]?.id;
    return { skipped: false, messageId: String(messageId ?? "sent") };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.slice(0, 240) : "WhatsApp request failed";
    console.error("WhatsApp Cloud API unavailable:", errorMessage);
    return { skipped: true, reason: "api_error", error: errorMessage };
  }
}
