# Local HTTP boundary

| Endpoint | Behavior |
| --- | --- |
| `GET /healthz` | Workspace process liveness |
| `GET /readyz` | SQLite read succeeds. Aggregation and ledger statuses reflect missing services |
| `GET /studies/create` | Render draft form and process-scoped same-origin form token |
| `POST /studies/create` | Validate and persist a synthetic draft. Return a 303 redirect or a 422 form with field errors |
| `GET /studies/{id}/edit` | Render editable draft with current revision |
| `POST /studies/{id}/edit` | Save only with the expected revision. A stale revision returns 409 |
| `POST /studies/{id}/fixture` | Queue one fictional fixture for the current revision and redirect to its receipt. Accepts the form token, revision and fixed fixture selector |
| `POST /studies/{id}/policy` | Save an immutable local preview for the current revision. Accepts the form token and revision only |
| `GET /studies/{id}/policy/{revision}.json` | Download a saved preview as JSON. The document omits the local title and all participant and result data |
| `GET /examples/result-manifest.json` | Download a public fictional manifest using the v1 schema |

Mutation requests require the exact loopback Host and Origin plus the form token. The body limit is 4 KiB and the local write limit is 30 requests per minute. The real `/v1` protocol API remains gated by the integration and admission work in §13.

The fingerprint uses UTF-8, fixed ASCII fields sorted by key, JSON serialization of the bounded schema, and a `blindbench/result/v1` prefix followed by one NUL byte and the canonical payload. SHA-256 runs in Web Crypto for both browser and CLI. The fictional manifest references no real committed policy.

Policy previews have the same canonical encoding rules with a separate `blindbench/study-policy-preview/v1` domain. The saved digest and the verifier agree across browser and server. The preview is a local preparation artifact and carries no chain commitment or collection approval.
