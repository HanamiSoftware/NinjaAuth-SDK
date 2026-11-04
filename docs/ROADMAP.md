# NinjaAuth — Roadmap and implementation status

> **Last reviewed:** 4 November 2026  
> **Repository:** HanamiSoftware/NinjaAuth-SDK  
> **Branches verified:** `dev` at `a8e79dceea72cbc8c2b0c69f897ec42c9e0ce9d4`; `master` at `96ff24ed380713ac08d9d78176f0636f69444b92`  
> **Package/source version:** v0.1.0  

This roadmap records the current branch distinction. `dev` and `master` are divergent in Git history; the source and test files reviewed for this audit are aligned, while `.github/workflows/sdk-ci.yml`, `docs/ROADMAP.md`, and `docs/TEST-PLAN.md` differ. `dev` contains the `workflow_dispatch` trigger that is not yet present on `master`.

## Executive status

The SDK exports the `NinjaAuth` class directly. Its public constructor returns one singleton instance within the current JavaScript runtime. The instance is initialized with `auth.init(config)`; the lifecycle methods are `auth.login()`, `auth.getSession()`, and `auth.logout()`.

The Extension Background on both `dev` and `master` imports the SDK class into its runtime, creates one instance with `new NinjaAuth()`, and initializes it once. The Extension's current Background also implements cache-first session restoration.

## Implemented SDK behavior

| Area | Status on the shared branch state | Notes |
|---|---|---|
| Public export | Implemented | `export class NinjaAuth`; named export from `src/index.ts` |
| Runtime singleton | Implemented in source | Public constructor returns the existing instance on repeated construction in the same runtime |
| Initialization | Implemented in source | Instance method; validates configuration; one-shot; returns `this` |
| Chrome Extension login | Implemented in source | Authorization Code + PKCE S256 |
| OAuth state | Implemented in source | UUID state and callback equality validation |
| Code exchange | Implemented in source | JSON request with state, code, client_id, code_verifier, redirect_uri |
| Session lookup | Implemented in source | Validates normalized NinjaSession; only explicit 401 INVALID_SESSION becomes anonymous |
| Current-session logout | Implemented in source | Credentialed POST /v1/logout; requires data.loggedOut === true |
| Typed errors | Implemented in source | Configuration, initialization, network, response, exchange, session and cleanup errors |
| Web login | Unsupported | Explicit UNSUPPORTED_PLATFORM rejection |
| Version | Current source/package | v0.1.0; no public release or tag asserted |

## Test status

The test suite is present on both SDK branches:

- File: `test/ninja-auth.test.mjs`.
- Current suite: 37 top-level Node.js test cases.
- Tests import the built ESM entry in isolated module instances so singleton state cannot leak between cases.
- Coverage includes constructor identity, initialization, configuration validation, pre-init guards, session success/anonymous/error handling, logout confirmation, PKCE/state/exchange, cleanup behavior, and a mocked login → session → logout lifecycle.

**Execution evidence:** GitHub Actions run [#25](https://github.com/HanamiSoftware/NinjaAuth-SDK/actions/runs/41863128345) passed typecheck, build, and 37/37 tests on the `dev` commit `a8e79dceea72cbc8c2b0c69f897ec42c9e0ce9d4`. This is evidence for that exact `dev` commit only. No CI result was verified for the inspected `master` head `96ff24ed380713ac08d9d78176f0636f69444b92`; do not infer a pass on `master` from run #25.

## Extension integration status

Repository: HanamiSoftware/NinjaUrl-Extension; the reviewed integration files are identical on `dev` and `master`.

Verified source behavior:

- Background loads the NinjaAuth class into its Service Worker runtime.
- Background creates one instance and initializes it with the Extension client ID, Chrome redirect URI, platform `extension`, and environment `development`.
- Login delegates to SDK login, then calls getSession and persists the authenticated user in `chrome.storage.local`.
- Restore checks the local cached user first. A cache hit returns a UI-restoration result with `session: null` and does not call the server in that path.
- If no cached user exists, restore calls SDK getSession; an authenticated user is cached.
- Logout calls SDK logout before clearing the cached user.

The project owner reports successful manual checks of login, logout, server-side session recovery, and local-storage session restoration. This is recorded as a manual smoke-test report, not as automated or CI evidence.

The cache entry is presentation state, not proof of a live server session. Protected operations still require an explicit live session check. The exact protected-operation guard and its tests remain to be reviewed.

## Remaining work — priority order

### P0 — Keep automated SDK evidence current

- [x] Run `npm run typecheck`, `npm run build`, and `npm test` on `dev` commit `a8e79dceea72cbc8c2b0c69f897ec42c9e0ce9d4`; GitHub Actions #25 passed 37/37 tests.
- [ ] Obtain a CI result for the inspected `master` head `96ff24ed380713ac08d9d78176f0636f69444b92` or update `master` through the normal PR process and rerun CI.
- [ ] Synchronize the `workflow_dispatch` trigger from `dev` to `master` through the normal PR process.
- [ ] Keep test evidence tied to exact commit SHAs; do not infer success from the presence of test files.

### P0 — Complete integration/security checks

- [ ] Verify Extension login, session restore, logout, and login-again in Chrome.
- [ ] Verify HttpOnly cookie creation, retention, credentialed requests, and clearing.
- [ ] Verify Extension origin against Worker CORS configuration.
- [ ] Verify cache hit does not call /v1/session.
- [ ] Verify cache miss calls /v1/session and caches only a valid authenticated user.
- [ ] Verify transient server failures do not become anonymous state or erase a cached user.
- [ ] Verify every protected operation requires a live session when the cache result has `session: null`.

### P1 — Public API completeness and hardening

- [ ] Decide whether `NinjaSession` and other consumer-facing types should be re-exported from `src/index.ts`. Current index exports `NinjaAuthConfig` and `NinjaUser` only.
- [ ] Review behavior when logout is requested for an already anonymous session.
- [ ] Review transaction storage validation and cleanup failure paths.
- [ ] Confirm verifier, tokens, and raw session secrets are never logged or unnecessarily exposed.
- [ ] Review upstream provider revocation reporting after local logout.

### P2 — Future scope

- OIDC Discovery and provider interoperability behind Ninja Connect.
- Web platform adapter and browser-level tests.
- Account linking, MFA, passkeys, device management, and global logout.

## Evidence policy

A test file is not a passing test run. A green CI result must be tied to the exact commit being evaluated. A manual smoke test is not equivalent to automated regression coverage or live Worker E2E. Record exact repository, branch, commit, environment, command, and result for every future verification.
