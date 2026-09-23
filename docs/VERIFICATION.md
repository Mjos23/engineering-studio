# Verification record

Checked September 23, 2026. All client data used for verification is fictional.

## Confirmed locally

- 40 core behavior tests passed: independent workspaces, money validation, import/recovery, checkpoint preservation and stale evidence.
- 20 GitHub connector tests passed with controlled REST responses. They cover request validation, UTF-8 source, branch protection, conflict handling, workflow state, session cancellation and diagnostics.
- 8 practice-workflow tests passed, including malformed input rejection, exact output matching, compilation failure and bounded compiler annotations. Process responses were controlled; these are not proof of a live .NET build.
- Four browser integration scenarios passed with mocked GitHub REST calls: pending file loads preserve newer typing; practice connections preserve product release settings; C# results stay with their submitted lesson; a file loaded from one repository cannot be saved through another connection.
- The browser walkthrough exercised menu and staff editing, exact-cent prices, QR generation, ticket evidence, cart debugging, checkpoint recovery, backup import, ZIP export, conflicting tabs and responsive layouts at 390, 768 and 1440 pixels.
- Native app-browser inspection confirmed the hosted practice page renders and the cart checks report six passes. The isolated preview denies parent document, storage and network access.

## Remote compiler verification

The private source repository includes `Studio verification`, which compiles and executes all five C# starter programs with .NET 10 and compares their complete output. The definitive result belongs to the exact revision shown in [GitHub Actions](https://github.com/Mjos23/engineering-studio/actions).

The separate `Studio C# practice` workflow compiles an explicitly submitted browser draft. Shipped-starter CI does not certify a later edited draft. A queued workflow is never treated as a passing result.

## Boundaries

No production restaurant was created or modified. No staff invitation, deployment, payment or customer order was sent. A product-specific authenticated integration is still required for those operations. Browser drafts are local, not a shared live database. A successful studio check does not certify the separate product's security, deployment or customer experience.

Original prototype files and the historical browser draft remain in local backups and are excluded from this repository.
