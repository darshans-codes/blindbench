# Project brief

BlindBench gives an interviewer a local workstation for inspecting how a private histogram is built, released and verified. Its running example is a fictional compensation study with fixed annual INR lakh bins. All data is synthetic.

The demo journey starts on the homepage, enters the study workspace, inspects the frozen policy, contributes privately, observes the replay defense, releases an aggregate and verifies its public manifest. Browser actions must reflect real state. Each trust assumption is visible at the step where it matters.

| Gate | Acceptance |
| --- | --- |
| Private computation | Two independent aggregation services, browser encryption, exact known histogram asserted only in a restricted synthetic harness |
| Participation | Official membership proof verification, report binding, scoped nullifier, durable replay handling |
| Release | One privacy-budgeted immutable histogram, minimum batch, no exact public statistics |
| Audit | Chain-backed commitment and independent manifest verifier with failure states |
| UX | Responsive homepage, accessible navigation and actionable errors across the working journey |
| Evidence | Reproducible checks and measurements, with limitations and architecture in the README |

The release, identity and transport gates can be developed independently. Unless they pass, participation remains closed and the website names the missing capability. The 25% push requires T01–T05 in the master specification.
