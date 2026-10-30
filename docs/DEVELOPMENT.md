# Development Guide

## Requirements

The SDK is a TypeScript package using tsup. Install a supported Node.js LTS release and npm, then install dependencies:

~~~bash
npm install
~~~

## SDK scripts

~~~bash
npm run build
npm run dev
npm run typecheck
~~~

- build: creates ESM, CJS, declaration files, and an IIFE bundle via tsup.
- dev: runs tsup in watch mode.
- typecheck: runs TypeScript without emitting output.

The inspected SDK package manifest does not define a test script. SDK unit/integration test coverage remains work to do before release readiness.

## Suggested SDK workflow

1. Read the [architecture](ARCHITECTURE.md) and [API contract](API-CONTRACT.md).
2. Run npm run typecheck before making changes.
3. Add a focused test for each behavior change.
4. Run typecheck, tests, and npm run build.
5. Inspect generated declarations and bundles when public API changes.
6. Update the [roadmap](ROADMAP.md) and relevant technical document whenever behavior or endpoint schemas change.

## Working with the Auth Worker

The Worker currently lives in the [NinjaURL repository](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its dedicated repository transfer is a future task and has not been performed.

Worker CI is defined in .github/workflows/workers-ci.yml in that repository. The audited branch includes typechecks and unit tests for the Workers, plus PostgreSQL integration tests for refresh/logout concurrency.

### Verified backend scenarios

The following CI runs completed successfully on branch test/auth-refresh-concurrency-rt001:

- [RT-001 — concurrent refresh with stale invalid_grant](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41073531083)
- [RT-002 — logout during concurrent refresh](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41078846722)

Both tests use real PostgreSQL persistence on the Neon test database and mock identity-provider HTTP responses. They are focused integration tests, not live Authgear end-to-end tests. The branch has not been merged or deployed.

### Test boundaries

A green test means the asserted invariant held for the tested execution. It does not establish that every possible ordering, timeout, provider behavior, or network failure has been tested.

When a new concurrency issue is found:

1. Reproduce and describe the exact interleaving.
2. State the invariant that must hold.
3. Add a regression test before changing implementation where practical.
4. Verify persisted database state, not only HTTP responses.
5. Record which dependencies are real and which are mocked.
6. Add the scenario to the [API contract verification record](API-CONTRACT.md#backend-concurrency-verification).

## Security checklist

- Keep PKCE verifier and OAuth transaction data short-lived.
- Validate callback state before exchanging the authorization code.
- Remove transaction data after success and all error/cancellation paths.
- Never log access tokens, refresh tokens, session secrets, or PKCE verifiers.
- Keep secrets and database access in the Worker, not in the browser SDK.
- Use HTTPS in production and explicit environment configuration.
- Treat untrusted response bodies as unknown; validate them before accessing nested properties.
- Test fetch failures, non-JSON server responses, provider errors, and authorization cancellation.
- Keep product-specific roles and permissions in the consuming product, not in Ninja Connect.

## Pull request checklist

- [ ] Typecheck passes.
- [ ] Tests added/updated and pass.
- [ ] Build succeeds.
- [ ] SDK and Worker contract stays aligned.
- [ ] Documentation and roadmap are updated.
- [ ] Security-sensitive invariants are covered by focused tests.
- [ ] No secrets or generated local files are committed accidentally.
- [ ] No merge, deploy, or release is performed without explicit approval.
