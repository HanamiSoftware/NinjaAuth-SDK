# NinjaAuth — Roadmap and implementation status

> **Last reviewed:** 3 November 2026  
> **Project milestone:** NinjaAuth v1.0.1-beta (internal milestone label; not a published package version).  
> **Repository default branch reviewed:** master, latest commit d2b7ea44dcd769fcb3ce3cb145d737f657e55150.

## Executive status

The NinjaAuth client SDK has a working Chrome Extension authorization/session lifecycle in source: initialization, Authorization Code + PKCE login, callback-state validation, JSON exchange, session lookup, and current-session logout. The SDK test suite exists and contains 20 top-level test cases. The Extension delegates login, session lookup, and logout to NinjaAuth on its master branch.

**The v1.0.1-beta milestone is not yet a releasable package.** The actual package and source version are still 0.1.0; the generated SDK IIFE is stale after the most recent default-scope source change; and live Extension/Worker end-to-end verification has not been completed. No CI status checks were returned for the reviewed latest SDK or Extension commits, so this roadmap does not claim a green CI run for them.

The cache-first session-restore optimization discussed on 3 November is visible in the Extension remote dev branch. It is not yet in Extension master. The optimization restores the cached user for immediate UI rendering with session: null; it must not be interpreted as proof that the server session is currently valid.

## Architecture decisions — agreed

- Ninja Connect is the central Identity Broker for shared authentication, identity, and session lifecycle.
- NinjaAuth is a client SDK usable by first-party Ninja products and independent third-party applications.
- Ninja Connect owns shared identity and central session management; each consuming application owns its own business authorization.
- Product-specific profiles, roles, permissions, capabilities, and business rules must not be moved into Ninja Connect.
- AuthGear is the current upstream identity provider behind Ninja Connect, not the owner of Ninja Connect application sessions and not a public SDK dependency.
- login() starts interactive authentication; getSession() observes the existing session and never starts login.
- Only an explicit 401 INVALID_SESSION is normalized to an unauthenticated session. Other authorization errors, malformed responses, network failures, and temporary refresh failures remain errors.
- Browser JavaScript must never read or persist the raw HttpOnly session secret or upstream refresh token.
- The experimental /v1/state endpoint is not a required part of the SDK flow.
- POST /v1/logout revokes the current session represented by the request cookie; global logout is not implemented.
- The optional NinjaAppAdapter<TProfile> remains an architectural proposal, not a currently exported SDK API.

## Current SDK implementation

| Area | Source status | Evidence / qualification |
|---|---|---|
| init(config) | Implemented | Requires client ID and redirect URI; supports extension and web platform labels; environment defaults to production |
| Authorization Code + PKCE | Implemented for Chrome Extension | PKCE S256, UUID state, callback parsing, callback-state equality check |
| Code exchange | Implemented | JSON body: state, code, client_id, code_verifier, redirect_uri; credentialed request |
| Default scope | Implemented in source | NINJA_CONNECT.DEFAULT_SCOPE = "openid profile email offline_access" |
| getSession() | Implemented | Validates response envelope and normalized NinjaSession; only 401 INVALID_SESSION maps to unauthenticated |
| logout() | Implemented | POST /v1/logout, credentials included, requires data.loggedOut === true |
| Typed internal errors | Implemented | Includes TRANSACTION_CLEANUP_FAILED; primary OAuth/exchange errors are not masked by cleanup errors |
| Web login | Unsupported | Explicitly rejects with UNSUPPORTED_PLATFORM; no Web flow is claimed |
| SDK tests | Present | test/ninja-auth.test.mjs, 20 top-level node:test cases; tests use mocked Chrome APIs and Worker responses |
| Generated distribution | Needs rebuild | dist/index.global.js still uses the previous reduced scope in the authorization request |
| Live E2E | Not verified | No complete Chrome + local/deployed Worker + real cookie lifecycle evidence |

## Version boundary

The project milestone name is **NinjaAuth v1.0.1-beta**, agreed on 3 November 2026. This name does not yet match the distributable package:

- package.json: 0.1.0.
- src/NinjaAuth.ts: VERSION = "0.1.0".
- dist/index.global.js: generated artifact is not aligned with the latest source scope change.
- Extension vendored bundle: contains the expected openid profile email offline_access scope.

No npm publish, release tag, or public release is claimed. Align the package version, source constant, generated artifacts, and vendored Extension bundle before creating the v1.0.1-beta tag.

## Verified cross-repository state — 3 November 2026

### NinjaURL Extension

