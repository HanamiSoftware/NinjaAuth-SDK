# NinjaAuth â€” Roadmap and implementation status (dev)

> **Last reviewed:** 2 November 2026  
> This is the only authoritative roadmap for the NinjaAuth SDK and its integration with Ninja Connect. The repository-root ROADMAP.md has been retired; use this document.

## Executive status

NinjaAuth Core 0.1 is **not release-ready**. The central architecture is defined, three focused Auth Worker concurrency scenarios have passed PostgreSQL integration tests, and the SDK source already implements the main Chrome authorization-code flow, including PKCE, UUID state, callback-state comparison, JSON code exchange, and basic response validation. The remaining Core work is concentrated on environment-aware endpoint configuration, robust session handling, logout, end-to-end verification, automated SDK tests, and explicit handling of the not-yet-supported Web platform.

The backend test results below are branch-only evidence. They have not been merged or deployed.

## Architecture decisions â€” agreed

- Ninja Connect is the central Identity Broker for shared authentication, identity, and session lifecycle.
- NinjaAuth is a client SDK and can be used by first-party Ninja products and independent third-party developers.
- Ninja Connect owns shared identity and central session management; it does not own each application's business authorization.
- Each consuming product owns its own profile, roles, permissions, capabilities, and application data.
- The optional NinjaAppAdapter<TProfile> is an anti-contamination boundary for first-party product profiles. It is not an OAuth provider/platform adapter and is not required for standalone SDK use.
- Product-specific RBAC must not be moved into Ninja Connect.
- The experimental /v1/state endpoint is not a required part of the SDK flow and may be removed. Do not make the SDK depend on it without an explicit architecture decision.
- No Worker repository transfer, merge, or deployment is included in the completed test work.
- AuthGear is the current upstream identity provider, not the owner of Ninja Connect application sessions. AuthGear SSO sessions and Ninja Connect `auth_sessions` records are separate lifecycles.
- The public NinjaAuth API must remain provider-neutral. AuthGear-specific endpoints, credentials, refresh tokens, and provider secrets remain behind Ninja Connect; OIDC Discovery/interoperability is a planned capability.
- `login()` starts the interactive authentication flow; `getSession()` observes and returns the current session state without starting login. Only an explicit `401 INVALID_SESSION` is normalized to unauthenticated; other authorization errors and temporary failures remain errors.

## Completed and verified work

### Auth Worker reliability â€” RT-001, RT-002, and RT-003

**PASS â€” focused integration tests**

| Test | Invariant | Result |
|---|---|---|
| RT-001 â€” concurrent refresh | A stale concurrent invalid_grant must not revoke a session whose refresh token was already rotated by another request | PostgreSQL integration test passed |
| RT-002 â€” logout during refresh | Logout must prevail over refresh operations that are still in flight; refresh must not reactivate the revoked local session | PostgreSQL integration test passed |
| RT-003 â€” logout before resolver return | A session revoked before the resolver's final revalidation must not be returned as authenticated | Focused PostgreSQL integration test; CI owner-reported successful |

## Test status

- RT-001/RT-002 branch: `test/auth-refresh-concurrency-rt001` in [NinjaURL-URL-Shortener](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener).
- RT-003 branch: `test/authgear-refresh-live-diagnostic` in the same repository.
- [RT-001 CI run 41073531083](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41073531083) â€” success.
- [RT-002 CI run 41078846722](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41078846722) â€” success.
- PostgreSQL persistence is real (Neon test database); identity-provider HTTP responses are mocked.
- The test branches have not been merged or deployed.
- RT-003 implementation commit: `7d89d4412cd85727578225517b8f03ed58f71aa3`; regression test commit: `65c8127377ebcb3c8712452f223a07fd0b1649d1`.
- RT-003 test: `Workers/auth-worker/integration-tests/resolve-session-logout-race.integration.test.ts`; it uses real Neon/PostgreSQL state, a mocked upstream refresh, and the real Worker logout route. CI run [41196276386](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41196276386) was reported successful by the project owner; recheck before treating it as independently audited evidence.

The implementation uses conditional database updates and a final session re-read as concurrency guards. These are not distributed locks. The tests prove the specific scenarios they orchestrate, not all possible race conditions.

### RT-003 â€” final session revalidation before authenticated return

**PASS â€” focused integration test added; CI reported successful by the project owner.**

`resolveSession()` now performs a final read of the session row after refresh and user lookup, before returning an authenticated context. A missing, revoked, absolutely expired, or ordinarily expired session is rejected. This covers a logout that commits before the final read; it cannot prevent a logout that commits immediately afterward.

### Additional backend improvement

- The logout route closes its database client in a `finally` block, including error paths.

## Current SDK worktree snapshot

**Status boundary:** the repository's default branch may not yet contain the latest local edits described below. These notes record the developer's reported working-tree progress as of 1 November 2026; they are not a substitute for reviewing the synchronized source or running the complete validation suite.

