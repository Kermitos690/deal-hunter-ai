import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { ProductCandidate, SourceAdapter } from "@/types";

const allowedSenders = () => (process.env.EMAIL_ALLOWED_SENDERS ?? "")
  .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

export const emailAlertsAdapter: SourceAdapter = {
  name: "email-alerts",
  enabled: process.env.ENABLE_EMAIL_ALERTS_SOURCE === "true" &&
    Boolean(process.env.EMAIL_IMAP_SERVER && process.env.EMAIL_ADDRESS && process.env.EMAIL_APP_PASSWORD),
  async scan(radar) {
    if (!this.enabled) return [];
    const client = new ImapFlow({
      host: process.env.EMAIL_IMAP_SERVER!,
      port: Number(process.env.EMAIL_IMAP_PORT ?? 993),
      secure: true,
      auth: { user: process.env.EMAIL_ADDRESS!, pass: process.env.EMAIL_APP_PASSWORD! },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      logger: false
    });
    const results: ProductCandidate[] = [];
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 48 * 3_600_000);
      const searchResult = await client.search({ since });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      for await (const message of client.fetch(uids.slice(-100), { source: true, envelope: true, uid: true })) {
        const sender = message.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        if (allowedSenders().length && !allowedSenders().some((domain) => sender.endsWith(domain))) continue;
        if (!message.source) continue;
        const parsed = await (simpleParser(message.source) as Promise<ParsedMail>);
        const body = `${parsed.subject ?? ""}\n${parsed.text ?? ""}`;
        const query = [...radar.brands, ...radar.models, ...radar.include_keywords, radar.category].map((x) => x.toLowerCase());
        if (query.length && !query.some((term) => body.toLowerCase().includes(term))) continue;
        const url = body.match(/https?:\/\/[^\s<>"')]+/)?.[0];
        const price = body.match(/(?:CHF|EUR|USD|GBP|JPY|€|\$|£)\s*([0-9][0-9'.,]*)|([0-9][0-9'.,]*)\s*(CHF|EUR|USD|GBP|JPY)/i);
        if (!url || !price) continue;
        const amount = Number((price[1] ?? price[2]).replace(/'/g, "").replace(",", "."));
        const symbol = (price[3] ?? body.match(/CHF|EUR|USD|GBP|JPY|€|\$|£/)?.[0] ?? "CHF").toUpperCase();
        const currency = symbol === "€" ? "EUR" : symbol === "$" ? "USD" : symbol === "£" ? "GBP" : symbol;
        const html = parsed.html || "";
        const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)/gi)].map((match) => match[1]).filter((x) => x.startsWith("http"));
        results.push({
          source: `email:${sender.split("@")[1] ?? "alert"}`,
          sourceItemId: `imap-${message.uid}`,
          title: parsed.subject ?? "Alerte marketplace",
          priceAmount: amount,
          priceCurrency: currency,
          productUrl: url,
          imageUrls: images,
          description: parsed.text?.slice(0, 4000),
          conditionGrade: "UNKNOWN",
          rawPayload: { sender, messageId: parsed.messageId }
        });
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return results;
  }
};
