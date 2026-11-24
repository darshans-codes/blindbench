# ADR 0002 · Private aggregation compatibility

**Context.** Janus and Divvi Up TypeScript span several DAP revisions. A nominal match needs runtime validation with exact versions.

**Decision.** Pin Janus `0.7.148` and Divvi Up DAP `0.9.1` for the isolated DAP draft 09 spike. Use upstream interop binaries behind a private Compose network with separate datastore keys and loopback-only databases. Keep the integration gate open until a real browser generates encrypted reports and the collector confirms the exact fixture result after validation and replay checks.

**Alternatives.** Pair DAP versions that interoperate on a newer maintained release or use the specification's vetted VDAF-based experimental transport path. The experimental path also requires a validated browser and independently encrypted transport.

**Consequences.** There is no protected admission path until an interoperable pair is proven. The compatibility matrix records source-level evidence and runtime gaps.

**Revisit trigger.** A host can resolve and pull the pinned packages and images, run the upstream fixtures, and execute `npm run test:protocol`. See [compatibility notes](../protocols/COMPATIBILITY.md).
