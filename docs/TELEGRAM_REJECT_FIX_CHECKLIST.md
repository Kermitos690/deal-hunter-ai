# Production checklist — Telegram Reject

- [ ] Latest `main` commit built successfully
- [ ] Supabase migration `20260713211500_telegram_deal_actions_idempotent.sql` applied
- [ ] First reject succeeds
- [ ] Repeated reject succeeds
- [ ] Deal appears in rejected inbox
- [ ] Re-scan does not surface the rejected product again
