"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChannelSubscribeButton({
  slug,
  initialSubscribed,
  initialMode = "dashboard"
}: {
  slug: string;
  initialSubscribed: boolean;
  initialMode?: string | null;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [mode, setMode] = useState(initialMode ?? "dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/channels/${encodeURIComponent(slug)}/subscription`, {
        method: subscribed ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: subscribed ? undefined : JSON.stringify({ notificationMode: mode })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Action impossible.");
      setSubscribed(!subscribed);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-2">
    {!subscribed ? <select className="input" value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Notifications du canal">
      <option value="dashboard">Dashboard uniquement</option>
      <option value="telegram">Telegram uniquement</option>
      <option value="both">Dashboard + Telegram</option>
      <option value="none">Suivre sans notification</option>
    </select> : null}
    <button className={subscribed ? "button-secondary" : "button"} disabled={busy} type="button" onClick={toggle}>
      {busy ? "Enregistrement…" : subscribed ? "Se désabonner" : "Suivre ce canal"}
    </button>
    {error ? <p className="text-xs text-red-300">{error}</p> : null}
  </div>;
}
