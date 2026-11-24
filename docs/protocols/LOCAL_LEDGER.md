# Local commitment verifier

The verifier accepts an operator-configured Anvil endpoint on IPv4 loopback, chain ID 31337, the deployment address, the SHA-256 digest of the deployed runtime bytecode, and the ABI selector for `commitments(bytes32)`. It reads chain ID, a block number, code at that block and commitments at that same block. The browser sends a SHA-256 study key and the ABI selector to the configured RPC. Manifest bytes and histogram counts stay on the device.

The study key is SHA-256 over UTF-8 `blindbench/ledger/study/v1`, one zero byte and the lower-case manifest study UUID. The result digest uses the canonical v1 keys and the domain `blindbench/result/v1`. See [manifest implementation](../../public/manifest.mjs). An uploaded policy preview remains a draft fingerprint.

## Local deployment and verification

The contract pins Solidity 0.8.24. With Foundry installed, run `forge test`. Start Anvil on `127.0.0.1` and deploy `contracts/src/BlindBenchCommitments.sol:BlindBenchCommitments` with `forge create --broadcast` using a disposable Anvil account. The constructor takes the operator address. Keep the Anvil signing key outside project files. Restrict browser RPC access to the local workspace origin where the RPC server allows origin configuration.

Save an anchor profile under `.local`. Its four required strings are listed below.

| Key | Value |
| --- | --- |
| `address` | Lowercase address of the verified deployment, prefixed by `0x` |
| `codeSha256` | Lowercase SHA-256 of the actual deployed bytecode bytes, without a prefix. Obtain the bytes from the trusted deployment using `cast code` |
| `rpcUrl` | The approved Anvil endpoint, for example `http://127.0.0.1:8545` |
| `selector` | Lowercase output of `cast sig "commitments(bytes32)"` |

Set `BLINDBENCH_ANCHOR_PROFILE` to that file to configure the browser. For the CLI, run `node scripts/fingerprint.mjs <manifest.json> --anchor <profile.json>`. The CLI exits successfully only on `MATCH` when a profile is supplied. The checked-in example has a zero policy hash, so it serves as a fingerprint example. Use an isolated fictional result with its actual nonzero policy digest when exercising a synthetic commitment.

The operator commits a policy once, seals the study, then commits a result once. An abort before publication prevents later publication. A `MATCH` compares both digests to the published state and identifies the checked block. The verifier trusts the configured RPC and operator. Proof verification, report admission, differential privacy and computation correctness have separate verification requirements.

Browser, CLI and response-boundary tests passed against a disposable stand-in implementing the four JSON-RPC reads. The managed workspace lacked Foundry and Anvil, so contract compilation, execution and deployment still require verification.

[Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/) · [Solidity ABI](https://docs.soliditylang.org/en/latest/abi-spec.html) · [Foundry Anvil](https://getfoundry.sh/anvil/overview/)
