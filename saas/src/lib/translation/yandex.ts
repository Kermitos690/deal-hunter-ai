import { normalizeTelegramLanguage, type TelegramLanguage } from "@/telegram/i18n";

type YandexTranslateResponse = {
  translations?: Array<{ text?: string; detectedLanguageCode?: string }>;
};

export function yandexTranslateConfigured() {
  return Boolean(process.env.YANDEX_TRANSLATE_API_KEY && process.env.YANDEX_TRANSLATE_FOLDER_ID);
}

export async function translateWithYandex(
  text: string,
  targetLanguage: TelegramLanguage,
  sourceLanguage: TelegramLanguage = "fr"
) {
  const target = normalizeTelegramLanguage(targetLanguage);
  const source = normalizeTelegramLanguage(sourceLanguage);
  if (!text.trim() || target === source || !yandexTranslateConfigured()) return text;

  const response = await fetch("https://translate.api.cloud.yandex.net/translate/v2/translate", {
    method: "POST",
    headers: {
      "authorization": `Api-Key ${process.env.YANDEX_TRANSLATE_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      folderId: process.env.YANDEX_TRANSLATE_FOLDER_ID,
      texts: [text],
      sourceLanguageCode: source,
      targetLanguageCode: target
    })
  });

  if (!response.ok) {
    throw new Error(`Yandex Translate HTTP ${response.status}`);
  }

  const body = await response.json() as YandexTranslateResponse;
  return body.translations?.[0]?.text?.trim() || text;
}

const translationCache = new Map<string, string>();

export async function translateTelegramText(text: string, targetLanguage: TelegramLanguage) {
  const target = normalizeTelegramLanguage(targetLanguage);
  if (target === "fr" || !yandexTranslateConfigured()) return text;
  const key = `${target}:${text}`;
  const cached = translationCache.get(key);
  if (cached) return cached;
  try {
    const translated = await translateWithYandex(text, target, "fr");
    translationCache.set(key, translated);
    return translated;
  } catch (error) {
    console.error("Traduction Yandex indisponible:", error instanceof Error ? error.message : "Erreur inconnue");
    return text;
  }
}

