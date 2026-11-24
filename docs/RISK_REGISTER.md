# Risk register

| Risk | Severity | Likelihood | Mitigation | Review | Status |
| --- | --- | --- | --- | --- | --- |
| DAP draft and VDAF versions diverge | High | High | Test a pinned browser and Janus pair with known histograms, negative fixtures and replay checks | T03 | Runtime pending |
| Common host can observe both aggregation domains | High | Certain locally | Separate runtime, credentials and keys. Document common host trust | T04 | Open |
| Admission replay or proof substitution | High | Medium | Bind proof to study and ciphertext, reserve nullifier atomically, reconcile retries | T07 | Open |
| Release retries spend privacy budget again | High | Medium | Persist a single immutable release before anchoring | T09 | Open |
| Threshold status reveals participation | High | Medium | Omit exact counts and qualify the DP guarantee | T09 | Open |
| Offline development blocks reproducibility | High | Observed | Check local dependency cache, verify launch with available runtime, document integration prerequisites | T02–T04 | Active |
| Local chain resets lose commitments | Medium | High | Pin verifier chain settings and document local reset behavior | T11 | Open |

Implementation owner tracks these items in the milestone ledger.
