import { afterEach, describe, expect, it, vi } from "vitest";
import { translateTelegramText, translateWithYandex, yandexTranslateConfigured } from "@/lib/translation/yandex";

describe("Yandex Translate", () => {
  afterEach(() => {
    delete process.env.YANDEX_TRANSLATE_API_KEY;
    delete process.env.YANDEX_TRANSLATE_FOLDER_ID;
    vi.unstubAllGlobals();
  });

  it("reste désactivé sans secrets", () => {
    expect(yandexTranslateConfigured()).toBe(false);
  });

  it("traduit via l'API officielle quand elle est configurée", async () => {
    process.env.YANDEX_TRANSLATE_API_KEY = "test-key";
    process.env.YANDEX_TRANSLATE_FOLDER_ID = "folder-1";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      translations: [{ text: "Deal to review" }]
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(translateWithYandex("Deal à trier", "en")).resolves.toBe("Deal to review");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://translate.api.cloud.yandex.net/translate/v2/translate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Api-Key test-key" })
      })
    );
  });

  it("ne bloque jamais Telegram si Yandex échoue", async () => {
    process.env.YANDEX_TRANSLATE_API_KEY = "test-key";
    process.env.YANDEX_TRANSLATE_FOLDER_ID = "folder-1";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    await expect(translateTelegramText("Deal à trier", "en")).resolves.toBe("Deal à trier");
  });
});

