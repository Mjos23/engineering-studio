# Engineering Studio

A browser workspace for the work between the big ideas: guided delivery tickets, client configuration, small code changes, debugging and review evidence. Routine use makes **no AI calls**.

**Open `Open Engineering Studio.html` in Chrome or Edge.** It is a self-contained file: no terminal, local server, package installation or local .NET SDK is needed. Keep it at the same path and use the same browser profile to retain its browser-local drafts. Back up before moving it, clearing browser data or switching devices.

Source repository: [Mjos23/engineering-studio](https://github.com/Mjos23/engineering-studio) — private. Each unrelated product should keep its own repository and studio workspace.

## Start your first delivery

1. Open the studio and set your name using **ME**. The Harbor & Lime example is fictional; replace it with the client’s agreed details, or create a fresh workspace with **+**.
2. Follow **Your delivery path**. Ten tickets cover the brief, tested release, restaurant workspace, presentation, menu, staff roles, ordering entry point, acceptance, debugging and handoff. Each ticket has steps, explanations, hints and acceptance criteria.
3. Use **Client setup** to prepare a menu, proposed staff accounts and the approved ordering URL. The phone illustration reflects your draft. The QR encodes the exact supplied URL locally.
4. Use **Build room → Guided practice** to edit HTML/CSS/JavaScript, run the isolated preview and test a known cart bug. Five C# lessons include complete editable programs and reference outputs. Checkpoints let you return to a working practice draft.
5. Use **Build room → Product repository** for connected source editing. Browse files, create a work branch, load a file, review and save a commit, and read build results. Default-branch saves are blocked. Existing file SHAs protect against overwriting newer edits.
6. Run **Quality checks**, record real acceptance observations, then assemble **Release desk** evidence. Download the handoff ZIP and ask an independent reviewer to assess it.

## C# and product builds from the browser

The browser editor uses **GitHub Actions** as the compiler. Connect with a fine-grained token entered into the studio, limited to the selected repository: Contents and Actions read/write, plus Checks read for inline compiler diagnostics. The token remains only in the current page’s memory; it is not stored or exported. Disconnect or close the page to clear it. Do not put credentials in code, notes or client packages.

For the five C# lessons, connect `Mjos23/engineering-studio`, which includes `.github/workflows/studio-csharp.yml`. Select **Run C# on GitHub**, review the request, then **Refresh run**. Compilation, execution and output comparison happen in a bounded GitHub runner. A queued run is not a passed check. Changed source needs a new run; the submitted lesson source is distinct from the workflow’s commit.

For a real product, connect its separate repository and use its reviewed CI-only workflow. Release evidence must match the configured workflow, product repository and exact commit. The C# practice workflow cannot serve as product-release evidence. See [GitHub connection](docs/GITHUB-CONNECTION.md).

## What is—and is not—connected

Working locally: multiple independent workspaces, draft persistence, ticket notes, menu and staff-plan editing, exact-cent validation, QR generation, browser code execution/checks, C# editing, checkpoints, diagnostics, JSON backups and ZIP exports. Original v1 studio backups can be imported into additional workspaces without replacing current work.

Working with a GitHub connection: repository file browsing, branch creation, conflict-aware single-file commits, explicit workflow requests, exact-revision workflow results and compiler annotations when available.

**Production operations still need a product-specific authenticated adapter.** The studio does not currently deploy the restaurant application, provision a real restaurant, change its live menu, invite staff, or send production orders. The client package is a draft schema. Checkmarks are recorded reviews; production claims require real environment evidence. The required integration contract is documented in [Product connection](docs/PRODUCT-CONNECTION.md).

Browser drafts do not synchronize between teammates. Share a backup/handoff copy and coordinate source work through branches and pull requests. The **ME** name is a notes label, not an authenticated account. The HTML/CSS/JS practice preview blocks network connections and access to the studio’s storage. Exported source runs outside that preview isolation and should be reviewed before execution.

## Lowest-cost starting point

As checked September 23, 2026:

- [GitHub Free](https://github.com/pricing): private repositories and 2,000 Actions minutes per month, shared by repositories owned by the account or organization. [Included quotas](https://docs.github.com/en/billing/reference/product-usage-included) also list 500 MB of Actions artifact storage.
- [Cloudflare](https://www.cloudflare.com/plans/): free static hosting options and Access for up to 50 users. Hosted private team access requires configuring Access; a private GitHub repository alone does not make a website private.
- The standalone file works without hosting. The studio itself has no AI API dependency or token charge. Your existing product hosting, databases and other services keep their own costs.

The initial additional platform cost can be $0 within the relevant allowances. Check the account’s budget controls and disable paid overages if you need a hard spending ceiling. No paid plan or billing setting was changed by this build.

## Source and verification

`engineering/` contains the modular source and local data. `Open Engineering Studio.html` bundles those assets for direct browser use. Rebuild it after source edits with `node scripts/build-standalone.cjs` (maintainer task only). For optional HTTP development, serve this project root on loopback and open `/engineering/index.html`.

See [Verification](tests/README.md) and [build verification record](docs/VERIFICATION.md). CI checks JavaScript syntax and workspace/connector rules and actually compiles and executes all five C# starters using .NET 10. CI and the practice workflow use no application credentials or customer data.

Original preservation records, the original four-file prototype and the saved v1 browser draft remain in this local project's `backups/` folder. They are excluded from the new source repository and any hosting package. The original Tide Casa application remains separate.
