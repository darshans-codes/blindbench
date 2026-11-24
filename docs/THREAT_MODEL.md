# Threat model

The current workspace stores fictional draft metadata only. The local operating-system user and other local processes are trusted. It has no external identity authority, collaborator access, protected measurement endpoint or publication channel.

| Boundary | Current control | Residual risk |
| --- | --- | --- |
| Browser to local workspace | Loopback listener, exact origin/host policy, CSRF, CSP, text escaping, body and rate limits | Local users and local processes can reach the workspace |
| Workspace to store | Parameterized queries, constraints, revision-based draft updates | The local account can access the SQLite file |
| Browser manifest reading | Bounded strict JSON, local hashing, explicit unavailable anchor state | Fingerprints need an independently trusted commitment |
| Fictional sensitivity example | Fixed public bins and counts, client-only demonstration | Illustrates sensitivity. It provides no privacy protection for inputs |

For the intended protected flow, compromised joint aggregators or a common host can violate report confidentiality. The collector sees exact aggregate data and must apply the release policy. Enrollment and timing metadata can correlate actions. A study threshold can reveal membership under some conditions. A chain commitment proves published artifact integrity against the trusted chain and address. A valid report can still express a dishonest measurement. Each control needs protocol evidence before the corresponding guarantee can be claimed.
