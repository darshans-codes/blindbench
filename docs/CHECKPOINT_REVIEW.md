# Checkpoint review

The standalone Windows Docker run verified browser-generated reports, a separate leader and helper, collector correctness, rejection of an empty envelope and replay-safe counting. A second standalone run completed cleanup. The pinned libprio histogram vector test passed. The integrated study run uploaded reports and timed out during collection. Its single-bucket correction passes local regression checks and needs a live run.

| Review | Evidence | Remaining |
| --- | --- | --- |
| Container configuration | `npm run check:topology` checks four services on one internal network, absent published ports and privileged flags, the exact read-only bootstrap mounts, and the browser probe user | Run the corrected integrated fixture |
| Trust boundary | Both aggregators start with separate datastore keys and loopback PostgreSQL. The SDK package integrity matches the verified trial. The web process queues bounded fictional settings and receives a status receipt | General participation, credential isolation across environments, and protected publication are later gates |
| Input boundary | Local API tests cover origin, CSRF, content length, stale edits, retry leases and the absence of a report upload route | Protected admission remains closed |
| Source and dependency review | Disposable staging uses the source-only allowlist. Initial credential-pattern scan and source diff review cover that snapshot. The browser package uses the integrity printed by the live run | Full image scan, project Git staging and outgoing range verification are pending |
| Remote | The owner authorized publishing the current source to `darshans-codes/blindbench` on `main` | T02, T04 and T05 remain open in the verification ledger |

No live input or exact aggregate is exposed by the workspace. The Docker host owner controls all test services. This proof of compatibility applies to the pinned DAP-09 fixture.
