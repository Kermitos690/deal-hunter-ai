# Telegram UX release — 2026-07-14

This release activates the compact single-screen Telegram experience already merged into `main`.

## Included

- callback screens edit the active message instead of stacking replies;
- persistent navigation buttons are present under every screen;
- deal analysis is split into short Summary, Market, Authenticity and Actions views;
- keep, reject and next-deal actions replace the current deal card;
- Telegram webhook retry handling and scoring v6 safeguards are included;
- CI validation covers lint, TypeScript, tests and the production build.

This file also records the production redeployment requested after the previous Vercel Hobby build-rate limit expired.
