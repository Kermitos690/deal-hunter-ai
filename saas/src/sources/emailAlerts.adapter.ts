import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { ProductCandidate, SourceAdapter } from "@/types";
import { parseEmailAlertToCandidate } from "@/sources/email-alert-parser";

function emailLookbackHours() {
  const value = Number(process.env.EMAIL_LOOKBACK_HOURS ?? 48);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 24 * 14) : 48;
}

function emailMaxMessages() {
  const value = Number(process.env.EMAIL_MAX_MESSAGES ?? 100);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 500) : 100;
}

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
    const mailbox = process.env.EMAIL_MAILBOX || "INBOX";
    const lock = await client.getMailboxLock(mailbox);
    try {
      const since = new Date(Date.now() - emailLookbackHours() * 3_600_000);
      const searchResult = await client.search({ since });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      for await (const message of client.fetch(uids.slice(-emailMaxMessages()), { source: true, envelope: true, uid: true })) {
        const sender = message.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        if (!message.source) continue;
        const parsed = await (simpleParser(message.source) as Promise<ParsedMail>);
        const candidate = parseEmailAlertToCandidate(parsed, radar, { uid: message.uid, sender });
        if (candidate) results.push(candidate);
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return results;
  }
};
