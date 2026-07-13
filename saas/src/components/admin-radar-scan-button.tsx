"use client";

import { useState } from "react";

export function AdminRadarScanButton({ radarId }: { radarId: string }) {
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setStatus("Scan en cours…");
    try {
      const response = await fetch(`/api/admin/radars/${encodeURIComponent(radarId)}/scan`, {
        method: "POST"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(body.error ?? "Scan impossible.");
        return;
      }
      const result = body.result ?? {};
      setStatus(`${result.candidatesFound ?? 0} candidat(s), ${result.alertsCreated ?? 0} alerte(s)`);
    } catch {
      setStatus("Réseau indisponible.");
    } finally {
      setRunning(false);
    }
  }

  return <div className="flex flex-col items-end gap-2">
    <button className="button-secondary" disabled={running} onClick={run}>
      {running ? "Scan…" : "Scanner ce radar"}
    </button>
    {status && <span className="max-w-xs text-right text-xs text-slate-400">{status}</span>}
  </div>;
}
