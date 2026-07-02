"""Safe entry point for Deal Hunter AI.

The historical ``main.py`` currently contains a few helper definitions nested
inside other functions and sends the dashboard message while being imported.
This module loads it without that import-time notification, restores the
runtime configuration, and installs the helpers at module scope.
"""

from __future__ import annotations

import importlib
import os
import sys
from typing import Any
from urllib.parse import urlencode


_NOTIFICATION_ENV = ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID")


def short_param(value: Any, limit: int = 140) -> str:
    return str(value or "").strip()[:limit]


def patch_engine(engine: Any) -> Any:
    """Install the helpers that ``main.py`` expects to find globally."""

    def build_gsheet_action_url(
        action: str,
        item: dict[str, Any],
        include_full_url: bool = False,
    ) -> str | None:
        if not engine.GSHEET_ACTION_WEBHOOK_URL or not engine.GSHEET_ACTION_TOKEN:
            return None

        offer = item.get("offer", {})
        deal_id = item.get("deal_id") or engine.make_deal_id(item)
        params = {
            "action": action,
            "token": engine.GSHEET_ACTION_TOKEN,
            "deal_id": deal_id,
            "product": short_param(offer.get("title"), 140),
            "price_chf": short_param(offer.get("price_chf"), 30),
            "source": short_param(offer.get("source"), 90),
            "seller_country": short_param(offer.get("seller_country"), 30),
            "score": short_param(item.get("score"), 10),
            "market_decision": short_param(item.get("market_decision"), 90),
            "evidence_score": short_param(item.get("evidence_score"), 10),
            "flip_decision": short_param(item.get("flip_decision"), 50),
            "profit_chf": short_param(item.get("profit"), 20),
            "roi_percent": short_param(item.get("roi"), 20),
            "target_buy_price": short_param(item.get("target_buy_price"), 20),
            "market_effective_price": short_param(
                item.get("market_effective_price"), 20
            ),
            "notes": "Action depuis Telegram",
        }

        if include_full_url:
            params["url"] = offer.get("url", "")

        separator = "&" if "?" in engine.GSHEET_ACTION_WEBHOOK_URL else "?"
        return (
            engine.GSHEET_ACTION_WEBHOOK_URL
            + separator
            + urlencode(params)
        )

    def send_static_telegram_menu() -> None:
        dashboard_url = engine.build_gsheet_page_url("MENU")
        tutorial_url = engine.build_gsheet_page_url("TUTORIAL")

        if not dashboard_url:
            return

        buttons = {
            "inline_keyboard": [
                [{"text": "📌 Dashboard privé", "url": dashboard_url}],
                [
                    {"text": "🟡 Annonces à vérifier", "url": dashboard_url},
                    {"text": "✅ Achats", "url": dashboard_url},
                ],
                [
                    {"text": "💰 Reventes", "url": dashboard_url},
                    {
                        "text": "📘 Tutoriel",
                        "url": tutorial_url or dashboard_url,
                    },
                ],
            ]
        }

        engine.send_telegram(
            """📌 DEAL HUNTER AI — DASHBOARD PRIVÉ

Ton dashboard privé permet de suivre les annonces, achats, reventes et opportunités détectées.

⚠️ Vérifie toujours l’annonce, le vendeur, les frais, l’authenticité, le scellage et les ventes réelles avant d’acheter.""",
            reply_markup=buttons,
        )

    engine.short_param = short_param
    engine.build_gsheet_action_url = build_gsheet_action_url
    engine.send_static_telegram_menu = send_static_telegram_menu
    return engine


def load_engine() -> Any:
    """Import ``main`` without sending Telegram messages during import."""

    saved = {name: os.environ.pop(name, None) for name in _NOTIFICATION_ENV}
    try:
        engine = importlib.import_module("main")
    finally:
        for name, value in saved.items():
            if value is not None:
                os.environ[name] = value

    engine.TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
    engine.TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
    return patch_engine(engine)


def run(mode: str) -> None:
    engine = load_engine()

    if mode == "manual":
        manual_value = importlib.import_module("manual_value")
        manual_value.main()
        return

    if mode != "auto":
        raise SystemExit(f"Mode inconnu: {mode!r}. Utiliser 'auto' ou 'manual'.")

    engine.main()


if __name__ == "__main__":
    run(sys.argv[1].strip().lower() if len(sys.argv) > 1 else "auto")