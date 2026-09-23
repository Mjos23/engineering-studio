# Browser builds with GitHub

Keep Engineering Studio in its own repository, for example `your-team/engineering-studio`. Put each unrelated product in a separate private repository. The same Studio can connect to one selected repository at a time; each engineer uses their own account and token. A repository is shared source history, while Studio drafts and notes remain in that engineer's browser until exported or explicitly saved.

## Cost-conscious starting point

GitHub Free is a suitable starting point for private team repositories and occasional Linux builds. It includes 2,000 Actions minutes per month and 500 MB of artifact storage for Free personal accounts and Free organizations. These allowances are shared at the owning account or organization level, not granted anew for each repository. Start with included usage, review billing limits, and avoid enabling paid usage until needed. Extra usage is not automatically free. The included lesson workflow uses a standard Ubuntu runner, a five-minute job limit and one-day artifact retention. Studio itself makes no AI API calls.

These figures were checked on September 23, 2026. See [included product usage](https://docs.github.com/en/billing/reference/product-usage-included) and [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions). Hosting the Studio and running a restaurant's production service are separate decisions; this connection does not provision hosting, a database, or production deployment.

## One-time owner setup

1. Create the private Studio repository under your own account or organization. Initialize it with a README so it has a default branch. Upload the Studio project files, including `.github/workflows/studio-csharp.yml`. A workflow must exist on the default branch before manual dispatch is available. Browser upload may hide dot folders; create the workflow file by its full path using GitHub's **Add file → Create new file** if necessary.
2. Enable GitHub Actions for the repository. Allow the official `actions/setup-dotnet` and `actions/upload-artifact` actions. The workflow pins their revisions and requires no checkout or secrets. The practice workflow belongs in the Studio repository or a dedicated practice repository, not a production deployment repository.
3. Open the bundled **Open Engineering Studio.html** directly in Chrome or Edge, or serve the **engineering/** folder over HTTPS for your team. Only the modular **engineering/index.html** requires HTTP to fetch its JSON; the bundled file embeds everything. Protect a hosted team site with your approved sign-in. Compilation runs on GitHub's hosted runner.
4. Invite each engineer through GitHub. Give only the repository access they need. Each engineer creates a short-lived [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), restricted to the selected repository, with **Contents: Read and write**, **Actions: Read and write**, and **Checks: Read**. Checks read permission lets Studio show compiler diagnostics without leaving the workspace. Metadata read access is included by GitHub. Organization policy may require approval. Editing workflow files additionally needs **Workflows: Write**; the normal Studio connection does not require this if workflows are installed by the owner first.
5. In Studio's GitHub connection, enter `owner/repository` and your token, then connect. The token stays in page memory and is discarded on disconnect, refresh, or tab closure. Do not share tokens, put them in source files, paste them into notes, or include them in client exports. Use only your trusted copy of Studio; any script on a compromised page could read credentials entered there.

No account, repository, token, hosting, or external workflow is created automatically by the local Studio project.

## Everyday branch work

1. Connect to the appropriate product repository. Select a work branch, or create one from the selected full commit SHA. Name it for the change, such as `work/menu-validation`.
2. Choose a text file from the repository browser or enter its full repository path. Use **New file** for a local draft, optionally starting from a C# class, Blazor component or JSON template. Adapt placeholder names to your product. Studio supports UTF-8 files up to 1 MB. The browser omits obvious binary files, generated build folders and dependencies. A truncated GitHub tree produces an explicit error instead of a misleading partial file list. Read the current code and make a narrow change.
3. Review the target repository, work branch, file, and commit message before saving. A save creates a real GitHub commit. Studio refuses edits to the repository's current default branch. It includes the file's loaded blob SHA so GitHub can reject a conflicting overwrite. On conflict, reload and compare your draft; never blindly replace a teammate's change.
4. Run the product repository's configured build workflow. The owner must supply a real build/test workflow for that product and any required non-secret inputs. The practice workflow below tests lesson source only; it is not the restaurant application's build pipeline.
5. Wait for completion and inspect the run for the exact commit you intend to review. `queued` and `in progress` are not passing checks. A passing run on an older commit is not evidence for a newer edit. Compare the selected SHA, completed status, conclusion and failed steps. Open the linked GitHub run for full build logs when needed.
6. Use your team's pull request, review and release process. Studio does not merge, deploy, configure a live restaurant, or assert that customer ordering works merely because a workflow passed.

## Running a C# lesson from the browser

Connect to the repository containing `studio-csharp.yml`. The Studio submits the current lesson source, expected output, lesson identifier and a unique request identifier as workflow inputs. Source and expected output use UTF-8 Base64, not shell fragments. GitHub limits all dispatch inputs to 65,535 characters; Studio applies a conservative 65,000-byte request ceiling. Typical short lessons fit comfortably; larger programs should be committed and built through a product workflow.

The workflow selects .NET 10, writes a standalone `Practice.csproj` with no package references, clears NuGet package sources, compiles the source and runs it with a ten-second execution limit. It checks the exit code and compares standard output with expected output, normalizing line endings and trailing newlines. It retains a small `studio-lesson-evidence` artifact for one day, containing console diagnostics plus source and expected-output SHA-256 hashes. No local C# installation or ChatGPT interaction is needed for this connected path.

The run's GitHub commit SHA identifies the workflow version. The submitted lesson is a separate source snapshot identified in `evidence.json`; a successful lesson result only applies to that snapshot. Changing the draft or expected output requires another run. A timeout, failed compilation, mismatched output, cancellation, or missing run is not a pass.

This is for trusted team practice code in disposable GitHub-hosted runners. It does not create a hardened multi-user C# execution service: compiled code can use runtime capabilities available to the runner. It has no checkout and does not pass deployment secrets or the browser token to the lesson process. Do not add secrets, use self-hosted runners, or run customer data through it. The workflow and expected output are editable by repository contributors; its result is build evidence, not an independent security audit or production certification.

## Connection errors

| Message | Next step |
| --- | --- |
| Job was not started: payments or spending limit | The account owner must review GitHub Billing & plans. Preserve the agreed spending ceiling. Rerun after Actions access is restored; this is a blocked build, not a code result. |
| HTTP 401 | Replace an expired or invalid token and connect again. |
| HTTP 403 | Check token permissions, organization approval, repository access, Actions settings and usage allowance. |
| HTTP 404 | Check the owner/repository, branch, file or workflow; GitHub also uses this response when the token lacks access. |
| HTTP 409 | Reload the changed file and compare the local draft before saving. |
| HTTP 422 | Check the file SHA, branch name, workflow input names and whether a branch already exists. |
| Rate limited | Wait for the indicated delay before refreshing. Avoid repeated clicks. |
| Network timeout after a save or run request | Refresh GitHub state first; the server may have accepted the operation even if the reply was lost. |

The connector displays job and step conclusions plus check annotations inside Studio. The lesson workflow emits a bounded failure annotation containing the actual compiler/runtime diagnostic or expected-versus-observed output. This needs **Checks: Read** on the fine-grained token; an HTTP 403 from that endpoint gives a specific permission message. The reader returns up to 100 annotations across the first 100 jobs, with at most 5,000 characters per message. Complete logs and the short-lived output artifact remain available on GitHub; the page does not download raw zipped logs. Product workflows must emit GitHub annotations or use compiler problem matchers for their diagnostic text to appear through this reader.

## Maintainer interface

Load `engineering/github.js` before the main application script. It exposes `window.StudioGitHub` with:

```javascript
const github = new StudioGitHub({ token, repository: 'owner/repository' });
await github.check(); // { login, repository, defaultBranch }
await github.branches(); // [{ name, sha }]
await github.listFiles(branchOrFullCommitSha); // [{ path, size }]
await github.loadFile('src/Program.cs', 'work/menu'); // { path, sha, content }
await github.saveFile({ path, ref, content, sha, message }); // { sha, commitSha, url }
await github.createBranch({ name: 'work/menu', sha: fullCommitSha });
await github.runs(branchOrFullCommitSha); // up to 100 recent runs
await github.dispatch({ workflow: 'build.yml', ref: 'work/menu', inputs: {} });
await github.run(runId); // includes jobs, steps and plain failure descriptions
await github.annotations(runId); // [{ path, startLine, endLine, level, message, title }]
github.disconnect();
```

`dispatch()` returns `{ queued: true, id, url, submittedAt }`. Current GitHub responses supply a run ID; older no-content responses return `id: null`. Correlate those by a unique `request_id` in the run's `title`, never by picking an arbitrary latest run. Runs also expose `sha`, `branch`, `status`, `conclusion`, `event`, `workflowId` and `createdAt`. Never turn enqueue acknowledgement into a passing result. Confirm remote mutations in the UI before calling them, render returned strings as text, and keep tokens out of storage, exports, URLs and telemetry.

API behavior follows GitHub's [repository contents](https://docs.github.com/en/rest/repos/contents), [Git references](https://docs.github.com/en/rest/git/refs), [workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), [job details](https://docs.github.com/en/rest/actions/workflow-jobs), [check annotations](https://docs.github.com/en/rest/checks/runs#list-check-run-annotations), and [workflow input limits](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatchinputs) documentation.
