# Telegram reject action fix

The Telegram `Reject` action writes to tables that are unique on
`(user_id, product_id)`. Supabase/PostgREST must therefore use that composite
conflict target for repeated actions.

The server client now normalizes upsert options for:

- `saved_deals`
- `rejected_products`
- `auction_reminders`

A database migration also keeps existing deployed code idempotent while the
new application build is being rolled out. Production acceptance requires:

1. reject a real Telegram deal;
2. confirm it appears under rejected deals;
3. reject the same deal again without an error;
4. run the radar again and confirm the rejected product does not return.
