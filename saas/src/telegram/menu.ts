export function mainMenuText(displayName: string) {
  return [
    "Menu Deal Hunter AI",
    "",
    `Compte : ${displayName}`,
    "Choisis une action."
  ].join("\n");
}

export function mainMenuKeyboard(dashboardUrl: string) {
  return {
    inline_keyboard: [
      [{ text: "➕ Créer un radar", callback_data: "create_radar" }],
      [{ text: "📡 Mes radars", callback_data: "list_radars" }],
      [{ text: "🚨 Dernières alertes", callback_data: "list_alerts" }, { text: "⭐ Deals", callback_data: "list_deals" }],
      [{ text: "🌐 Dashboard", url: dashboardUrl }]
    ]
  };
}
