import { ProxyAgent } from "undici";

let proxyAgent: ProxyAgent | null = null;
let proxyAgentUrl: string | null = null;

export function liveSourceProxyUrl() {
  return process.env.LIVE_SOURCE_PROXY_URL || process.env.SWISS_SOURCE_PROXY_URL || "";
}

export function liveSourceProxyConfigured() {
  return Boolean(liveSourceProxyUrl());
}

function getProxyAgent() {
  const proxyUrl = liveSourceProxyUrl();
  if (!proxyUrl) return undefined;
  if (!proxyAgent || proxyAgentUrl !== proxyUrl) {
    proxyAgent = new ProxyAgent(proxyUrl);
    proxyAgentUrl = proxyUrl;
  }
  return proxyAgent;
}

type LiveFetchInit = RequestInit & {
  dispatcher?: ProxyAgent;
  next?: unknown;
};

export function fetchErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "erreur inconnue";
  const cause = "cause" in error ? error.cause : null;
  if (cause && typeof cause === "object") {
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : null;
    const message = "message" in cause && typeof cause.message === "string" ? cause.message : null;
    if (code && message) return `${error.message} (${code}: ${message})`;
    if (code) return `${error.message} (${code})`;
    if (message) return `${error.message} (${message})`;
  }
  return error.message;
}

export function liveFetch(input: string | URL | Request, init: LiveFetchInit = {}) {
  const agent = getProxyAgent();
  if (!agent) return fetch(input, init);
  return fetch(input, { ...init, dispatcher: agent } as LiveFetchInit);
}
