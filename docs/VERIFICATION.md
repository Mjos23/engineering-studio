# Verification record

Checked September 23, 2026. All client data used for verification is fictional.

## Confirmed locally

- 40 core behavior tests passed: independent workspaces, money validation, import/recovery, checkpoint preservation and stale evidence.
- 20 GitHub connector tests passed with controlled REST responses. They cover request validation, UTF-8 source, branch protection, conflict handling, workflow state, session cancellation and diagnostics.
- 8 practice-workflow tests passed, including malformed input rejection, exact output matching, compilation failure and bounded compiler annotations. Process responses were controlled; these are not proof of a live .NET build.
- Five browser integration scenarios passed with mocked GitHub REST calls: pending file loads preserve newer typing; practice connections preserve product release settings; C# results stay with their submitted lesson; a file loaded from one repository cannot be saved through another connection; new source files remain local until a reviewed commit and omit an overwrite SHA.
- The 29-check browser walkthrough passed in both hosted and standalone modes and exercised menu and staff editing, exact-cent prices, QR generation, ticket evidence, cart debugging, checkpoint recovery, backup import, ZIP export, conflicting tabs and responsive layouts at 390, 768 and 1440 pixels.
- The walkthrough uses Playwright’s matching Chromium build (151.0.7922.34). An initial mismatch with installed Chrome 153 caused intermittent frame-rendering failures in the test harness; no sandbox protection was relaxed. Native app-browser inspection also confirmed the hosted practice page renders and the cart checks report six passes. The isolated preview denies parent document, storage and network access.

## Remote compiler verification

All five C# starters (money, validation, records, tenants and retries) compiled and executed successfully with .NET SDK **10.0.401** in an isolated Windows verification workspace. Full expected output matched; no product dependencies or customer data were used. Source hashes and observed output are recorded in [C# starter evidence](csharp-starter-evidence.json). This verification SDK is not a requirement for Studio users.

The private repository also includes `Studio verification` for remote checks. [GitHub run 35882057303](https://github.com/Mjos23/engineering-studio/actions/runs/35882057303), revision `97e697d6ecf82b7653b98289e2c20a77e8ca7848`, was **blocked before any job steps started**: GitHub reported recent payment failures or a spending limit. This is not a successful CI run and is not a C# compilation failure. Account Actions access must be restored before browser cloud builds can be verified. No billing settings were changed.

The separate `Studio C# practice` workflow compiles an explicitly submitted browser draft. Shipped-starter CI does not certify a later edited draft. A queued workflow is never treated as a passing result.

## Boundaries

No production restaurant was created or modified. No staff invitation, deployment, payment or customer order was sent. A product-specific authenticated integration is still required for those operations. Browser drafts are local, not a shared live database. A successful studio check does not certify the separate product's security, deployment or customer experience.

Original prototype files and the historical browser draft remain in local backups and are excluded from this repository.
