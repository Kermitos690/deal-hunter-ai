"use client";
import { useRouter } from "next/navigation";

export function DealActions({ id }: { id: string }) {
  const router = useRouter();
  async function action(name: "save" | "reject") {
    await fetch(`/api/deals/${id}/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: name === "reject" ? JSON.stringify({ reason: "Dashboard" }) : "{}" });
    router.refresh();
  }
  return <div className="flex gap-2"><button className="button" onClick={() => action("save")}>Sauvegarder</button><button className="button-secondary text-red-300" onClick={() => action("reject")}>Rejeter</button></div>;
}
