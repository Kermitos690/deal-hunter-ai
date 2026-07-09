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

export function liveFetch(input: string | URL | Request, init: LiveFetchInit = {}) {
  const agent = getProxyAgent();
  if (!agent) return fetch(input, init);
  return fetch(input, { ...init, dispatcher: agent } as LiveFetchInit);
}
