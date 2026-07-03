import Link from "next/link";
import type { AppUser } from "@/types";

export function DashboardNav({ user }: { user: AppUser }) {
  const links = [
    ["/dashboard", "Vue générale"],
    ["/dashboard/radars", "Radars"],
    ["/dashboard/deals", "Deals"],
    ["/dashboard/alerts", "Alertes"],
    ["/dashboard/settings", "Réglages"]
  ];
  if (user.role === "admin") links.push(["/admin", "Administration"]);
  return <aside className="border-b border-white/10 bg-panel/70 p-5 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
    <Link href="/" className="text-xl font-black">DEAL HUNTER <span className="text-mint">AI</span></Link>
    <div className="mt-2 text-xs text-slate-500">{user.display_name} • {user.plan}</div>
    <nav className="mt-8 flex gap-2 overflow-auto lg:flex-col">
      {links.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">{label}</Link>)}
    </nav>
  </aside>;
}
