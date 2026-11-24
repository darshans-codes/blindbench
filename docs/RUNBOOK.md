# Local operations

- Launch `npm ci --offline` and `npm run dev`. Check `/healthz` for process liveness and `/readyz` for draft storage status.
- Use `PORT` for an alternative loopback port. A port conflict fails at startup and leaves the existing process alone.
- Create a verified snapshot with `npm run backup -- .local/blindbench-backup.sqlite`. The command opens the source read-only and publishes the verified snapshot to a new destination on a filesystem that supports hard links. It preserves existing files. Point `BLINDBENCH_DB` at the restored copy, launch the app on a separate port, and check `/studies`. The backup test restores a draft and its saved policy preview.
- To start a clean synthetic namespace, launch against a new database file. The migration and sample draft run on first startup.
- A 403 response on a stale form is resolved by reopening the form in the same workspace. A version conflict preserves form values and prompts comparison before retry.
- Runtime charges for the local foundation are zero. The app runs without accounts or API keys. See the [protocol fixture](protocols/COMPATIBILITY.md) and [local commitment verifier](protocols/LOCAL_LEDGER.md) for the separate test runtimes.
