import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { apiUser, jsonError } from "@/lib/api";
import { manualToCandidate } from "@/sources/manualImport.adapter";

export async function POST(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const text = await request.text();
  try {
    const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    const candidates = rows.slice(0, 500).map((row: Record<string, string>) =>
      manualToCandidate({
        title: row.title, price: row.price, currency: row.currency,
        url: row.url, source: row.source || "manual-csv",
        imageUrls: row.image_url ? [row.image_url] : [],
        condition: row.condition || "UNKNOWN", description: row.description,
        auctionEndAt: row.auction_end_at || undefined
      })
    );
    return NextResponse.json({ imported: candidates.length, candidates });
  } catch (error) {
    return jsonError("CSV invalide.", 422, error instanceof Error ? error.message : error);
  }
}
