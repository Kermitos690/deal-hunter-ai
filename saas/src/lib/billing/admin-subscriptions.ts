import type { Plan } from "@/types";

export type AdminSubscriptionInput = {
  userId: string;
  plan: Plan;
  userStatus: "active" | "suspended";
};

export function manualSubscriptionState(input: AdminSubscriptionInput) {
  const isPaidPlan = input.plan !== "free";
  return {
    user_id: input.userId,
    provider: "manual_admin",
    customer_id: `manual:${input.userId}`,
    subscription_id: `manual:${input.userId}`,
    price_id: null,
    plan: input.plan,
    status: input.userStatus === "suspended"
      ? "paused_user_suspended"
      : isPaidPlan
        ? "active"
        : "inactive",
    current_period_end: null,
    cancel_at_period_end: false
  };
}

