"use client";

import { useState } from "react";

type Props = {
  userId: string;
  initialPlan: "free" | "pro" | "business";
  initialStatus: "active" | "suspended";
  isPrimaryAdmin: boolean;
};

export function AdminUserActions({
  userId, initialPlan, initialStatus, isPrimaryAdmin
}: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [status, setStatus] = useState(initialStatus);
  const [subscription, setSubscription] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, status })
    });
    const body = await response.json();
    setMessage(response.ok ? "Enregistré" : body.error ?? "Erreur");
    if (response.ok && body.subscription) {
      setSubscription(`${body.subscription.provider} • ${body.subscription.plan} • ${body.subscription.status}`);
    }
    setSaving(false);
  }

  return <div className="flex flex-wrap items-center gap-2">
    <select
      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
      value={plan}
      onChange={(event) => setPlan(event.target.value as typeof plan)}
    >
      <option value="free">Free</option>
      <option value="pro">Pro</option>
      <option value="business">Business</option>
    </select>
    <select
      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
      value={status}
      disabled={isPrimaryAdmin}
      onChange={(event) => setStatus(event.target.value as typeof status)}
    >
      <option value="active">Actif</option>
      <option value="suspended">Suspendu</option>
    </select>
    <button className="button-secondary" disabled={saving} onClick={save}>
      {saving ? "…" : "Enregistrer"}
    </button>
    {message && <span className="text-xs text-slate-400">{message}</span>}
    {subscription && <span className="text-xs text-mint">{subscription}</span>}
  </div>;
}
