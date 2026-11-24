# BlindBench

BlindBench is a local privacy engineering workstation. The project explores how a group can compute a useful histogram without collecting participant measurements in one place.

**Development status.** The local workspace runs without Docker. Protected participation and private releases remain closed. Live study integration and contract deployment are pending verification.

## Run the current workspace

Requires Node.js 24.18 and npm. From the repository root:

```powershell
npm ci --offline
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The HTTP listener binds to loopback. Set `PORT` or `BLINDBENCH_DB` in the environment to change the port or local SQLite location. The default database is `.local/blindbench.sqlite`.

1. Open the demo workspace from the homepage and inspect the seeded compensation draft.
2. Create a fictional study, set a minimum batch and collection window, then save and edit it. Restart the server to confirm persistence.
3. Open **Privacy** and add or remove one fictional contribution. The chart and its values table show the change.
4. Open **Verify manifest**, download the sample, and calculate its digest in the browser. Change one count in a copy and compare fingerprints. Both results show chain verification unavailable.

For the same fingerprint from the command line, run `node scripts/fingerprint.mjs <manifest.json>`.

From a study draft, select **Save policy preview**, download its revision, and compare the displayed digest with **Verify manifest**. Editing the draft leaves earlier previews available. These local previews carry no chain approval and cannot open collection.

Open **Histogram insights** to see the median and 90th-percentile bands calculated from the displayed fictional histogram. With a configured local contract, the browser also summarizes an uploaded result manifest after both its policy and result digests match. For profile setup and CLI verification, see the [local commitment verifier](docs/protocols/LOCAL_LEDGER.md).

## Check

```powershell
npm run check
npm test
npm run test:browser
```

Browser smoke tests use installed Edge or Chrome and ephemeral storage. Set `CHROMIUM_PATH` to override browser selection. Set `BLINDBENCH_CAPTURE_DIR` to capture local screenshots. `npm run check` checks JavaScript syntax. All server and browser dependencies for this foundation are supplied by Node.js and Chromium.

`npm run typecheck` checks the shared study policy and form validator with pinned TypeScript. It needs registry access when the compiler is uncached. `npm run check:topology` resolves Compose configuration and checks published ports, privilege flags, and mounts without starting containers.

The separate **private aggregation spike** runs with `npm run test:protocol` on a host that can run Linux containers through Docker Compose and reach npm and the image registries. It provisions two Janus services and a collector, asks Chromium to generate encrypted reports for a fixed fictional fixture, and asserts the exact result inside the test harness. The command and current verification status are in [protocol compatibility](docs/protocols/COMPATIBILITY.md).

Study drafts can queue an isolated fictional fixture. The study page provides a command for the local Docker worker. Refresh the page for its result after completion. To exercise draft creation, the queue, the real Docker worker and the receipt with a disposable database, run `npm run test:study-protocol`. Run the pinned upstream histogram vectors with `npm run test:upstream`.

The dashboard and offline browser tests run directly with Node.js and require zero containers. The fictional protocol probe can also run against three separately provisioned native Janus services. See the [native fixture instructions](docs/protocols/NATIVE_FIXTURE.md).

## Architecture

The browser receives server-rendered HTML and small client modules. Draft mutations go through a loopback HTTP boundary to SQLite. Fingerprinting and the sensitivity example run locally in the browser. The verifier optionally reads a trusted loopback RPC endpoint. The intended protected flow adds official membership verification, separated aggregators, and a restricted privacy collector. See [architecture](docs/ARCHITECTURE.md), [threat model](docs/THREAT_MODEL.md), and the [full specification](docs/BLINDBENCH_SPEC.md).

| Available | Current integration gate |
| --- | --- |
| Homepage, workspace and persistent synthetic drafts | Browser-generated private reports and known two-aggregator histogram |
| Interactive sensitivity example and values table | Differentially private release with one immutable approved result |
| Browser and CLI manifest verification tested with an RPC stand-in | Live Anvil deployment and contract checks |
| Deterministic fictional histogram summaries and tested SQLite backup/restore | Approved differentially private publication |

The workspace accepts fictional study configuration only. Private report submission and publication are closed. The benchmark view has no protocol results yet. See [progress](docs/PROGRESS.md), [quality evidence](docs/QUALITY_REPORT.md), and [operations](docs/RUNBOOK.md).
