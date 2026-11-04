# NinjaAuth — Roadmap and implementation status (dev)

> **Last reviewed:** 4 November 2026  
> **Repository:** HanamiSoftware/NinjaAuth-SDK  
> **Branch:** dev  
> **Reviewed source commit:** 198aaad0edeac67e1b8a626094293faebe0120a3  
> **Package/source version:** 0.1.0

This roadmap is authoritative for the SDK **dev** branch only. It does not describe master. GitHub compare reports dev 29 commits ahead and 9 commits behind master; the branches are divergent and share merge base `d2b7ea44dcd769fcb3ce3cb145d737f657e55150`.

## Executive status

The dev branch contains source implementations for Chrome Extension Authorization Code + PKCE login, callback-state validation, JSON code exchange, normalized session lookup, current-session logout, typed errors, and environment-aware endpoints. Its generated ESM/CJS/IIFE artifacts are present, and the dev IIFE contains the full default scope `openid profile email offline_access`.

**The dev branch is not validated as release-ready.** A significant public API/test mismatch is visible in source:

- `src/NinjaAuth.ts` exports `NinjaAuthClient` as `NinjaAuth`.
- `init()` is static and returns the singleton instance.
- `login()`, `getSession()`, and `logout()` are instance methods, not static methods.
- The current test helper calls `NinjaAuth.init()`, but the tests then call `NinjaAuth.login()`, `NinjaAuth.getSession()`, and `NinjaAuth.logout()` on the exported class rather than on the returned instance.

This mismatch must be resolved deliberately. No test execution or passing CI result is claimed here. The public usage example for this source shape is:

```ts
const auth = NinjaAuth.init(config);
await auth.login();
await auth.getSession();
await auth.logout();
```

## Version and branch boundary

- `package.json`: 0.1.0.
- `src/NinjaAuth.ts`: runtime VERSION is 0.1.0.
- No public npm release or release tag is asserted.
- The former `1.0.1-beta` wording was erroneous and is superseded.
- Dev is 29 commits ahead and 9 behind master at the time of comparison. Master and dev must retain separate status documents until reconciled deliberately.

## Dev implementation inventory

| Area | Status on dev | Evidence / qualification |
|---|---|---|
| Initialization | Implemented | Static init validates config and returns singleton instance |
| Chrome Extension login | Implemented in source | PKCE S256, UUID state, callback-state equality check |
| Code exchange | Implemented in source | JSON request with state, code, client_id, code_verifier, redirect_uri |
| Default scope | Implemented in source and generated IIFE | openid profile email offline_access |
| Session lookup | Implemented in source | Normalized NinjaSession validation; only explicit 401 INVALID_SESSION becomes anonymous |
| Current-session logout | Implemented in source | Credentialed POST /v1/logout; requires data.loggedOut === true |
| Web login | Unsupported | Explicit UNSUPPORTED_PLATFORM rejection |
| Public export shape | Needs decision/review | Exported symbol is a class; init static, remaining API methods instance-based |
| SDK tests | Present, not validated | 20 top-level node:test cases; calls do not match the source instance API |
| Generated artifacts | Present | ESM, CJS, declaration, and IIFE artifacts exist; dev IIFE has full default scope |
| CI / local validation | Not established here | No passing run or local execution is claimed |
| Live Extension/Worker E2E | Not verified | Chrome login/session/logout and cookie/CORS lifecycle remain open |

## Architecture decisions

- Ninja Connect is the central Identity Broker for shared authentication, identity, and session lifecycle.
- NinjaAuth is a provider-neutral client SDK.
- Each consuming application owns its profile, roles, permissions, capabilities, and business rules.
- AuthGear is the current upstream provider behind Ninja Connect, not a public SDK dependency.
- `login()` starts interactive authentication; `getSession()` only observes the existing session.
- Only explicit `401 INVALID_SESSION` becomes unauthenticated. Temporary and operational failures remain errors.
- The browser must not read or persist the raw HttpOnly session secret or upstream refresh token.
- `POST /v1/logout` revokes only the current cookie session. Global logout is not implemented.
- Web login remains unsupported until its platform design and browser tests are complete.

## Remaining work

### P0 — Resolve the public API/export mismatch

- [ ] Decide whether to export a singleton instance or a class/factory.
- [ ] Align source exports, ESM/CJS/IIFE global exposure, README examples, and tests to the chosen API.
- [ ] Ensure the test helper retains the instance returned by init() if the class/factory model is selected.
- [ ] Execute the full test suite on the exact dev commit and record the result.
- [ ] Run typecheck and build on the same commit.

### P0 — Verify Extension/Worker lifecycle

- [ ] Build and load the Extension in Chrome.
- [ ] Verify clean install, login, session lookup, logout, and login again.
- [ ] Verify HttpOnly cookie creation, retention, credentialed requests, and clearing.
- [ ] Verify Extension origin against Worker CORS configuration.
- [ ] Verify temporary failures remain errors and do not become anonymous state.

### P1 — Security and API hardening

- [ ] Review transaction storage runtime validation and OAuth cleanup failure paths.
- [ ] Confirm tokens, verifier, and raw session secrets are not logged or unnecessarily exposed.
- [ ] Review upstream provider revocation reporting after local logout.
- [ ] Define already-anonymous logout and partial upstream revocation failure behavior.
- [ ] Finalize public types, timeout, cancellation, and singleton/instance semantics.

### P2 — Future scope

- OIDC Discovery and provider interoperability behind Ninja Connect.
- Web platform adapter and browser-level tests.
- Account linking, MFA, passkeys, device management, and global logout.

## Evidence policy

A test file is not a passing test run. A green CI result on master is not evidence for dev. A focused PostgreSQL test with a mocked upstream provider is not live provider E2E. Record exact commit, test path, environment, and result for every future verification.
