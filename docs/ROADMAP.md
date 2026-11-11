# NinjaAuth Roadmap and implementation status (dev)

> **Last reviewed:** 4 November 2026  
> **Repository:** HanamiSoftware/NinjaAuth-SDK  
> **Branches verified:** `dev` at `a8e79dceea72cbc8c2b0c69f897ec42c9e0ce9d4`; `master` at `96ff24ed380713ac08d9d78176f0636f69444b92`  
> **Package/source version:** v0.1.0  

This roadmap records the current branch distinction. `dev` and `master` are divergent in Git history; the source and test files reviewed for this audit are aligned, while `.github/workflows/sdk-ci.yml`, `docs/ROADMAP.md`, and `docs/TEST-PLAN.md` differ. `dev` contains the `workflow_dispatch` trigger that is not yet present on `master`.

## Executive status

NinjaAuth Core 0.1 is **not release-ready**. The Chrome Extension flow remains implemented, and this branch adds the Web backend-callback flow using server-side PKCE transaction storage, server-to-server code exchange, and an application-owned session cookie.
The backend test results below are branch-only evidence. They have not been merged or deployed.

## Architecture decisions agreed

- Ninja Connect is the central Identity Broker for shared authentication, identity, and session lifecycle.
- NinjaAuth is a client SDK and can be used by first-party Ninja products and independent third-party developers.
- Ninja Connect brokers upstream authentication and shared identity; each consuming application owns its own application session/cookie and business authorization.
- Each consuming product owns its own profile, roles, permissions, capabilities, and application data.
- The optional NinjaAppAdapter<TProfile> is an anti-contamination boundary for first-party product profiles. It is not an OAuth provider/platform adapter and is not required for standalone SDK use.
- Product-specific RBAC must not be moved into Ninja Connect.
- The /v1/state endpoint is required by the Web server-side PKCE flow: it validates the exact registered callback and stores the verifier server-side for one-time consumption.
- No Worker repository transfer, merge, or deployment is included in the completed test work.
- AuthGear is the current upstream identity provider, not the owner of Ninja Connect application sessions. AuthGear SSO sessions and Ninja Connect `auth_sessions` records are separate lifecycles.
- The public NinjaAuth API must remain provider-neutral. AuthGear-specific endpoints, credentials, refresh tokens, and provider secrets remain behind Ninja Connect; OIDC Discovery/interoperability is a planned capability.
- `login()` starts the interactive authentication flow; `getSession()` observes and returns the current session state without starting login. Only an explicit `401 INVALID_SESSION` is normalized to unauthenticated; other authorization errors and temporary failures remain errors.

## Completed and verified work

### Auth Worker reliability  RT-001, RT-002, and RT-003

**PASS focused integration tests**


The implementation uses conditional database updates and a final session re-read as concurrency guards. These are not distributed locks. The tests prove the specific scenarios they orchestrate, not all possible race conditions.

`resolveSession()` now performs a final read of the session row after refresh and user lookup, before returning an authenticated context. A missing, revoked, absolutely expired, or ordinarily expired session is rejected. This covers a logout that commits before the final read; it cannot prevent a logout that commits immediately afterward.

### Additional backend improvement

- The logout route closes its database client in a `finally` block, including error paths.


| Area | Current status | Notes |
|---|---|---|
| TypeScript package/build setup | Present | tsup build and typecheck scripts exist; automated test script and release hardening remain |
| init() | Functional | Validates client ID and redirect URI; web Platform by default |
| PKCE S256 | Implemented | Needs SDK unit tests |
| OAuth state | Implemented | Uses `crypto.randomUUID()`, matching the Worker UUID schema; needs tests |
| Chrome authorization launcher | Implemented | Uses the Promise API; needs end-to-end validation and cancellation classification review |
| Chrome transaction storage | Implemented | Uses `chrome.storage.session`; runtime validation and cleanup failure behavior need review |
| Callback validation | Implemented | Parses code/state, handles OAuth errors, and compares returned state with the initiated state |
| Code exchange | Implemented in SDK | Sends JSON with state, code, client_id, code_verifier, redirect_uri; validates envelope and `data.user`; E2E verification remains |
| Session lookup | Implemented | Validates the response envelope and authenticated/anonymous `NinjaSession` payloads; mocked contract tests cover active, anonymous, invalid-session, and temporary-error outcomes |
| Logout | Implemented in SDK | POSTs `/v1/logout` with credentials and resolves only after explicit `loggedOut: true` confirmation; mocked success and failure tests are in CI |
| Web platform | Implemented on `master` | Server-side state storage, backend callback, protected server-to-server exchange, application-owned API cookie, same-origin outcome bridge, and SDK tests; live browser/provider/cookie verified |
| Endpoint configuration | Implemented | Preserves the local Wrangler endpoint and selects the production Ninja Connect API explicitly; production is the default |
| SDK automated tests | Initial suite and CI implemented | Node.js test runner covers login/PKCE/state/exchange, session, logout, and selected failures; CI runs typecheck, build, and tests. Live Worker/provider E2E remains open |
| Stable public API and release | Not ready | Session/logout behavior, platform handling, tests, public exports, and release criteria remain |

## Remaining work priority order

### P0 Close and verify the Extension authentication flow

- [x] Align SDK /v1/exchange request with the Worker JSON schema, including UUID state.
- [x] Add explicit callback state equality validation against the initiated transaction.
- [x] Use the transaction's stored redirect URI during exchange.
- [ ] Review transaction cleanup on launcher rejection, OAuth denial, callback parse errors, exchange failure, and success; ensure cleanup failure does not mask the original error.
- [x] Keep `127.0.0.1:8787/v1` as the intentional local Wrangler development endpoint and introduce explicit production endpoint selection. Do not remove or replace the local workflow.
- [x] Validate the exchange response envelope and `data.user` shape in the SDK against the reviewed Worker response helper; retain end-to-end verification as an open item.
- [x] Add HTTP status, JSON parsing, envelope, and user-shape checks to the code-exchange path.
- [x] Complete extension login end-to-end against the intended local Auth Worker environment.
- [x] Verify cookie creation and subsequent authenticated session lookup.
- [x] Verify login again after logout once the SDK logout method is implemented.

### P0 Complete integration/security checks

- [x] Verify Extension login, session restore, logout, and login-again in Chrome.
- [x] Verify HttpOnly cookie creation, retention, credentialed requests, and clearing.
- [x] Verify Extension origin against Worker CORS configuration.
- [x] Verify cache hit does not call /v1/session.
- [x] Verify cache miss calls /v1/session and caches only a valid authenticated user.
- [x] Verify transient server failures do not become anonymous state or erase a cached user.
- [x] Verify every protected operation requires a live session when the cache result has `session: null`.

### P1 Public API completeness and hardening

- [x] `NinjaSession` `NinjaAuthConfig` and `NinjaUser` are exported from `src/index.ts`. Just for intellisense/auto-complete functionality
- [ ] Review transaction storage validation and cleanup failure paths.
- [ ] Confirm verifier, tokens, and raw session secrets are never logged or unnecessarily exposed.
- [x] Review upstream provider revocation reporting after local logout.

### P2 Future scope

- OIDC Discovery and provider interoperability behind Ninja Connect.
- Web platform browser-level tests and live NinjaURL cookie/CORS verification.
- Account linking, MFA, passkeys, device management, and global logout.

## Evidence policy

Only then should Core 0.1 be frozen and released.
