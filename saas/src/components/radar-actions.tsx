"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function RadarActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [scanStatus, setScanStatus] = useState("");
  async function patch(data: Record<string, unknown>) {
    await fetch(`/api/radars/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    router.refresh();
  }
  async function scanNow() {
    setScanStatus("Scan en cours…");
    const response = await fetch(`/api/radars/${id}/scan-now`, { method: "POST" });
    setScanStatus(response.ok ? "Scan lancé" : "Scan impossible");
    router.refresh();
    setTimeout(() => setScanStatus(""), 3500);
  }
  return <div className="flex flex-wrap gap-2">
    <Link className="button-secondary text-sm" href={`/dashboard/radars/${id}/edit`}>Modifier</Link>
    <button className="button-secondary text-sm" onClick={() => patch({ is_active: !active })}>{active ? "Pause" : "Activer"}</button>
    <button className="button-secondary text-sm" disabled={Boolean(scanStatus)} onClick={scanNow}>{scanStatus || "Scanner"}</button>
    <button className="button-secondary text-sm text-red-300" onClick={async () => { if (confirm("Supprimer ce radar ?")) { await fetch(`/api/radars/${id}`, { method: "DELETE" }); router.refresh(); } }}>Supprimer</button>
  </div>;
}
