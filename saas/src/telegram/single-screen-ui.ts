import { Context, Telegraf } from "telegraf";
import { serviceDb } from "@/lib/db/server";
import { formatDealAnalysisSection, type AnalysisSection } from "@/telegram/analysis-sections";

const PATCH_KEY = Symbol.for("deal-hunter.telegram.single-screen-ui.v1");
const STATE_MESSAGE_ID = "__dealHunterUiMessageId";
const STATE_IS_MEDIA = "__dealHunterUiIsMedia";
const STATE_KEEP_CAPTION = "__dealHunterKeepCaption";

type InlineButton = { text: string; callback_data?: string; url?: string };
type InlineKeyboard = { inline_keyboard: InlineButton[][] };

const navigationRows: InlineButton[][] = [
  [
    { text: "📥 Inbox", callback_data: "inbox" },
    { text: "📡 Radars", callback_data: "list_radars" },
    { text: "⭐ Deals", callback_data: "list_deals" }
  ]
];

function rowsContainCallback(rows: InlineButton[][], callbackData: string) {
  return rows.some((row) => row.some((button) => button.callback_data === callbackData));
}

function mergeNavigation(replyMarkup: any): InlineKeyboard {
  const rows: InlineButton[][] = Array.isArray(replyMarkup?.inline_keyboard)
    ? replyMarkup.inline_keyboard.map((row: InlineButton[]) => [...row])
    : [];
  const missing = navigationRows[0].filter((button) => !rowsContainCallback(rows, String(button.callback_data)));
  if (missing.length) rows.push(missing);
  return { inline_keyboard: rows };
}

function callbackData(ctx: any) {
  return String(ctx.callbackQuery?.data ?? "");
}

function messageHasMedia(message: any) {
  return Boolean(message && (
    Array.isArray(message.photo) || message.video || message.animation || message.document || message.audio
  ));
}

function uiTarget(ctx: any) {
  const callbackMessage = ctx.callbackQuery?.message;
  const chatId = callbackMessage?.chat?.id ?? ctx.chat?.id;
  const messageId = ctx.state?.[STATE_MESSAGE_ID] ?? callbackMessage?.message_id;
  const isMedia = ctx.state?.[STATE_IS_MEDIA] ?? messageHasMedia(callbackMessage);
  return chatId && messageId ? { chatId, messageId, isMedia } : null;
}

function notModified(error: unknown) {
  return /message is not modified/i.test(String((error as Error | null)?.message ?? error));
}

function analysisKeyboard(alertId: string, productUrl?: string, active: AnalysisSection = "summary"): InlineKeyboard {
  const mark = (section: AnalysisSection, label: string) => active === section ? `• ${label}` : label;
  const rows: InlineButton[][] = [
    [
      { text: mark("summary", "📊 Résumé"), callback_data: `analysisview:summary:${alertId}` },
      { text: mark("market", "📈 Marché"), callback_data: `analysisview:market:${alertId}` }
    ],
    [
      { text: mark("auth", "🛡 Authenticité"), callback_data: `analysisview:auth:${alertId}` },
      { text: mark("action", "🧭 Action"), callback_data: `analysisview:action:${alertId}` }
    ],
    [
      { text: "↩️ Fiche du deal", callback_data: `analysisview:deal:${alertId}` },
      ...(productUrl ? [{ text: "🔗 Ouvrir", url: productUrl }] : [])
    ]
  ];
  return mergeNavigation({ inline_keyboard: rows });
}

function dealActionKeyboard(alertId: string, productUrl?: string): InlineKeyboard {
  return mergeNavigation({
    inline_keyboard: [
      [
        { text: "❌ Jeter", callback_data: `reject:${alertId}` },
        { text: "❤️ Garder", callback_data: `save:${alertId}` }
      ],
      [
        { text: "📉 Négocier", callback_data: `negotiate:${alertId}` },
        { text: "📊 Analyse", callback_data: `analysis:${alertId}` }
      ],
      [
        { text: "➡️ Deal suivant", callback_data: "deal_next" },
        ...(productUrl ? [{ text: "🔗 Ouvrir", url: productUrl }] : [])
      ]
    ]
  });
}

