# Studio verification

The `Studio verification` workflow runs on pushes and pull requests. It uses an Ubuntu runner, a ten-minute limit and read-only repository permission. Actions are pinned to reviewed commit SHAs. It does not publish, provision clients or dispatch another workflow.

## Browser rules and GitHub behavior

From the repository root, with Node.js 24 or later:

```sh
node tests/core.test.cjs
node tests/github.test.cjs
```

The core suite has 40 deterministic behavioral checks. It covers independent workspaces, v1 migration and v2 backups, exact cents, invalid menus and staff plans, URL/table validation, import data loss, reserved keys, checkpoint recovery and stale evidence. Imports of automatic evidence are kept distinct from restoring an existing browser session. Tests use fictional data and write no repository files.

The GitHub suite checks the connector's request and response behavior using controlled responses. It does not prove live credentials, repository access or a successful remote build. The workflow also syntax-checks every top-level `engineering/*.js` file.

## Optional browser connection regressions

With Google Chrome installed, run these commands from the repository root:

```sh
npm install --no-save --package-lock=false playwright
node tests/browser-github.test.cjs
```

These five browser scenarios check that a pending file response cannot overwrite newer typing, connecting the practice repository preserves the chosen product repository, C# results stay with their requested lesson, a draft loaded from one repository cannot be committed through another repository connection, and a new source file requires a work branch and explicit commit review. They use the real interface and connector with controlled GitHub responses. All HTTPS traffic is intercepted, the token is fictional, and no repository or workflow is changed. Each scenario also checks that the token is absent from saved browser state and no uncaught page errors occurred.

By default the suite opens the current `engineering/index.html` from disk, injects the checked-in lesson data, and runs installed Chrome without displaying a window. No local web server is required. Optional environment variables are `STUDIO_TEST_URL` for a served instance, `STUDIO_BROWSER_CHANNEL` for another Playwright browser channel such as `msedge` or `chromium`, `STUDIO_PLAYWRIGHT_MODULE` for an existing Playwright module path, and `STUDIO_TEST_REPORT` for a JSON report output path. To use bundled Chromium, first run `npx playwright install chromium` and choose the `chromium` channel. The suite is optional and is not part of the basic Node-only CI checks.

## Optional full browser walkthrough

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium --only-shell
node tests/browser.test.cjs
```

The walkthrough defaults to Playwright's matching Chromium headless shell and opens `Open Engineering Studio.html` directly. Its 29 checks exercise menu and staff planning, ordering QR validation, ticket evidence and reopening, an actually rendered and clickable cart preview, an injected bug and its fix, continued preview logging, sandbox isolation, checkpoints, help search, workspace isolation, exports, a synthetic legacy import, competing browser tabs, and three screen widths. It makes no authenticated remote calls. Screenshots, fictional exports and the JSON results are written to ignored `test-results/`.

Set `STUDIO_TEST_URL` to run the same assertions against a hosted copy. `STUDIO_PLAYWRIGHT_MODULE` and `STUDIO_BROWSER_CHANNEL` can override the module and browser, but the matching browser is recommended: system Chrome 153 intermittently returned a blank sandboxed frame under Playwright during testing, while the matching Headless Shell 151 passed the visible-heading and real-click assertions. The suite does not weaken the iframe sandbox or replace rendering assertions with source-text checks. These browser checks are optional and do not consume GitHub Actions minutes when run locally.

## Actual C# starter execution

The final CI step reads all five preserved programs from `engineering/csharp-lessons.json`. A Python standard-library script in `.github/workflows/ci.yml` creates an isolated temporary .NET 10 console project for each program. It clears NuGet package sources, includes no package references, restores and compiles the actual source, then executes `dotnet run --no-build --no-restore`.

The complete standard output must match that lesson's `expected` value, allowing only line-ending differences and terminal newlines. A compile error, nonzero exit, timeout or output difference fails the check. Successful runs record the tested revision, SDK and source hashes in the GitHub job summary. Temporary projects are removed after the check; committed source files are not changed.

This verifies the shipped C# starters. It does not verify an edited browser-local C# draft, a live restaurant, production deployment, authorization against a real service or a customer's order. An edited lesson requires its own explicit connected practice run and result.

## Evidence and action pins

The action revisions were checked against their official release/tag references:

- [actions/checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1): `3d3c42e5aac5ba805825da76410c181273ba90b1`
- [actions/setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0): `820762786026740c76f36085b0efc47a31fe5020`
- [actions/setup-dotnet v5](https://github.com/actions/setup-dotnet/tree/26b0ec14cb23fa6904739307f278c14f94c95bf1): `26b0ec14cb23fa6904739307f278c14f94c95bf1`, shared with the C# practice workflow.

When updating a pin, verify its official repository and rerun this workflow. A green result applies to the revision named by that run.
