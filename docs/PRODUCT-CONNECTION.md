# Connecting a real product

Engineering Studio owns the reusable browser workspace. Each unrelated product keeps its own source repository, release process, runtime, accounts and client data. A product workspace records which repository and environment it concerns.

## Working now

- Browse a connected repository, load text source, create a work branch and save a single-file commit with a current blob SHA. Saving refuses the default branch and detects file conflicts.
- Request an existing reviewed CI-only workflow; read its real job status. A queued request is not a pass.
- Match a workflow result to an exact product repository and 40-character commit before attaching evidence. A single successful workflow is not proof that all required checks passed.
- Run the five editable C# examples in the supplied GitHub workflow; the source is an explicit input and is distinct from the workflow commit.
- Prepare a versioned restaurant draft, menu CSV, proposed staff roles, an exact-link QR, review notes and a handoff ZIP.

## Remaining product integration

No production adapter is configured. The Studio does not deploy the restaurant application, create tenants, invite staff, mutate a live menu or submit production orders. The JSON package is a draft format, not an asserted existing application API contract.

To implement an adapter, the product owner must identify the real documented operations and authorization model for:

1. **Release promotion:** approved environment identifier, tested immutable commit, required checks, deploy action, readback of actual running revision, and rollback operation.
2. **Restaurant workspace:** tenant creation, slug availability, idempotency, configuration validation and authoritative readback.
3. **Menu changes:** accepted schema, integer-cent currency rules, availability, version/conflict handling and readback.
4. **Staff access:** supported role names and permissions, invitations, reviewable proposed recipients, authenticated authorization and access revocation.
5. **Ordering:** authoritative tenant/table link generation and approved test-order flow.

Every write should have an exact review screen showing the product, environment, tenant and intended change. The server must authorize each operation independently. Repeated requests must not create duplicate workspaces, invitations or orders. A successful response should be followed by authoritative readback; failed or uncertain writes must remain visibly unresolved.

Product credentials belong in the product's authenticated server/session integration, never in a repository, client export, URL, or local browser backup. A public static site alone cannot safely hold shared production credentials. Cloudflare Access controls entry to a hosted studio; it does not replace the product API's tenant and role authorization.

## Team workflow without AI calls

Assign one owner to a delivery ticket. Work in a product work branch. Make one small change, run the real checks, record the result and request an independent review. JSON backup sharing transfers a copy; it does not merge drafts or provide live co-editing. Coordinate source changes through repository branches and pull requests. The person or team approving launch remains accountable for the acceptance evidence.
