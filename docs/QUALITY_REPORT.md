# Quality report

| Gate | Applicability | Result | Command/evidence | Issue | Fix / owner |
| --- | --- | --- | --- | --- | --- |
| Offline install and startup | Foundation | PASS | `npm ci --offline` and `npm run dev` | None observed | Maintainer |
| Syntax | Foundation | PASS | `npm run check` | Full lint and typecheck pending | Maintainer, T02 |
| Typed policy and form | Foundation | PASS | TypeScript 7.0.2 strict checking from the verified cached package | Full web/API type coverage pending | Maintainer, T02 |
| Compose exposure | T05 configuration review | PASS | `npm run check:topology` resolves all four roles and checks internal network, ports, privilege, and mounts | Live study fixture pending | Maintainer |
| API and persistence | Foundation | PASS | `npm test` · four tests cover draft restart, edit concurrency, rate limit, invalid forms, fingerprint and route health | None observed | Maintainer |
| Browser smoke | Foundation | PASS | `npm run test:browser` · Edge at 1440px and 390px, including Compute → protocol test instructions | Headless Chrome exited on this host. Edge succeeded | Maintainer |
| Focus, labels, overflow, empty and invalid states | Foundation | PASS | Chromium smoke and visual inspection of desktop and 390px homepage captures | Full WCAG and protocol failure-path audit pending | Maintainer, T18 |
| Input boundary and local authorization | Foundation | PASS | Loopback, valid and invalid origin/CSRF, body bounds, escaping and 429 exercised | User identities and privileged storage roles pending | Maintainer, T06–T08 |
| Fingerprint integrity | Foundation | PASS | Original, reordered, altered and invalid JSON checks. Web Crypto in browser with upload path absent | Chain integrity unverified | Maintainer, T10–T11 |
| Policy preview round trip | Local lifecycle | PASS | API verifies repeated save, stale revision rejection, altered digest and stored bytes after restart. Browser smoke matches an exported file fingerprint to its saved preview | Chain commitment and protected state transitions pending | Maintainer, T08–T11 |
| Protocol harness orchestration | T03 harness | PASS | `npm test` covers task and credential boundaries, retry, malformed envelope isolation, reused key rejection and exact bin comparison with stand-ins | No live protocol assertions in these tests | Maintainer |
| Native fixture routing | T04 alternative runner | PASS | `npm test` checks native loopback port validation and separate role routing with stand-ins | A native Janus and PostgreSQL host is required for live validation | Maintainer |
| Package and source review | Foundation | PASS | Locked manifest has no external packages. Source-only ZIP excludes databases, keys and environment files | Full dependency and outgoing range scans are checkpoint gates | Maintainer, T05 |
| Private aggregation fixture | T03 harness | PASS | Windows Docker run showed exact fixture match, empty upload rejected, retry counted once and probe container exit 0 | Full T03 gate still needs upstream fixtures and dependency evidence | Maintainer, T03 |
| Protocol command and cleanup | T03 harness | PASS | User reported exit code 0 after rerunning the detached wrapper | New image provenance output still needs a live confirmation | Maintainer, T03 |
| Study fixture queue and receipt | T04 local boundary | PASS | Unit/API tests exercise idempotent queueing, validation, durable snapshot, retry and lease fencing. Browser smoke queues a fixture at desktop width and checks the detail page at 390px | Live integrated worker pending | Maintainer, T04 |
| Pinned upstream histogram vectors | T03 | PASS | `test_vec_prio3_histogram` passed on the user's Docker host | Janus image digests and dependency review remain | Maintainer |
| Live study fixture | T04 | PARTIAL | Browser generated and uploaded encrypted reports. Collector poll timed out. Local regression covers the revised single-bucket query | Managed session cannot access Docker's Linux engine. Native Janus and PostgreSQL are unavailable | Maintainer |
| Local workspace regression | Current build | PASS | `npm test` passed all 18 tests. `npm run check` checked 29 modules. `npm run check:topology` verified the private Compose configuration | Live protocol excluded from these checks | Maintainer |
| Chain manifest verification | T10-T11 | PARTIAL | `npm run test:browser` passed at 1440 and 390 px. Independent browser and CLI reads exercised against a test RPC. Browser status checks cover match, edited file, wrong chain and unavailable RPC | Foundry and Anvil unavailable. No live contract deployment was checked | Maintainer |
| Histogram insights | T15 | PARTIAL | Offline example and matched-fixture summary tested. Unit tests cover empty histograms, ties, malformed inputs and large counts | No approved private release integrated | Maintainer |
| SQLite backup and restore | T16 local storage | PASS | Recovery test reopens an independent snapshot, restores a draft and its immutable policy preview, and verifies that a later backup preserves the existing destination | PostgreSQL recovery outside this check | Maintainer |
| Shared study policy rerun | T02 | BLOCKED | `npm run typecheck --offline` returned `ENOTCACHED` for pinned TypeScript | Earlier shared-package check passed. This managed session lacks the package cache | Maintainer |
| DP and protocol benchmarks | Mandatory | BLOCKED | Standalone synthetic histogram probe passed | Official DP and live study workload missing | Maintainer |
| CI / deployment | Mandatory for release | DEFERRED | Workflow YAML and local equivalent available | Source publication is authorized. Deployment and release verification remain pending | Maintainer, T05 and T19 |
| Adaptive controls | Mandatory review | PASS | See `docs/ENGINEERING_CONTROLS.md` for each control's state | Several controls deferred to their activation point | Maintainer |