Repository: [HanamiSoftware/NinjaUrl-Extension](https://github.com/HanamiSoftware/NinjaUrl-Extension)

- Remote branches present: master, dev, and feature/typescript-migration-(v7). The former feature/NinjaAuth-Integration branch is not present in the current branch listing.
- master contains commit 9606469a3f6412c5d47c9ee83c38b359499e1e8d, which vendors the NinjaAuth IIFE and delegates login, session lookup, and logout to the SDK.
- The master Background restoreSession() calls getNinjaAuth().getSession() on each restore.
- dev is two commits ahead of master and its current v6/service/background.js contains the cache-first restore path:
  - read user from chrome.storage.local;
  - if present, return { authenticated: true, user, session: null } without calling /v1/session;
  - if absent, call NinjaAuth getSession() and save a valid authenticated user.
- The Side Panel sends RESTORE_SESSION and consumes the normalized data session object.
- In the cache-first path, authenticated: true is a UI restoration hint only. session: null means the session was not checked in that call. A protected operation must verify the live session with NinjaAuth before relying on authentication.
- The Extension build and real Chrome cookie/CORS E2E are not verified by the available commit status checks.

### Ninja Connect Auth Worker

The Auth Worker currently resides in [NinjaURL-URL-Shortener/Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). The dedicated Ninja Connect repository transfer is not complete.

- NinjaURL master latest reviewed commit: ddc470f55fb032b72a4f01736eccc209ab156c64.
- NinjaURL dev is six commits behind master at the time of review.
- RT-001, RT-002, and RT-003 are focused PostgreSQL concurrency tests recorded on diagnostic/work branches. They are not live end-to-end tests against a real identity provider.
- Anonymous capability and 20-active-link work remains on its dedicated Worker work branch and is not represented as merged into master.
- No new Worker deployment is claimed.

## Backend concurrency evidence

| Test | Invariant | Evidence boundary |
|---|---|---|
| RT-001 — concurrent refresh | A stale concurrent invalid_grant must not revoke a session whose refresh token was already rotated | Real PostgreSQL/Neon state; mocked upstream provider; CI run 41073531083 reported successful |
| RT-002 — logout during refresh | Logout must prevail over refresh operations still in flight | Real PostgreSQL/Neon state; mocked upstream provider; CI run 41078846722 reported successful |
| RT-003 — logout before resolver return | A session revoked before final resolver revalidation must not be returned as authenticated | Real PostgreSQL/Neon state and Worker logout route; mocked upstream refresh; CI run 41196276386 owner-reported successful |

These tests prove the orchestrated interleavings only. They are not distributed locks and do not prove every possible execution ordering. RT-003's CI result was owner-reported and should be rechecked before treating it as independently audited evidence.

## Remaining work — release gates

### P0 — Align the distributable SDK

- [ ] Bump package.json and the runtime VERSION constant to the agreed package version 1.0.1-beta.
- [ ] Run npm run typecheck.
- [ ] Run npm test and record the actual result for the release candidate.
- [ ] Run npm run build after the scope change.
- [ ] Verify ESM, CJS, declarations, and IIFE artifacts all reflect the same version and default scope.
- [ ] Re-vendor the regenerated IIFE into the Extension and verify the bundle hash/content.

### P0 — Complete Extension session lifecycle verification

- [ ] Build the Extension.
- [ ] Test clean install, login, session lookup, logout, and login again in Chrome.
- [ ] Verify the HttpOnly cookie is created, retained, sent, and cleared as expected.
- [ ] Verify extension origin against Worker CORS allowlist.
- [ ] Verify temporary network/Worker errors do not clear a cached user.
- [ ] Promote the cache-first restore implementation from Extension dev only after review and tests.
- [ ] Implement the rule that a cache-restored session: null triggers a live NinjaAuth session check before any protected operation.
- [ ] Confirm the Side Panel response contract remains consistent for cache, server session, anonymous, and error paths.

### P1 — Harden and finalize the public contract

- [ ] Review transaction-storage runtime validation and all OAuth failure paths.
- [ ] Confirm no token, verifier, or raw session secret is logged or unnecessarily exposed.
- [ ] Review upstream provider revocation reporting after local logout.
- [ ] Define behavior for already-anonymous logout and partial upstream revocation failure.
- [ ] Decide whether the proposed /v1/logout/all belongs in the public SDK or an account-management layer; it is not implemented.
- [ ] Finalize public types, nullability, singleton/instance policy, timeout, and cancellation semantics.
- [ ] Keep Web login explicitly unsupported until a separate platform design and browser test suite are complete.

### P2 — Future scope

- OIDC Discovery and provider interoperability behind Ninja Connect.
- Web platform adapter and browser-level tests.
- Optional NinjaAppAdapter<TProfile> only after its public status and API are deliberately decided.
- Account linking, MFA, passkeys, device management, and global logout.

## Release decision

**NinjaAuth v1.0.1-beta is named as an internal project milestone, not declared released.** The beta can be tagged only after the SDK package version, source constant, generated distribution, Extension vendored bundle, automated checks, and Extension/Worker E2E evidence agree.

## Agreed implementation sequence

1. Rebuild and verify the SDK artifacts.
2. Verify Extension build and the complete Chrome authentication/session/logout lifecycle.
3. Review and promote the cache-first restore flow, preserving the distinction between cached identity and verified session.
4. Complete security/API contract review and close release gates.
5. Create the beta tag only after the package metadata and artifacts are aligned.
