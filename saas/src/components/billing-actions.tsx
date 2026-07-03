"use client";

import { useState } from "react";

export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [status, setStatus] = useState("");

  async function redirect(endpoint: string, body?: unknown) {
    setStatus("Ouverture…");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) return setStatus(data.error ?? "Facturation indisponible.");
    window.location.href = data.url;
  }

  return <div className="mt-6 flex flex-wrap gap-3">
    <button className="button" onClick={() => redirect("/api/billing/checkout", { plan: "pro" })}>
      Passer à Pro
    </button>
    <button className="button-secondary" onClick={() => redirect("/api/billing/checkout", { plan: "business" })}>
      Passer à Business
    </button>
    {hasCustomer && <button className="button-secondary" onClick={() => redirect("/api/billing/portal")}>
      Gérer factures et abonnement
    </button>}
    {status && <div className="w-full text-sm text-slate-400">{status}</div>}
  </div>;
}
