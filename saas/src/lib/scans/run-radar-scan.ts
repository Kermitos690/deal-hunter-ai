import { serviceDb } from "@/lib/db/server";
import { adaptersFor } from "@/sources";
import { normalizeUrl, productFingerprint } from "@/lib/dedupe";
import { estimateMarketValue } from "@/market/market-estimator";
import { calculateDealScore } from "@/scoring/calculate-deal-score";
import { sendDealAlert, sendScanDigest } from "@/telegram/send-alert";
import { sendWhatsAppText } from "@/whatsapp/client";
import { PLAN_LIMITS } from "@/plans/limits";
import { candidateInChf } from "@/lib/fx";
import { randomUUID } from "node:crypto";
import { SCAN_LOCK_TTL_SECONDS, userCanRunActivity } from "@/lib/scans/scan-policy";
import { candidateMismatchReasons, scoreMismatchReasons } from "@/lib/scans/radar-filters";
import type { AppUser, ProductCandidate, Radar } from "@/types";

type RejectionSummary = Record<string, number>;
type RadarScanOptions = {
  sourceNames?: string[];
  updateRadarSchedule?: boolean;
};
type SourceScanResult = {
  source: string;
  candidates: ProductCandidate[];
  error: string | null;
  startedAt: Date;
  finishedAt: Date;
};

export const LOCAL_LIVE_SOURCE_NAMES = ["ricardo", "anibis", "tutti"] as const;

function countRejections(summary: RejectionSummary, reasons: string[]) {
  for (const reason of reasons) summary[reason] = (summary[reason] ?? 0) + 1;
}

export function localLiveSourcesForRadar(sources: string[]) {
  return LOCAL_LIVE_SOURCE_NAMES.filter((source) => sources.includes(source));
}

export function shouldFallbackToEbay(requestedSources: string[], sourceResults: Pick<SourceScanResult, "candidates" | "error">[]) {
  return !requestedSources.includes("ebay")
    && sourceResults.length > 0
    && sourceResults.every((result) => result.error && result.candidates.length === 0);
}

async function scanAdapters(radar: Radar, sourceNames: string[]) {
  const enabledAdapters = adaptersFor(sourceNames);
  const results: SourceScanResult[] = await Promise.all(enabledAdapters.map(async (adapter) => {
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
  return { enabledAdapters, results };
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
      match_score: item.model && candidate.model && item.model === candidate.model ? 0.8 : 0.5,
      title: item.title,
      brand: item.brand,
      model: item.model,
      evidence_url: item.productUrl
    }));
}

function whatsappDealText(candidate: ProductCandidate, score: ReturnType<typeof calculateDealScore>) {
  return [
    "🚨 Deal Hunter AI — opportunité détectée",
    "",
    `${candidate.title}`,
    `Source : ${candidate.source}`,
    `Prix : ${candidate.priceAmount.toFixed(0)} ${candidate.priceCurrency}`,
    `Score : ${score.totalScore}/100`,
    `Décision : ${score.decisionStatus ?? score.recommendation}`,
    `Bénéfice estimé : ${score.estimatedNetProfit.toFixed(0)} CHF`,
    `ROI estimé : ${score.estimatedRoiPercent.toFixed(1)} %`,
    `Confiance marché : ${score.marketConfidence} (${score.comparableCount} comparables)`,
    "",
    `Plan : ${score.actionPlan ?? "Vérifier avant achat et ne pas dépasser l’offre maximum."}`,
    "",
    candidate.productUrl
  ].join("\n");
}

function telegramDeliveryMode() {
  const value = process.env.TELEGRAM_ALERT_DELIVERY_MODE?.trim().toLowerCase();
  return value === "individual" ? "individual" : "digest";
}