| Area | Current status | Notes |
|---|---|---|
| TypeScript package/build setup | ðŸŸ¡ Present | tsup build and typecheck scripts exist; automated test script and release hardening remain |
| init() | ðŸŸ¡ Partial | Validates client ID and redirect URI; unsupported Web must not be silently selected |
| PKCE S256 | ðŸŸ¢ Implemented | Needs SDK unit tests |
| OAuth state | ðŸŸ¢ Implemented | Uses `crypto.randomUUID()`, matching the Worker UUID schema; needs tests |
| Chrome authorization launcher | ðŸŸ¢ Implemented | Uses the Promise API; needs end-to-end validation and cancellation classification review |
| Chrome transaction storage | ðŸŸ¢ Implemented | Uses `chrome.storage.session`; runtime validation and cleanup failure behavior need review |
| Callback validation | ðŸŸ¢ Implemented | Parses code/state, handles OAuth errors, and compares returned state with the initiated state |
| Code exchange | ðŸŸ¢ Implemented in SDK | Sends JSON with state, code, client_id, code_verifier, redirect_uri; validates envelope and `data.user`; E2E verification remains |
| Session lookup | ðŸŸ¢ Implemented | Validates the response envelope and authenticated/anonymous `NinjaSession` payloads; mocked contract tests cover active, anonymous, invalid-session, and temporary-error outcomes |
| Logout | ðŸŸ¢ Implemented in SDK | POSTs `/v1/logout` with credentials and resolves only after explicit `loggedOut: true` confirmation; mocked success and failure tests are in CI |
| Web platform | ðŸŸ¡ Explicitly unsupported | `init()` accepts the platform value, but `login()` rejects with `UNSUPPORTED_PLATFORM`; Web authentication remains unimplemented |
| Endpoint configuration | ðŸŸ¢ Implemented | Preserves the local Wrangler endpoint and selects the production Ninja Connect API explicitly; production is the default |
| SDK automated tests | ðŸŸ¡ Initial suite and CI implemented | Node.js test runner covers login/PKCE/state/exchange, session, logout, and selected failures; CI runs typecheck, build, and tests. Live Worker/provider E2E remains open |
| Stable public API and release | ðŸ”´ Not ready | Session/logout behavior, platform handling, tests, public exports, and release criteria remain |

## Remaining work â€” priority order

### P0 â€” Close and verify the Extension authentication flow

- [x] Align SDK /v1/exchange request with the Worker JSON schema, including UUID state.
- [x] Add explicit callback state equality validation against the initiated transaction.
- [x] Use the transaction's stored redirect URI during exchange.
- [ ] Review transaction cleanup on launcher rejection, OAuth denial, callback parse errors, exchange failure, and success; ensure cleanup failure does not mask the original error.
- [x] Keep `127.0.0.1:8787/v1` as the intentional local Wrangler development endpoint and introduce explicit production endpoint selection. Do not remove or replace the local workflow.
- [x] Validate the exchange response envelope and `data.user` shape in the SDK against the reviewed Worker response helper; retain end-to-end verification as an open item.
- [x] Add HTTP status, JSON parsing, envelope, and user-shape checks to the code-exchange path.
- [ ] Complete extension login end-to-end against the intended local Auth Worker environment.
- [ ] Verify cookie creation and subsequent authenticated session lookup.
- [ ] Verify login again after logout once the SDK logout method is implemented.

### P0 â€” Complete integration/security checks

- [ ] Verify Extension login, session restore, logout, and login-again in Chrome.
- [ ] Verify HttpOnly cookie creation, retention, credentialed requests, and clearing.
- [ ] Verify Extension origin against Worker CORS configuration.
- [ ] Verify cache hit does not call /v1/session.
- [ ] Verify cache miss calls /v1/session and caches only a valid authenticated user.
- [ ] Verify transient server failures do not become anonymous state or erase a cached user.
- [ ] Verify every protected operation requires a live session when the cache result has `session: null`.

### P1 â€” Public API completeness and hardening

- [ ] Decide whether `NinjaSession` and other consumer-facing types should be re-exported from `src/index.ts`. Current index exports `NinjaAuthConfig` and `NinjaUser` only.
- [ ] Review behavior when logout is requested for an already anonymous session.
- [ ] Review transaction storage validation and cleanup failure paths.
- [ ] Confirm verifier, tokens, and raw session secrets are never logged or unnecessarily exposed.
- [ ] Review upstream provider revocation reporting after local logout.

### P2 â€” Future scope

- OIDC Discovery and provider interoperability behind Ninja Connect.
- Web platform adapter and browser-level tests.
- Account linking, MFA, passkeys, device management, and global logout.

## Evidence policy

Only then should Core 0.1 be frozen and released.
