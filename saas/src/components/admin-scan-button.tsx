"use client";
import { useState } from "react";
export function AdminScanButton() {
  const [status,setStatus] = useState("");
  return <button className="button" onClick={async () => { setStatus("Scan…"); const r=await fetch("/api/admin/run-global-scan",{method:"POST"}); const body=await r.json(); setStatus(r.ok ? `${body.results.length} radar(s) traité(s)` : body.error); }}>{status || "Lancer un scan global"}</button>;
}