function immediateTelegramAlertLimit() {
  const value = Number(process.env.TELEGRAM_MAX_IMMEDIATE_ALERTS_PER_SCAN ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
}

function titleKey(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sameRejectedSignature(product: any, rejectedProduct: any) {
  if (!rejectedProduct) return false;
  if (product.normalized_url && rejectedProduct.normalized_url && product.normalized_url === rejectedProduct.normalized_url) return true;
  if (product.content_fingerprint && rejectedProduct.content_fingerprint && product.content_fingerprint === rejectedProduct.content_fingerprint) return true;
  const sameSeller = product.seller_name && rejectedProduct.seller_name && titleKey(product.seller_name) === titleKey(rejectedProduct.seller_name);
  const samePrice = Math.abs(Number(product.price_amount ?? 0) - Number(rejectedProduct.price_amount ?? 0)) < 1;
  const sameTitle = titleKey(product.title ?? "") === titleKey(rejectedProduct.title ?? "");
  return Boolean(sameSeller && samePrice && sameTitle);
}

async function userHasRejectedDuplicate(userId: string, product: any) {
  const { data } = await serviceDb()
    .from("rejected_products")
    .select("product_id,products(id,normalized_url,content_fingerprint,title,seller_name,price_amount)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).some((row: any) => {
    const rejected = Array.isArray(row.products) ? row.products[0] : row.products;
    return sameRejectedSignature(product, rejected);
  });
}

async function userHasSeenDuplicate(userId: string, product: any) {
  const { data } = await serviceDb()
    .from("user_seen_products")
    .select("product_id,products(id,normalized_url,content_fingerprint,title,seller_name,price_amount)")
    .eq("user_id", userId)
    .order("first_seen_at", { ascending: false })
    .limit(500);
  return (data ?? []).some((row: any) => {
    const seen = Array.isArray(row.products) ? row.products[0] : row.products;
    return sameRejectedSignature(product, seen);
  });
}

export async function runRadarScan(radarId: string, ownerId?: string, options: RadarScanOptions = {}) {
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
    return { candidatesFound: 0, alertsCreated: 0, alertsSent: 0, telegramSkipped: 0, rejectionSummary: {}, skipped: true, reason: "user_suspended" };
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
    return { candidatesFound: 0, alertsCreated: 0, alertsSent: 0, telegramSkipped: 0, rejectionSummary: {}, skipped: true, reason: "radar_locked" };
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
  let digestSent = false;
  const rejectionSummary: RejectionSummary = {};
  let createdAlertsForDigest = 0;
  try {
    const requestedSources = options.sourceNames ?? radar.sources;
    const { enabledAdapters, results: initialSourceResults } = await scanAdapters(radar, requestedSources);
    if (!enabledAdapters.length) {
      const now = new Date().toISOString();
      await db.from("scan_logs").update({
        status: "skipped",
        finished_at: now,
        error_message: `Scan ignoré : aucune source active parmi [${requestedSources.join(", ")}].`
      }).eq("id", log.id);
      return { candidatesFound: 0, alertsCreated: 0, alertsSent: 0, telegramSkipped: 0, rejectionSummary, skipped: true, reason: "no_enabled_source" };
    }
    let sourceResults = initialSourceResults;
    if (shouldFallbackToEbay(requestedSources, sourceResults)) {
      console.warn("Toutes les sources demandées ont échoué, fallback eBay automatique.");
      const fallback = await scanAdapters(radar, ["ebay"]);
      sourceResults = [...sourceResults, ...fallback.results.map((result) => ({
        ...result,
        source: result.source === "ebay" ? "ebay_fallback" : result.source
      }))];
    }
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
    const sourceErrors = sourceResults.flatMap((result) => result.error ? [`${result.source}: ${result.error}`] : []);
    sourceErrors.forEach((message) => console.warn("Source ignorée pendant le scan:", message));
    const candidates = sourceResults.flatMap((result) => result.candidates);
    if (!candidates.length && sourceErrors.length > 0 && sourceErrors.length === sourceResults.length) {
      const now = new Date();
      const next = new Date(now.getTime() + radar.scan_frequency_minutes * 60_000);
      const message = `Toutes les sources ont échoué: ${sourceErrors.join("; ")}`;
      await Promise.all([
        options.updateRadarSchedule === false
          ? Promise.resolve()
          : db.from("radars").update({ last_scanned_at: now.toISOString(), next_scan_at: next.toISOString() }).eq("id", radar.id).eq("user_id", user.id),
        db.from("scan_logs").update({
          status: "error",
          finished_at: now.toISOString(),
          candidates_found: 0,
          alerts_sent: 0,
          error_message: message
        }).eq("id", log.id)
      ]);
      return {
        candidatesFound: 0,
        alertsCreated: 0,
        alertsSent: 0,
        telegramSkipped: 0,
        rejectionSummary,
        skipped: true,
        reason: "all_sources_failed",
        sourceErrors
      };
    }
    candidatesFound = candidates.length;
    const convertedCandidates: ProductCandidate[] = [];
    for (const candidate of candidates) {
      try {
        convertedCandidates.push(await candidateInChf(candidate));
      } catch (fxError) {
        countRejections(rejectionSummary, ["currency_conversion_failed"]);
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
      if (remaining <= 0) {
        countRejections(rejectionSummary, ["daily_alert_limit_reached"]);
        continue;
      }
      const candidateReasons = candidateMismatchReasons(candidate, radar);
      if (candidateReasons.length) {
        countRejections(rejectionSummary, candidateReasons);
        continue;
      }
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
      const [seenDuplicate, rejectedDuplicate] = await Promise.all([
        seen ? Promise.resolve(false) : userHasSeenDuplicate(user.id, product),
        rejected ? Promise.resolve(false) : userHasRejectedDuplicate(user.id, product)
      ]);
      if (seen || seenDuplicate) {
        countRejections(rejectionSummary, ["already_seen"]);
        continue;
      }
      if (rejected || rejectedDuplicate) {
        countRejections(rejectionSummary, ["rejected_by_user"]);
        continue;
      }

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
      const scoreReasons = scoreMismatchReasons(score, radar);
      if (scoreReasons.length) {
        countRejections(rejectionSummary, scoreReasons);
        continue;
      }

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
      createdAlertsForDigest += 1;

      let alertStatus = "created";
      let telegramMessageId: string | null = null;
      let sentAt: string | null = null;
      let whatsappMessageId: string | null = null;
      let whatsappSentAt: string | null = null;
      let whatsappStatus: string | null = null;
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
      } else if (telegramDeliveryMode() === "digest" && alertsCreated > immediateTelegramAlertLimit()) {
        alertStatus = "inbox";
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

      if (user.whatsapp_phone && user.whatsapp_alerts_enabled && radar.alerts_enabled) {
        try {
          const whatsappResult = await sendWhatsAppText(user.whatsapp_phone, whatsappDealText(candidate, score));
          if (whatsappResult.skipped) {
            whatsappStatus = whatsappResult.reason;
          } else {
            whatsappMessageId = whatsappResult.messageId;
            whatsappStatus = "sent";
            whatsappSentAt = new Date().toISOString();
          }
        } catch (whatsappError) {
          whatsappStatus = "api_error";
          console.error("Échec envoi alerte WhatsApp:", whatsappError instanceof Error ? whatsappError.message : "Erreur inconnue");
        }
      } else if (user.whatsapp_phone && !user.whatsapp_alerts_enabled) {
        whatsappStatus = "user_whatsapp_disabled";
      }

      await db
        .from("alerts")
        .update({
          telegram_message_id: telegramMessageId,
          whatsapp_message_id: whatsappMessageId,
          whatsapp_sent_at: whatsappSentAt,
          whatsapp_status: whatsappStatus,
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

    if (
      telegramDeliveryMode() === "digest" &&
      createdAlertsForDigest > 0 &&
      user.telegram_id &&
      user.alerts_enabled &&
      radar.alerts_enabled &&
      userCanRunActivity(user.status)
    ) {
      try {
        const digest = await sendScanDigest(user.telegram_id, radar, {
          candidatesFound,
          alertsCreated,
          alertsSent,
          telegramSkipped
        });
        if (digest.skipped) {
          telegramSkipped += 1;
        } else {
          alertsSent += 1;
          digestSent = true;
        }
      } catch (digestError) {
        telegramSkipped += 1;
        console.error("Échec envoi digest Telegram:", digestError instanceof Error ? digestError.message : "Erreur inconnue");
      }
    }

    const now = new Date();
    const next = new Date(now.getTime() + radar.scan_frequency_minutes * 60_000);
    await Promise.all([
      options.updateRadarSchedule === false
        ? Promise.resolve()
        : db.from("radars").update({ last_scanned_at: now.toISOString(), next_scan_at: next.toISOString() }).eq("id", radar.id).eq("user_id", user.id),
      db.from("scan_logs").update({
        status: "success",
        finished_at: now.toISOString(),
        candidates_found: candidatesFound,
        alerts_sent: alertsSent,
        error_message: Object.keys(rejectionSummary).length ? JSON.stringify({ rejectionSummary, digestSent }) : null
      }).eq("id", log.id)
    ]);
    return { candidatesFound, alertsCreated, alertsSent, telegramSkipped, rejectionSummary, sourceErrors, digestSent };
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

export async function runDueEmailAlertScans() {
  if (process.env.ENABLE_EMAIL_ALERTS_SOURCE !== "true") return [];
  const limit = Math.min(Math.max(Number(process.env.EMAIL_ALERT_SCAN_LIMIT ?? 10), 1), 50);
  const { data, error } = await serviceDb()
    .from("radars")
    .select("id,user_id,users!inner(status)")
    .eq("is_active", true)
    .eq("users.status", "active")
    .contains("sources", ["email-alerts"])
    .limit(limit);
  if (error) throw error;
  return Promise.all((data ?? []).map(async (radar) => {
    try {
      return {
        id: radar.id,
        ok: true,
        ...(await runRadarScan(radar.id, radar.user_id, {
          sourceNames: ["email-alerts"],
          updateRadarSchedule: false
        }))
      };
    } catch (error) {
      return { id: radar.id, ok: false, error: error instanceof Error ? error.message : "Erreur" };
    }
  }));
}

export async function runLocalLiveSourceScans() {
  const limit = Math.min(Math.max(Number(process.env.LOCAL_LIVE_SCAN_LIMIT ?? 20), 1), 100);
  const delayMs = Math.min(Math.max(Number(process.env.LOCAL_LIVE_SCAN_DELAY_MS ?? 2000), 0), 30_000);
  const { data, error } = await serviceDb()
    .from("radars")
    .select("id,user_id,sources,users!inner(status)")
    .eq("is_active", true)
    .eq("users.status", "active")
    .limit(limit);
  if (error) throw error;

  const results = [];
  for (const radar of data ?? []) {
    const sourceNames = localLiveSourcesForRadar((radar.sources ?? []) as string[]);
    if (!sourceNames.length) {
      results.push({ id: radar.id, ok: true, skipped: true, reason: "no_local_live_source" });
      continue;
    }
    const sourceResults = [];
    for (const sourceName of sourceNames) {
      try {
        sourceResults.push({
          source: sourceName,
          ok: true,
          ...(await runRadarScan(radar.id, radar.user_id, {
            sourceNames: [sourceName],
            updateRadarSchedule: false
          }))
        });
      } catch (error) {
        sourceResults.push({ source: sourceName, ok: false, error: error instanceof Error ? error.message : "Erreur" });
      }
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    results.push({
      id: radar.id,
      ok: sourceResults.every((result) => result.ok),
      localLiveSources: sourceNames,
      sourceResults,
      candidatesFound: sourceResults.reduce((sum, result) => sum + ("candidatesFound" in result && typeof result.candidatesFound === "number" ? result.candidatesFound : 0), 0),
      alertsCreated: sourceResults.reduce((sum, result) => sum + ("alertsCreated" in result && typeof result.alertsCreated === "number" ? result.alertsCreated : 0), 0),
      alertsSent: sourceResults.reduce((sum, result) => sum + ("alertsSent" in result && typeof result.alertsSent === "number" ? result.alertsSent : 0), 0)
    });
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return results;
}
