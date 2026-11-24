# Native fictional fixture

The web app and its SQLite store run directly on Node.js. The full private fixture also needs the pinned Janus 0.7.148 leader, helper and collector. Docker Compose is one way to provision them. This mode runs the same pinned browser and DAP fixture against native Janus interop services.

Use a Linux environment with Node.js, Rust, PostgreSQL and access to the upstream dependencies. Build the pinned Janus source and start the interop aggregator twice with separate loopback PostgreSQL instances and independently generated datastore keys. Start each aggregator's job drivers and key rotator as well as the native interop collector. Bind the interop endpoints to 127.0.0.1 on distinct ports. Use this interface only for generated data. See the [pinned deployment guide](https://github.com/divviup/janus/blob/0.7.148/docs/DEPLOYING.md) and [upstream interop setup](https://github.com/divviup/janus/blob/0.7.148/interop_binaries/setup.sh). The probe provisions a new random task within these services. The operator owns service lifecycle and removal of the disposable databases.

Install the fixture's browser assets from the project root:

```sh
mkdir -p .local/native-probe
npm install --prefix .local/native-probe --ignore-scripts --save-exact playwright@1.58.2
node .local/native-probe/node_modules/playwright/cli.js install chromium
npm pack --ignore-scripts --json --pack-destination .local/native-probe @divviup/dap@0.9.1 > .local/native-probe/sdk-package.json
tar -xOf .local/native-probe/divviup-dap-0.9.1.tgz package/dist/browser.js > .local/native-probe/divviup.js
```

The three numbers below are the ports of the already running interop leader, helper and collector, in that order. The fixture checks the exact package integrity and bundle digest before opening Chromium.

```sh
export BLINDBENCH_NATIVE_PORTS=18181,18182,18183
npm run test:protocol:native
npm run test:study-protocol
```

Local tests exercise port validation and all three native role routes with simulated peers. A live native Janus run is pending on a host that can launch those services. The current managed Windows workspace can run the dashboard and browser smoke tests. It received access denied from WSL and lacks native Rust and PostgreSQL tools.