function compactDeal(product: any, score: any) {
  const amount = (value: unknown) => `${Math.round(Number(value ?? 0))} CHF`;
  return [
    "⚡ DEAL À TRIER",
    "",
    `📦 ${String(product?.title ?? "Annonce").slice(0, 150)}`,
    `🌍 ${product?.source ?? "source"} • 💵 ${amount(product?.price_amount)}`,
    `⭐ Score : ${score?.total_score ?? "—"}/100`,
    `💰 Marge : ${amount(score?.estimated_net_profit)}`,
    score?.estimated_roi_percent != null ? `📊 ROI : ${Number(score.estimated_roi_percent).toFixed(1)} %` : null,
    "",
    "Choisis une action ci-dessous."
  ].filter(Boolean).join("\n");
}

async function editDirect(
  telegram: any,
  message: any,
  text: string,
  replyMarkup: InlineKeyboard
) {
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;
  if (!chatId || !messageId) return false;
  try {
    if (messageHasMedia(message) && text.length <= 1024) {
      await telegram.editMessageCaption(chatId, messageId, undefined, text, { reply_markup: replyMarkup });
    } else if (messageHasMedia(message)) {
      await telegram.deleteMessage(chatId, messageId).catch(() => undefined);
      await telegram.sendMessage(chatId, text.slice(0, 3900), {
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup
      });
    } else {
      await telegram.editMessageText(chatId, messageId, undefined, text.slice(0, 3900), {
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup
      });
    }
    return true;
  } catch (error) {
    if (notModified(error)) return true;
    throw error;
  }
}

