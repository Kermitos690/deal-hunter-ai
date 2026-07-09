export type WhatsAppSendResult =
  | { skipped: false; messageId: string }
  | { skipped: true; reason: "missing_config" | "api_error"; error?: string };

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
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
  if (!token || !phoneNumberId) return { skipped: true, reason: "missing_config" };

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
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp Cloud API error:", payload);
    return { skipped: true, reason: "api_error", error: payload?.error?.message ?? response.statusText };
  }

  const messageId = payload?.messages?.[0]?.id;
  return { skipped: false, messageId: String(messageId ?? "sent") };
}
