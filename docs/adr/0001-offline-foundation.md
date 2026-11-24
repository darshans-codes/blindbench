# ADR 0001 · Offline foundation

**Context.** The workspace has Node.js 24.18.0 and Edge. Registry DNS failed. Docker, Rust, WSL and PostgreSQL tooling were unavailable. The planned stack relies on external dependencies and separate services.

**Decision.** Use a Node HTTP, server-rendered HTML, standard browser JavaScript and SQLite foundation. Keep the HTTP, repository, domain and UI boundaries distinct. Bind to loopback and leave protected collection closed.

**Alternatives.** Wait on dependency installation or build a standalone marketing site. The former would block all independent work. The latter would omit a real persistence flow.

**Consequences.** The workspace runs offline and can prove the draft journey. It cannot establish role separation, validated encrypted reports or production-capable storage.

**Revisit trigger.** A workspace with dependency registry access, Docker or Rust, and PostgreSQL can exercise T02 and T03.
