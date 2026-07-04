import { serviceDb } from "@/lib/db/server";
import { adaptersFor } from "@/sources";
import { normalizeUrl, productFingerprint } from "@/lib/dedupe";
import { estimateMarketValue } from "@/market/market-estimator";
import { calculateDealScore } from "@/scoring/calculate-deal-score";
import { sendDealAlert } from "@/telegram/send-alert";
import { PLAN_LIMITS } from "@/plans/limits";
import { candidateInChf } from "@/lib/fx";
import { randomUUID } from "node:crypto";
import { SCAN_LOCK_TTL_SECONDS, userCanRunActivity } from "@/lib/scans/scan-policy";
import type { AppUser, ProductCandidate, Radar } from "@/types";

function candidateAllowed(candidate: ProductCandidate, radar: Radar) {
  if (candidate.priceAmount > radar.max_buy_price) return false;
  if (radar.photos_required && candidate.imageUrls.length === 0) return false;
  if (!radar.accepted_conditions.includes(candidate.conditionGrade ?? "UNKNOWN")) return false;
  return true;
}

function comparableListings(candidate: ProductCandidate, candidates: ProductCandidate[]) {
  const brand = candidate.brand?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return candidates
    .filter((item) => item.sourceItemId !== candidate.sourceItemId)
    .filter((item) => {
      const itemBrand = item.brand?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      return brand ? itemBrand === brand : item.category === candidate.category;
    })
    .filter((item) =>
      item.priceAmount >= candidate.priceAmount * 0.25 &&
      item.priceAmount <= candidate.priceAmount * 4
    )
    .sort((a, b) =>
      Math.abs(a.priceAmount - candidate.priceAmount) -
      Math.abs(b.priceAmount - candidate.priceAmount)
    )
    .slice(0, 40)
    .map((item) => ({
      sold_price: item.priceAmount,
      currency: item.priceCurrency,
      source: `${item.source}_active_listing`,
      evidence_type: "ACTIVE_LISTING" as const,
      confidence: "LOW" as const,
      match_score: item.model && candidate.model && item.model === candidate.model ? 0.8 : 0.5
    }));
}

