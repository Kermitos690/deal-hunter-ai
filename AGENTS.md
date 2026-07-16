# Cost-aware development rules

These rules are mandatory for every agent and contributor working in this repository.

## Default workflow

- Start feature work in a **draft pull request**.
- Batch related changes before pushing; never create empty, `WIP`, `Changes`, or trigger-only commits.
- Never add automatic `push` triggers for feature, `agent/**`, or integration branches.
- Pull-request CI must skip draft PRs and run when the PR is marked ready, when manually dispatched, and after merge to `main`.
- Use narrow path filters so documentation and unrelated modules do not start application CI.
- Every automatic workflow must use `concurrency` with `cancel-in-progress: true`.

## CI design

- Run cheap fail-fast checks before expensive checks.
- Do not use `continue-on-error` for required checks.
- Prefer one sequential job unless parallel execution has a documented cost benefit.
- Use caches and deterministic installs such as `npm ci --no-audit --no-fund --prefer-offline`.
- Upload artifacts only on failure and retain them briefly.
- Browser E2E, database gates, deployment previews, migrations, and production operations must be targeted and run only when relevant.

## Scheduled automation

- Prefer Vercel or the application platform's cron system when it provides the same service without GitHub runner minutes.
- Before adding a GitHub schedule, document expected monthly runs and use the lowest useful frequency.
- Do not duplicate the same endpoint in multiple schedulers.
- Do not create self-modifying or one-shot workflows that commit code.

## Change control

- Do not add or broaden a GitHub Actions trigger without explaining its monthly cost impact in the PR.
- Reuse existing workflows instead of creating overlapping workflows.
- Close superseded PRs and neutralize obsolete branch workflows.
- Re-run only failed jobs, never an entire successful pipeline.
