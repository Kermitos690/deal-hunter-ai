# Cost-aware development rules

These rules are mandatory for every agent and contributor working in this repository.

- Start feature work in a draft pull request.
- Batch related changes before pushing; never create empty, WIP, Changes, or trigger-only commits.
- Never add automatic push triggers for feature, agent/**, or integration branches.
- Pull-request CI must skip draft PRs and run when marked ready, manually dispatched, and after merge to main.
- Use narrow path filters so unrelated files do not start application CI.
- Every automatic workflow must use concurrency with cancel-in-progress: true.
- Run cheap fail-fast checks before expensive checks and do not use continue-on-error for required checks.
- Prefer one sequential job, caches, and npm ci --no-audit --no-fund --prefer-offline.
- Upload artifacts only on failure and retain them briefly.
- Prefer Vercel or the application platform's cron system over GitHub runners when equivalent.
- Document expected monthly runs before adding a schedule and use the lowest useful frequency.
- Do not duplicate endpoints across schedulers or create self-modifying one-shot workflows.
- Do not broaden GitHub Actions triggers without documenting cost impact.
- Re-run only failed jobs, never an entire successful pipeline.
