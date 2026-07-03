"use client";
import { useRouter } from "next/navigation";

export function RadarActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  async function patch(data: Record<string, unknown>) {
    await fetch(`/api/radars/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    router.refresh();
  }
  return <div className="flex flex-wrap gap-2">
    <button className="button-secondary text-sm" onClick={() => patch({ is_active: !active })}>{active ? "Pause" : "Activer"}</button>
    <button className="button-secondary text-sm" onClick={async () => { await fetch(`/api/radars/${id}/scan-now`, { method: "POST" }); router.refresh(); }}>Scanner</button>
    <button className="button-secondary text-sm text-red-300" onClick={async () => { if (confirm("Supprimer ce radar ?")) { await fetch(`/api/radars/${id}`, { method: "DELETE" }); router.refresh(); } }}>Supprimer</button>
  </div>;
}
