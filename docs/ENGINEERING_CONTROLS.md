# Engineering controls

| Control | Status | Evidence or revisit point |
| --- | --- | --- |
| Rate limiting | Pass for draft foundation | Local write limit and 429 tested. Revisit distributed proof and enrollment limits at T07 |
| Caching | Deferred | No API cache. Revisit immutable release reads at T09 |
| Load balancing | Deferred | Single loopback process. Revisit after measured pressure |
| Reverse proxy | Deferred | Local HTTP listener. Revisit if remote staging is authorized |
| API gateway | Partial | Shared HTTP validation and safe responses. Full control and admission routes pending |
| CI/CD | Partial | Local commands verified. GitHub Actions file is present and remote execution awaits checkpoint |
| Docker | Blocked | Docker runtime unavailable and service pins need T03 |
| Kubernetes | Deferred | Local deployment fits the specified scope |
| Service discovery | Deferred | No internal network services configured |
| Circuit breaker | Deferred | No external runtime dependencies. Revisit collector, RPC and optional AI timeouts and recovery |
