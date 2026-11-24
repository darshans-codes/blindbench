# Private aggregation compatibility

| Component | Candidate pin | Source evidence |
| --- | --- | --- |
| Janus Leader, Helper and Collector | `0.7.148` interop image tags | [Janus release source](https://github.com/divviup/janus/tree/0.7.148) and [registry configuration](https://github.com/divviup/janus/blob/0.7.148/docker-bake.hcl). MPL-2.0. DAP draft 09. Cargo lock pins `prio` at `0.16.8` |
| Browser SDK | `@divviup/dap@0.9.1` | [Divvi Up release source](https://github.com/divviup/divviup-ts/tree/dap-v0.9.1). MPL-2.0. DAP draft 09, Prio3 and VDAF 0.8.0 from the release workspace |
| Browser runner | Playwright `1.58.2` and image digest in Dockerfile | [Microsoft registry manifest](https://mcr.microsoft.com/en-us/artifact/mar/playwright/tag/v1.58.2). Apache-2.0 |

The DAP-09 client deals with Janus's HTTP 200 upload erratum by accepting successful 2xx statuses. The fixture uses a seven-bin Prio3 histogram with chunk length 3, 30 reports, a 60-second time interval and one collection query. Both aggregators advertise a distinct X25519/HKDF-SHA256/AES-128-GCM public key. The collector provisions its own key and uses the interop collection start and poll endpoints. These choices follow the pinned sources and [DAP draft 09](https://datatracker.ietf.org/doc/html/draft-ietf-ppm-dap-09).

## Run the spike

```powershell
npm run test:protocol
```

The command requires Linux containers through Docker Compose and access to Microsoft Artifact Registry, the Janus image registry and npm. It creates a fresh project and tears down its disposable volumes on exit. The private Compose network publishes no ports. Each Janus container has its own PostgreSQL instance bound to that container's loopback address, and its startup script generates an independent datastore encryption key. The script supplies the key rotator config referenced by the pinned interop startup script. The interop admin endpoints are reachable within the disposable network, and the Docker host operator controls every container. This topology is for synthetic tests only.

Chromium receives the SDK bundle, the fixture inputs and both public HPKE configs. The harness uploads only the browser-generated encrypted report envelopes. It checks that an empty upload is rejected, repeats one envelope, and verifies that the collector's exact histogram and count match the fixture. Only stage outcomes and tool versions are printed. The app and its database are outside this run.

## Verification status

**The browser-to-collector probe passed on the user's Windows Docker host.** The run used Janus 0.7.148, Divvi Up DAP 0.9.1 and Chromium 145.0.7632.6. The screenshot shows readiness, browser-generated encrypted envelopes, acceptance of the valid batch, rejection of the empty envelope and an exact histogram match after retrying one envelope. The probe container exited 0 and Compose reported all four containers stopped. The outer wrapper did not visibly return to a prompt.

The revised wrapper separates the first image build from the probe timeout, starts the services detached, waits for the probe exit code, reads its logs and cleans up the disposable project. The user reported exit code 0 after this rerun. The managed workspace can find Docker but receives permission denied on the Linux engine pipe.

`npm run test:upstream` passed the named [libprio-rs 0.16.8 histogram vector test](https://github.com/divviup/libprio-rs/blob/fff80d421196dd9ac9cef970cd8a0b5f64341a64/src/vdaf/prio3_test.rs) with Rust 1.95.0 on the user's host. The next stage generated and uploaded encrypted reports and timed out polling the collector. The SDK bundle SHA-256 was `1877b9c1b3548522101d9c0a335a8380c23a56cfc4a2f0d4af98b103e076272e`.

The prior study query covered 24 hours using one-minute time buckets. [The pinned Janus implementation materializes empty shards](https://github.com/divviup/janus/blob/0.7.148/aggregator/src/aggregator.rs) across the queried buckets, so that configuration could require up to 46,080 shards in a role. The revised fixture uses the study window as the task's time precision and queries one completed bucket. The standalone fixture retains one-minute precision. Retest only the integrated stage with `npm run test:study-protocol`.

The Windows standalone run and pinned upstream vector satisfy T03 with the exact Janus tags shown in the pull output. The observed npm package integrity for DAP 0.9.1 is now required by the browser image build. The [Janus security page](https://github.com/divviup/janus/security) and [Playwright advisory page](https://github.com/microsoft/playwright/security/advisories) were checked for published project advisories. This source review covers the named releases. It does not establish a full transitive package or image scan. Retain Docker image digests on the next live run and complete the broader dependency review at T05.
