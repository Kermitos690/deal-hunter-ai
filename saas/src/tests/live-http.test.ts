import { afterEach, describe, expect, it } from "vitest";
import { fetchErrorMessage, liveSourceProxyConfigured, liveSourceProxyUrl } from "@/sources/live-http";

describe("live source HTTP configuration", () => {
  const originalLiveProxy = process.env.LIVE_SOURCE_PROXY_URL;
  const originalSwissProxy = process.env.SWISS_SOURCE_PROXY_URL;

  afterEach(() => {
    process.env.LIVE_SOURCE_PROXY_URL = originalLiveProxy;
    process.env.SWISS_SOURCE_PROXY_URL = originalSwissProxy;
  });

  it("désactive le proxy live quand aucune URL n'est configurée", () => {
    delete process.env.LIVE_SOURCE_PROXY_URL;
    delete process.env.SWISS_SOURCE_PROXY_URL;

    expect(liveSourceProxyConfigured()).toBe(false);
    expect(liveSourceProxyUrl()).toBe("");
  });

  it("utilise LIVE_SOURCE_PROXY_URL en priorité", () => {
    process.env.LIVE_SOURCE_PROXY_URL = "http://main-proxy.example:8080";
    process.env.SWISS_SOURCE_PROXY_URL = "http://swiss-proxy.example:8080";

    expect(liveSourceProxyConfigured()).toBe(true);
    expect(liveSourceProxyUrl()).toBe("http://main-proxy.example:8080");
  });

  it("accepte SWISS_SOURCE_PROXY_URL comme alias", () => {
    delete process.env.LIVE_SOURCE_PROXY_URL;
    process.env.SWISS_SOURCE_PROXY_URL = "http://swiss-proxy.example:8080";

    expect(liveSourceProxyConfigured()).toBe(true);
    expect(liveSourceProxyUrl()).toBe("http://swiss-proxy.example:8080");
  });

  it("expose le code technique des erreurs fetch quand disponible", () => {
    const error = new Error("fetch failed", {
      cause: Object.assign(new Error("connection timeout"), { code: "ETIMEDOUT" })
    });

    expect(fetchErrorMessage(error)).toBe("fetch failed (ETIMEDOUT: connection timeout)");
  });
});
