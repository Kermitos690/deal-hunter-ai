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
import { candidateMatchesRadar, scoreMatchesRadar } from "@/lib/scans/radar-filters";
import type { AppUser, ProductCandidate, Radar } from "@/types";

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
      match_score: item.model && candidate.model && item.model === candidate.model ? 0.8 : 0.5,
      title: item.title,
      brand: item.brand,
      model: item.model,
      evidence_url: item.productUrl
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
    return { candidatesFound: 0, alertsCreated: 0, alertsSent: 0, telegramSkipped: 0, skipped: true, reason: "user_suspended" };
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
    return { candidatesFound: 0, alertsCreated: 0, alertsSent: 0, telegramSkipped: 0, skipped: true, reason: "radar_locked" };
  }
  await db.from("scan_logs").update({
    status: "error",
    finished_at: new Date().toISOString(),
    error_message: "Scan interrompu : verrou expiré puis repris."
  })
    .eq("radar_id", radar.id)
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - SCAN_LOCK_TTL_SECONDS * 1000).toISOString());

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
  let alertsCreated = 0;
  let alertsSent = 0;
  let telegramSkipped = 0;
  try {
    const enabledAdapters = adaptersFor(radar.sources);
    if (!enabledAdapters.length) {
      const now = new Date().toISOString();
      await db.from("scan_logs").update({
        status: "skipped",
        finished_at: now,
        error_message: `Scan ignoré : aucune source active parmi [${radar.sources.join(", ")}].`
      }).eq("id", log.id);
      return { candidatesFound: 0, alertsCreated: 0, alertsSent: 0, telegramSkipped: 0, skipped: true, reason: "no_enabled_source" };
    }
    const sourceResults = await Promise.all(enabledAdapters.map(async (adapter) => {
      const startedAt = new Date();
      try {
        const candidates = await adapter.scan(radar);
        return { source: adapter.name, candidates, error: null, startedAt, finishedAt: new Date() };
      } catch (error) {
        return {
          source: adapter.name,
          candidates: [] as ProductCandidate[],
          error: error instanceof Error ? error.message : "Erreur source",
          startedAt,
          finishedAt: new Date()
        };
      }
    }));
    await db.from("source_scan_logs").insert(sourceResults.map((result) => ({
      scan_log_id: log.id,
      radar_id: radar.id,
      user_id: user.id,
      source: result.source,
      status: result.error ? "error" : "success",
      candidates_found: result.candidates.length,
      duration_ms: result.finishedAt.getTime() - result.startedAt.getTime(),
      error_message: result.error,
      started_at: result.startedAt.toISOString(),
      finished_at: result.finishedAt.toISOString()
    })));
    const sourceErrors = sourceResults.flatMap((result) => result.error ? [result.error] : []);
    sourceErrors.forEach((message) => console.warn("Source ignorée pendant le scan:", message));
    const candidates = sourceResults.flatMap((result) => result.candidates);
    if (!candidates.length && sourceErrors.length > 0 && sourceErrors.length === sourceResults.length) {
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
    const komehyoComparables = convertedCandidates
      .filter((candidate) => candidate.source === "komehyo")
      .map((candidate) => ({
        source: "komehyo_active_listing",
        external_id: candidate.sourceItemId,
        title: candidate.title,
        brand: candidate.brand ?? null,
        model: candidate.model ?? null,
        category: candidate.category ?? radar.category,
        condition_grade: candidate.conditionGrade ?? "UNKNOWN",
        sold_price: candidate.priceAmount,
        currency: "CHF",
        sold_at: null,
        evidence_url: candidate.productUrl,
        country: "JP",
        evidence_type: "ACTIVE_LISTING",
        confidence: "LOW",
        match_score: candidate.model ? 0.7 : 0.5,
        fetched_at: new Date().toISOString(),
        raw_payload: candidate.rawPayload ?? {}
      }));
    if (komehyoComparables.length) {
      const { error: comparableError } = await db.from("market_comparables")
        .upsert(komehyoComparables, { onConflict: "source,external_id" });
      if (comparableError) {
        console.warn("Comparables KOMEHYO non enregistrés:", comparableError.message);
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
      if (!candidateMatchesRadar(candidate, radar) || remaining <= 0) continue;
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
        .select("sold_price,currency,source,sold_at,evidence_type,confidence,condition_grade,match_score,title,brand,model,evidence_url")
        .eq("category", candidate.category ?? radar.category);
      if (candidate.brand) comparableQuery = comparableQuery.eq("brand", candidate.brand);
      const { data: verifiedComparables } = await comparableQuery.limit(20);
      const market = estimateMarketValue(candidate, radar, [
        ...(verifiedComparables ?? []),
        ...comparableListings(candidate, convertedCandidates)
      ]);
      const score = calculateDealScore(candidate, radar, market);
      if (!scoreMatchesRadar(score, radar)) continue;

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
            maximum_offer: score.maximumOffer,
            break_even_resale_price: score.breakEvenResalePrice,
            recommended_channel: score.recommendedChannel,
            estimated_sale_days: score.estimatedSaleDays,
            action_plan: score.actionPlan,
            evidence_grade: score.evidenceGrade,
            decision_status: score.decisionStatus,
            decision_rationale: score.decisionRationale,
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
      await db.from("deal_score_comparables").delete().eq("deal_score_id", scoreRow.id);
      if (market.comparableDetails.length) {
        const { error: snapshotError } = await db.from("deal_score_comparables").insert(
          market.comparableDetails.map((comparable) => ({
            deal_score_id: scoreRow.id,
            user_id: user.id,
            source: comparable.source,
            evidence_type: comparable.evidenceType,
            title: comparable.title,
            price: comparable.price,
            currency: comparable.currency,
            sold_at: comparable.soldAt,
            condition_grade: comparable.conditionGrade,
            brand: comparable.brand,
            model: comparable.model,
            evidence_url: comparable.evidenceUrl,
            confidence: comparable.confidence ?? "LOW",
            match_score: comparable.matchScore,
            weight: comparable.weight
          }))
        );
        if (snapshotError) throw snapshotError;
      }
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

      alertsCreated += 1;
      remaining -= 1;

      let alertStatus = "created";
      let telegramMessageId: string | null = null;
      let sentAt: string | null = null;
      let stopAfterCurrentAlert = false;

      if (!user.telegram_id) {
        alertStatus = "telegram_missing_user";
        telegramSkipped += 1;
      } else if (!user.alerts_enabled) {
        alertStatus = "user_alerts_disabled";
        telegramSkipped += 1;
      } else if (!radar.alerts_enabled) {
        alertStatus = "radar_alerts_disabled";
        telegramSkipped += 1;
      } else {
        const { data: liveUser } = await db.from("users").select("status").eq("id", user.id).maybeSingle();
        if (!userCanRunActivity(liveUser?.status)) {
          alertStatus = "user_suspended";
          telegramSkipped += 1;
          stopAfterCurrentAlert = true;
          await db.from("scan_logs").update({
            error_message: "Scan arrêté avant alerte : utilisateur suspendu."
          }).eq("id", log.id);
        } else {
          const result = await sendDealAlert(user.telegram_id, alert.id, candidate, score);
          telegramMessageId = result.messageId;
          alertStatus = result.skipped ? result.reason : "sent";
          if (result.skipped) {
            telegramSkipped += 1;
          } else {
            alertsSent += 1;
            sentAt = new Date().toISOString();
          }
        }
      }

      await db
        .from("alerts")
        .update({
          telegram_message_id: telegramMessageId,
          status: alertStatus,
          sent_at: sentAt
        })
        .eq("id", alert.id)
        .eq("user_id", user.id);

      await db.from("user_seen_products").upsert({
        user_id: user.id,
        product_id: product.id
      });
      if (stopAfterCurrentAlert) break;
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
    return { candidatesFound, alertsCreated, alertsSent, telegramSkipped };
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
