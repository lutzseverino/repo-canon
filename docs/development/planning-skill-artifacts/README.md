# Planning skill runtime artifacts

These files are copies of reviewable outputs from the authoritative disposable
repositories. They preserve the result without turning scenario-specific plans,
tracker records, prototype code, or setup instructions into Repo Canon product
behavior. Each copy is byte-identical to the fixture output except the Wayfinder
map: its two decision links name tracker files that only ever existed in the
disposable repository, so they are kept as plain text and this repository's
documentation-navigation check passes. The SHA-256 column identifies the
retained copy.

| Artifact | Source fixture revision | SHA-256 |
| --- | --- | --- |
| [Adoption inspection](adoption-inspection.md) | `f44ed880d3dae67233b3734d7de0dadb01e7a9c9` | `08fc08d369a87986d06e562f0672743fe4851c9806727d6caa2f1187bf733e4d` |
| [Managed skill update boundary](managed-skill-update-boundary.md) | `77adf0440eaf96ae1a70aedfa14655ea7804877f` | `4e3e9aeed4cbe9cd109f5e5515d7f4c95b2f02108098f68058bc79403e68b457` |
| [Native specification](intake-batch-spec.md) | `221f86aa76c41a41f2a3dad37e340fd070d9cabc` | `f1d6cdb7609e68e6162397ac639e8fe9246e4b84c9da5c602898760005f72e68` |
| [Public endpoint ticket](intake-batch-ticket-01.md) | `373c1e11b9982e04352d80baa43fae4fe2b56627` | `ca2c9146707d4b56a1094a7dbe9e14557a0888df34e6756823b83a9e45472500` |
| [Atomic conflict ticket](intake-batch-ticket-02.md) | `373c1e11b9982e04352d80baa43fae4fe2b56627` | `fcf557833708ceb15a21ebb3a867940671a89e111778ba23f5d5634a1f7fd303` |
| [Triaged request](receipt-export-triage.md) | `0760a3c0e5d7c52a042bb59d416c1311f443d8c6` | `c0cfaae823ee685d1ff583ff29f16795fdf76cfbd5f96303561e04974318010f` |
| [Wayfinder map](retry-map.md), links plain | `7f081ec55b712ab90d2e9d1b8ac995dab35b5f20` | `9192a96367601a77f96222070d1711ecbfc9d930daeceb3aebb2398fa62125d6` |
| [Wayfinder ticket](retry-window-ticket.md) | `7f081ec55b712ab90d2e9d1b8ac995dab35b5f20` | `1c9ed323827f4439ffbe099b5c846c7f53f88886798db52a6c7fdd102ee019ea` |
| [Logic prototype](delivery-schedule-cancellation-prototype.html) | `3f9ea86d00c1dd5b01df327dd2bc27417357b913` | `7ff30e9a7d100a0e7137a6221c10e10975443e033eb5cafa3175ac4573dd7be4` |
| [Prototype verdict](delivery-schedule-cancellation-verdict.md) | `3f9ea86d00c1dd5b01df327dd2bc27417357b913` | `d8b0205a88ee0261b19ce85cee756444f48ed8cc78d80679a6459306b8e9f06c` |
| [Sandbox wizard](setup-parcel-sandbox.sh) | `ed02b83d08830306273c5ec159204a5dfbf97d4b` | `6e00e8e83d01fb8393b60e88bf4b567aaee8d65b5827a8476bd829e00620f76d` |

The executable bit on the wizard copy is retained for static syntax checks.
It must not be run against the fictional URL, and it is not an adoption
operation.
