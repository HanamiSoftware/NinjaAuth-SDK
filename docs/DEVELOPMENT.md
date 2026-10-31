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

RT-001 and RT-002 use real PostgreSQL persistence on the Neon test database and mock identity-provider HTTP responses. RT-003 is a separate focused resolver/logout race test in `Workers/auth-worker/integration-tests/resolve-session-logout-race.integration.test.ts`; it uses real Neon/PostgreSQL state and a mocked upstream refresh response while exercising the real Worker logout route. CI run [41196276386](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41196276386) was reported successful by the project owner and should be independently rechecked. These are focused integration tests, not live AuthGear end-to-end tests. The branches have not been merged or deployed.

### Test boundaries

A green test means the asserted invariant held for the tested execution. It does not establish that every possible ordering, timeout, provider behavior, or network failure has been tested.

When a new concurrency issue is found:

1. Reproduce and describe the exact interleaving.
2. State the invariant that must hold.
3. Add a regression test before changing implementation where practical.
4. Verify persisted database state, not only HTTP responses.
5. Record which dependencies are real and which are mocked.
6. Add the scenario to the [API contract verification record](API-CONTRACT.md#backend-concurrency-verification).

## Next integration work — Extension and Web

Use a contract-first sequence:

1. Finalize extension API schemas and response/error envelopes before changing SDK call sites.
2. Keep the shared Core independent of Chrome APIs; platform-specific behavior belongs in adapters.
3. Define Web redirect/callback and transaction storage interfaces, including multi-tab and credentialed-cookie behavior.
4. Integrate the SDK into the extension background service worker; the sidepanel should communicate with the background rather than own OAuth state, PKCE, or session orchestration.
5. Validate login, session restore, logout, and login-again against the intended Auth Worker environment.
6. Add tests for success, cancellation, invalid state, malformed responses, network failure, and revoked/expired sessions.

AuthGear remains the current upstream provider. Do not hardcode provider-specific assumptions in the SDK public contract. OIDC Discovery and provider interoperability are planned work; provider secrets and token lifecycle remain server-side in Ninja Connect.

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
