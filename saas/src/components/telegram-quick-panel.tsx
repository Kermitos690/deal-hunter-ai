import type { AppUser } from "@/types";
import { TELEGRAM_COMMANDS, telegramBotUrl, telegramStartUrl } from "@/lib/telegram-links";

export function TelegramQuickPanel({ user, compact = false }: { user: AppUser; compact?: boolean }) {
  return <section className={`card ${compact ? "p-4" : ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="badge text-cyan">Telegram connecté</div>
        <h2 className="mt-3 text-xl font-black">Pilote Deal Hunter depuis Telegram</h2>
        <p className="mt-1 text-sm text-slate-400">
          {user.telegram_id ? `Compte lié : ${user.telegram_id}` : "Compte Telegram non lié."}
        </p>
      </div>
      <a className="button-secondary text-sm" href={telegramBotUrl()} rel="noreferrer" target="_blank">Ouvrir le bot</a>
    </div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      <a className="button" href={telegramStartUrl("newradar")} rel="noreferrer" target="_blank">➕ Créer un radar</a>
      <a className="button-secondary" href={telegramStartUrl("radars")} rel="noreferrer" target="_blank">📡 Mes radars</a>
      <a className="button-secondary" href={telegramStartUrl("deals")} rel="noreferrer" target="_blank">🏆 Mes deals</a>
      <a className="button-secondary" href={telegramStartUrl("alerts")} rel="noreferrer" target="_blank">🚨 Alertes</a>
    </div>
    {!compact && <div className="mt-5 rounded-xl bg-black/20 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Commandes utiles</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TELEGRAM_COMMANDS.map((item) => <span className="badge" key={item.command}><code>{item.command}</code> — {item.label}</span>)}
      </div>
    </div>}
  </section>;
}
