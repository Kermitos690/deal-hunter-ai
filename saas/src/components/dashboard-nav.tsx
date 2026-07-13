import Link from "next/link";
import type { AppUser } from "@/types";
import { telegramStartUrl } from "@/lib/telegram-links";

export function DashboardNav({ user }: { user: AppUser }) {
  const links = [
    ["/dashboard", "Vue générale"],
    ["/dashboard/radars", "Radars"],
    ["/dashboard/deals", "Deals"],
    ["/dashboard/performance", "Performance"],
    ["/dashboard/alerts", "Alertes"],
    ...(process.env.ENABLE_REFERRALS === "true" ? [["/dashboard/referrals", "Parrainage"]] : []),
    ["/dashboard/settings", "Réglages"]
  ];
  if (user.role === "admin") links.push(["/admin", "Administration"]);
  return <aside className="border-b border-white/10 bg-panel/70 p-5 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
    <Link href="/" className="text-xl font-black">DEAL HUNTER <span className="text-mint">AI</span></Link>
    <div className="mt-2 text-xs text-slate-500">{user.display_name} • {user.plan}</div>
    <div className="mt-5 rounded-2xl border border-cyan/20 bg-cyan/5 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-cyan">Telegram live</div>
      <p className="mt-1 text-xs text-slate-400">Crée, scanne et reviens ici depuis le bot.</p>
      <div className="mt-3 grid gap-2">
        <a className="button text-xs" href={telegramStartUrl("newradar")} rel="noreferrer" target="_blank">+ Radar Telegram</a>
        <a className="button-secondary text-xs" href={telegramStartUrl("dashboard")} rel="noreferrer" target="_blank">Ouvrir le bot</a>
      </div>
    </div>
    <nav className="mt-8 flex gap-2 overflow-auto lg:flex-col">
      {links.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">{label}</Link>)}
    </nav>
  </aside>;
}
