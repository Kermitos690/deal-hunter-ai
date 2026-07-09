export type TelegramDealAction = "save" | "reject" | "remind" | "noremind" | "negotiate" | "analysis";

const statusByAction: Partial<Record<TelegramDealAction, string>> = {
  save: "saved",
  reject: "rejected",
  remind: "reminder",
  negotiate: "negotiating"
};

export function alertStatusForTelegramAction(action: TelegramDealAction) {
  return statusByAction[action] ?? null;
}

export function isTelegramDealAction(value: string): value is TelegramDealAction {
  return ["save", "reject", "remind", "noremind", "negotiate", "analysis"].includes(value);
}