async function loadAnalysis(telegramId: string, alertId: string) {
  const { data: user, error: userError } = await serviceDb()
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (userError) throw userError;
  if (!user) throw new Error("Compte Telegram introuvable.");

  const { data: alert, error: alertError } = await serviceDb()
    .from("alerts")
    .select("id,product_id,deal_score_id")
    .eq("id", alertId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (alertError) throw alertError;
  if (!alert) throw new Error("Alerte introuvable.");

  const [{ data: product, error: productError }, { data: score, error: scoreError }, { data: comparables, error: comparableError }] = await Promise.all([
    serviceDb().from("products").select("*").eq("id", alert.product_id).maybeSingle(),
    serviceDb().from("deal_scores").select("*").eq("id", alert.deal_score_id).maybeSingle(),
    serviceDb()
      .from("deal_score_comparables")
      .select("source,evidence_type,title,price,currency,sold_at,evidence_url,confidence,match_score,model")
      .eq("deal_score_id", alert.deal_score_id)
      .order("weight", { ascending: false })
      .limit(12)
  ]);
  if (productError) throw productError;
  if (scoreError) throw scoreError;
  if (comparableError) throw comparableError;
  if (!product || !score) throw new Error("Analyse indisponible.");
  return { product, score, comparables: comparables ?? [] };
}

async function handleAnalysisCallback(bot: any, callback: any, section: AnalysisSection | "deal", alertId: string) {
  const telegram = bot.telegram;
  await telegram.answerCbQuery(callback.id, section === "deal" ? "Fiche du deal" : "Analyse mise à jour").catch(() => undefined);
  try {
    const { product, score, comparables } = await loadAnalysis(String(callback.from.id), alertId);
    const text = section === "deal"
      ? compactDeal(product, score)
      : formatDealAnalysisSection(product, score, comparables, section);
    const keyboard = section === "deal"
      ? dealActionKeyboard(alertId, product.product_url)
      : analysisKeyboard(alertId, product.product_url, section);
    await editDirect(telegram, callback.message, text, keyboard);
  } catch (error) {
    const message = `⚠️ Analyse indisponible\n\n${String((error as Error | null)?.message ?? "Erreur inconnue").slice(0, 180)}`;
    await editDirect(telegram, callback.message, message, mergeNavigation({ inline_keyboard: [] })).catch(() => undefined);
  }
}

export function installTelegramSingleScreenUi() {
  if ((globalThis as any)[PATCH_KEY]) return;
  (globalThis as any)[PATCH_KEY] = true;

  const prototype = Context.prototype as any;
  const originalReply = prototype.reply;
  const originalReplyWithPhoto = prototype.replyWithPhoto;
  const originalReplyWithMediaGroup = prototype.replyWithMediaGroup;

  prototype.reply = async function patchedReply(text: string, extra: any = {}) {
    const state = this.state ?? (this.state = {});
    const analysisMatch = /^analysis:([a-z0-9-]+)$/i.exec(callbackData(this));
    const replyMarkup = analysisMatch
      ? analysisKeyboard(analysisMatch[1], undefined, "summary")
      : mergeNavigation(extra.reply_markup);
    const prepared = { ...extra, reply_markup: replyMarkup };
    const target = uiTarget(this);

    if (state[STATE_KEEP_CAPTION] && /^Actions rapides pour ce deal/i.test(text) && target) {
      state[STATE_KEEP_CAPTION] = false;
      try {
        return await this.telegram.editMessageReplyMarkup(target.chatId, target.messageId, undefined, replyMarkup);
      } catch (error) {
        if (notModified(error)) return true;
      }
    }

    if (this.callbackQuery && target) {
      try {
        if (target.isMedia && text.length <= 1024) {
          const result = await this.telegram.editMessageCaption(target.chatId, target.messageId, undefined, text, {
            reply_markup: replyMarkup
          });
          state[STATE_MESSAGE_ID] = target.messageId;
          state[STATE_IS_MEDIA] = true;
          return result;
        }
        if (target.isMedia) {
          await this.telegram.deleteMessage(target.chatId, target.messageId).catch(() => undefined);
        } else {
          const result = await this.telegram.editMessageText(target.chatId, target.messageId, undefined, text.slice(0, 3900), {
            ...prepared,
            link_preview_options: { is_disabled: true }
          });
          state[STATE_MESSAGE_ID] = target.messageId;
          state[STATE_IS_MEDIA] = false;
          return result;
        }
      } catch (error) {
        if (notModified(error)) return true;
      }
    }

    const sent = await originalReply.call(this, text.slice(0, 3900), prepared);
    if (sent?.message_id) {
      state[STATE_MESSAGE_ID] = sent.message_id;
      state[STATE_IS_MEDIA] = false;
    }
    return sent;
  };

  prototype.replyWithPhoto = async function patchedReplyWithPhoto(photo: any, extra: any = {}) {
    const state = this.state ?? (this.state = {});
    const prepared = { ...extra, reply_markup: mergeNavigation(extra.reply_markup) };
    const target = uiTarget(this);
    if (this.callbackQuery && target) {
      try {
        if (target.isMedia) {
          const media: any = { type: "photo", media: photo };
          if (prepared.caption) media.caption = String(prepared.caption).slice(0, 1024);
          if (prepared.parse_mode) media.parse_mode = prepared.parse_mode;
          const edited = await this.telegram.editMessageMedia(target.chatId, target.messageId, undefined, media, {
            reply_markup: prepared.reply_markup
          });
          state[STATE_MESSAGE_ID] = target.messageId;
          state[STATE_IS_MEDIA] = true;
          return edited;
        }
        await this.telegram.deleteMessage(target.chatId, target.messageId).catch(() => undefined);
      } catch (error) {
        if (notModified(error)) return true;
      }
    }
    const sent = await originalReplyWithPhoto.call(this, photo, prepared);
    if (sent?.message_id) {
      state[STATE_MESSAGE_ID] = sent.message_id;
      state[STATE_IS_MEDIA] = true;
    }
    return sent;
  };

  prototype.replyWithMediaGroup = async function patchedReplyWithMediaGroup(media: any[], extra: any = {}) {
    const firstPhoto = Array.isArray(media) ? media.find((item) => item?.type === "photo") : null;
    if (!firstPhoto) return originalReplyWithMediaGroup.call(this, media, extra);
    const sent = await this.replyWithPhoto(firstPhoto.media, {
      ...extra,
      caption: firstPhoto.caption
    });
    const state = this.state ?? (this.state = {});
    state[STATE_KEEP_CAPTION] = true;
    return [sent];
  };

  const telegrafPrototype = Telegraf.prototype as any;
  const originalHandleUpdate = telegrafPrototype.handleUpdate;
  telegrafPrototype.handleUpdate = async function patchedHandleUpdate(update: any, webhookResponse: any) {
    const callback = update?.callback_query;
    const match = /^analysisview:(summary|market|auth|action|deal):([a-z0-9-]+)$/i.exec(String(callback?.data ?? ""));
    if (callback && match) {
      await handleAnalysisCallback(this, callback, match[1] as AnalysisSection | "deal", match[2]);
      return;
    }
    return originalHandleUpdate.call(this, update, webhookResponse);
  };
}