export async function runRadarScan(radarId: string, ownerId?: string) {
  const db = serviceDb();
  let query = db.from("radars").select("*, users(*)").eq("id", radarId);
  if (ownerId) query = query.eq("user_id", ownerId);
  const { data: row, error } = await query.maybeSingle();
  if (error || !row) throw new Error("Radar introuvable ou accès refusé.");
  const radar = row as unknown as Radar & { users: AppUser };
  const user = radar.users;
  if (!radar.is_active) throw new Error("Radar en pause.");
  if (!userCanRunActivity(user.status)) {
    await db.from("scan_logs").insert({
      radar_id: radar.id,
      user_id: radar.user_id,
      status: "skipped",
      finished_at: new Date().toISOString(),
      error_message: "Scan ignoré : utilisateur suspendu."
    });
    return { candidatesFound: 0, alertsSent: 0, skipped: true, reason: "user_suspended" };
  }

  const lockToken = randomUUID();
  const { data: lockAcquired, error: lockError } = await db.rpc("acquire_radar_scan_lock", {
    p_radar_id: radar.id,
    p_lock_token: lockToken,
    p_ttl_seconds: SCAN_LOCK_TTL_SECONDS
  });
  if (lockError) throw new Error(`Verrou de scan indisponible: ${lockError.message}`);
  if (!lockAcquired) {
    await db.from("scan_logs").insert({
      radar_id: radar.id,
      user_id: radar.user_id,
      status: "skipped",
      finished_at: new Date().toISOString(),
      error_message: "Scan ignoré : radar déjà verrouillé."
    });
    return { candidatesFound: 0, alertsSent: 0, skipped: true, reason: "radar_locked" };
  }

  const { data: log, error: logError } = await db
    .from("scan_logs")
    .insert({ radar_id: radar.id, user_id: radar.user_id, status: "running" })
    .select("*")
    .single();
  if (logError) {
    await db.rpc("release_radar_scan_lock", { p_radar_id: radar.id, p_lock_token: lockToken });
    throw logError;
  }

  let candidatesFound = 0;
  let alertsSent = 0;
  try {
    const sourceResults = await Promise.allSettled(
      adaptersFor(radar.sources).map(async (adapter) => ({
        source: adapter.name,
        candidates: await adapter.scan(radar)
      }))
    );
    const sourceErrors = sourceResults
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : "Erreur source");
    sourceErrors.forEach((message) => console.warn("Source ignorée pendant le scan:", message));
    const candidates = sourceResults
      .filter((result): result is PromiseFulfilledResult<{ source: string; candidates: ProductCandidate[] }> =>
        result.status === "fulfilled"
      )
      .flatMap((result) => result.value.candidates);
    if (!candidates.length && sourceErrors.length === sourceResults.length) {
      throw new Error(`Toutes les sources ont échoué: ${sourceErrors.join("; ")}`);
    }
    candidatesFound = candidates.length;
    const convertedCandidates: ProductCandidate[] = [];
    for (const candidate of candidates) {
      try {
        convertedCandidates.push(await candidateInChf(candidate));
      } catch (fxError) {
        console.warn("Candidate ignoré, conversion CHF impossible:", fxError);
      }
    }
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count: alertsToday } = await db
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    let remaining = Math.max(0, PLAN_LIMITS[user.plan].alertsPerDay - (alertsToday ?? 0));

    for (const candidate of convertedCandidates) {
      if (!candidateAllowed(candidate, radar) || remaining <= 0) continue;
      const normalizedUrl = normalizeUrl(candidate.productUrl);
      const fingerprint = productFingerprint(candidate);
      const { data: product, error: productError } = await db
        .from("products")
        .upsert(
          {
            source: candidate.source,
            source_item_id: candidate.sourceItemId,
            title: candidate.title,
            brand: candidate.brand,
            model: candidate.model,
            category: candidate.category,
            price_amount: candidate.priceAmount,
            price_currency: candidate.priceCurrency,
            buy_now_price: candidate.buyNowPrice,
            current_bid_price: candidate.currentBidPrice,
            shipping_cost: candidate.shippingCost ?? 0,
            condition_text: candidate.conditionText,
            condition_grade: candidate.conditionGrade ?? "UNKNOWN",
            seller_name: candidate.sellerName,
            seller_rating: candidate.sellerRating,
            seller_country: candidate.sellerCountry,
            item_country: candidate.itemCountry,
            product_url: candidate.productUrl,
            normalized_url: normalizedUrl,
            description: candidate.description,
            auction_end_at: candidate.auctionEndAt,
            raw_payload: candidate.rawPayload ?? {},
            content_fingerprint: fingerprint
          },
          { onConflict: "source,source_item_id" }
        )
        .select("*")
        .single();
      if (productError) throw productError;

      if (candidate.imageUrls.length) {
        await db.from("product_images").upsert(
          candidate.imageUrls.map((imageUrl, position) => ({
            product_id: product.id,
            image_url: imageUrl,
            position
          })),
          { onConflict: "product_id,image_url" }
        );
      }

      const [{ data: seen }, { data: rejected }] = await Promise.all([
        db.from("user_seen_products").select("id").eq("user_id", user.id).eq("product_id", product.id).maybeSingle(),
        db.from("rejected_products").select("id").eq("user_id", user.id).eq("product_id", product.id).maybeSingle()
      ]);
      if (seen || rejected) continue;

      let comparableQuery = db
        .from("market_comparables")
        .select("sold_price,currency,source,sold_at,evidence_type,confidence,condition_grade,match_score")
        .eq("category", candidate.category ?? radar.category);
      if (candidate.brand) comparableQuery = comparableQuery.eq("brand", candidate.brand);
      const { data: verifiedComparables } = await comparableQuery.limit(20);
      const market = estimateMarketValue(candidate, radar, [
        ...(verifiedComparables ?? []),
        ...comparableListings(candidate, convertedCandidates)
      ]);
      const score = calculateDealScore(candidate, radar, market);
      if (
        score.totalScore < radar.min_score ||
        score.estimatedNetProfit < Math.max(0, radar.min_profit) ||
        score.estimatedNetProfit < 0
      ) continue;

      const { data: scoreRow, error: scoreError } = await db
        .from("deal_scores")
        .upsert(
          {
            product_id: product.id,
            radar_id: radar.id,
            user_id: user.id,
            total_score: score.totalScore,
            margin_score: score.marginScore,
            liquidity_score: score.liquidityScore,
            risk_score: score.riskScore,
            condition_score: score.conditionScore,
            urgency_score: score.urgencyScore,
            estimated_buy_cost: score.estimatedBuyCost,
            estimated_resale_price: score.estimatedResalePrice,
            estimated_net_profit: score.estimatedNetProfit,
            estimated_roi_percent: score.estimatedRoiPercent,
            recommendation: score.recommendation,
            scoring_version: score.scoringVersion,
            market_confidence: score.marketConfidence,
            comparable_count: score.comparableCount,
            reasons: score.reasons,
            warnings: score.warnings
          },
          { onConflict: "product_id,radar_id" }
        )
        .select("*")
        .single();
      if (scoreError) throw scoreError;
      const { data: alert, error: alertError } = await db
        .from("alerts")
        .upsert(
          {
            user_id: user.id,
            radar_id: radar.id,
            product_id: product.id,
            deal_score_id: scoreRow.id,
            status: "created"
          },
          { onConflict: "user_id,radar_id,product_id" }
        )
        .select("*")
        .single();
      if (alertError) throw alertError;

      if (user.telegram_id && user.alerts_enabled && radar.alerts_enabled) {
        const { data: liveUser } = await db.from("users").select("status").eq("id", user.id).maybeSingle();
        if (!userCanRunActivity(liveUser?.status)) {
          await db.from("scan_logs").update({
            error_message: "Scan arrêté avant alerte : utilisateur suspendu."
          }).eq("id", log.id);
          break;
        }
        const result = await sendDealAlert(user.telegram_id, alert.id, candidate, score);
        await db
          .from("alerts")
          .update({
            telegram_message_id: result.messageId,
            status: result.skipped ? "telegram_not_configured" : "sent",
            sent_at: new Date().toISOString()
          })
          .eq("id", alert.id)
          .eq("user_id", user.id);
      }
      await db.from("user_seen_products").upsert({
        user_id: user.id,
        product_id: product.id
      });
      alertsSent += 1;
      remaining -= 1;
    }

    const now = new Date();
    const next = new Date(now.getTime() + radar.scan_frequency_minutes * 60_000);
    await Promise.all([
      db.from("radars").update({ last_scanned_at: now.toISOString(), next_scan_at: next.toISOString() }).eq("id", radar.id).eq("user_id", user.id),
      db.from("scan_logs").update({
        status: "success",
        finished_at: now.toISOString(),
        candidates_found: candidatesFound,
        alerts_sent: alertsSent
      }).eq("id", log.id)
    ]);
    return { candidatesFound, alertsSent };
  } catch (scanError) {
    await db.from("scan_logs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      candidates_found: candidatesFound,
      alerts_sent: alertsSent,
      error_message: scanError instanceof Error ? scanError.message : "Erreur inconnue"
    }).eq("id", log.id);
    throw scanError;
  } finally {
    const { error: releaseError } = await db.rpc("release_radar_scan_lock", {
      p_radar_id: radar.id,
      p_lock_token: lockToken
    });
    if (releaseError) console.error("Impossible de libérer le verrou radar:", releaseError.message);
  }
}

export async function runDueScans() {
  const { data, error } = await serviceDb()
    .from("radars")
    .select("id,user_id,users!inner(status)")
    .eq("is_active", true)
    .eq("users.status", "active")
    .lte("next_scan_at", new Date().toISOString())
    .order("next_scan_at", { ascending: true })
    .limit(5);
  if (error) throw error;
  return Promise.all((data ?? []).map(async (radar) => {
    try {
      return { id: radar.id, ok: true, ...(await runRadarScan(radar.id, radar.user_id)) };
    } catch (error) {
      return { id: radar.id, ok: false, error: error instanceof Error ? error.message : "Erreur" };
    }
  }));
}
