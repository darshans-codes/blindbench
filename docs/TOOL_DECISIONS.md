# Tool decisions

| Decision | Rationale | Source |
| --- | --- | --- |
| Node 24.18.0, standard library server and CSS tokens for the offline foundation | Verified runtime on this host. The foundation can run with zero registry downloads while preserving separate domain, persistence, HTTP and browser modules. Revisit when compatible Next.js, Fastify and PostgreSQL are available | [Node.js](https://nodejs.org/) |
| Node’s bundled SQLite for draft storage | Durable local drafts and transactional migrations on this host. Revisit before the protocol and deployment gates require PostgreSQL roles, leases and concurrency semantics | [Node SQLite](https://nodejs.org/api/sqlite.html) |
| Original dashboard components | Responsive navigation, forms and charts with system typography and semantic HTML. Revisit the planned shadcn/ui component layer with the Next.js migration | [shadcn/ui](https://ui.shadcn.com/) |
| Janus and Divvi Up TypeScript candidate pair | Janus `release/0.7` and the client’s `0.9` family both describe DAP draft 09. This is source-level evidence only. Review VDAF and HPKE versions before pinning an exact pair | [Janus](https://github.com/divviup/janus) · [Divvi Up TS](https://github.com/divviup/divviup-ts) |
| Browser-based manifest preparation | Local Web Crypto hashing, a strict v1 schema, an explicit local chain configuration and an optional read-only JSON-RPC adapter | [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) |

The foundation requires no external service charges. Dependency pins, upstream license and advisory checks, and real interop evidence are part of the protocol gate. No external AI or component generators are needed for the initial slice.
