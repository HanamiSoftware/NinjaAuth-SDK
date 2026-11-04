# NinjaAuth — Roadmap and implementation status

> **Last reviewed:** 4 November 2026  
> **Repository:** HanamiSoftware/NinjaAuth-SDK  
> **Branch reviewed:** master  
> **Reviewed commit:** `31116ff9609aaf7ce1a6fb137a54f401a91b1635`  
> **Package/source version:** `0.1.0`

This document is the single authoritative implementation-status record for the SDK repository. Branch-specific statements must not be generalized to other branches or repositories.

## Executive status

NinjaAuth 0.1.0 has a substantive Chrome Extension authentication/session implementation in source: initialization, Authorization Code + PKCE, callback-state validation, JSON code exchange, session lookup, and current-session logout. A Node.js test file with 20 top-level test cases is present.

**Release readiness is not established.** The current committed IIFE bundle does not match the source default authorization scope. The exact reviewed master commit has not been shown here to have a successful CI run or a fresh local validation run. Chrome/Worker live end-to-end verification is also open.

The phrase `1.0.1-beta` appearing in older documents was not an agreed package version or valid release milestone. It is superseded. The actual package metadata and runtime source constant are both `0.1.0`; no public release or tag is claimed.

## Branch boundary

At review time, GitHub compare reported the SDK branches as diverged:

- `master` was 9 commits ahead of `dev`.
- `dev` was 29 commits ahead of `master`.
- The merge base was `d2b7ea44dcd769fcb3ce3cb145d737f657e55150`.
- The reviewed master head was `31116ff9609aaf7ce1a6fb137a54f401a91b1635`.

The branches must be audited and documented independently. This roadmap describes **master** unless a different branch is explicitly named.

## Architecture decisions

- Ninja Connect is the central Identity Broker for shared authentication, identity, and session lifecycle.
- NinjaAuth is a client SDK usable by first-party products and independent applications.
- Ninja Connect owns shared identity and central session management; each consuming application owns its business authorization.
- Product-specific profiles, roles, permissions, capabilities, and business rules do not belong in the shared identity contract.
- AuthGear is the current upstream identity provider behind Ninja Connect, not a public SDK dependency.
- `login()` starts interactive authentication; `getSession()` observes the existing session and never starts login.
- Only an explicit `401 INVALID_SESSION` is normalized to unauthenticated. Other authorization errors, malformed responses, network failures, and temporary refresh failures remain errors.
- Browser JavaScript must not read or persist the raw HttpOnly session secret or upstream refresh token.
- `POST /v1/logout` revokes the current cookie session; global logout is not implemented.
- The optional `NinjaAppAdapter<TProfile>` is not claimed as an exported API.

## Master implementation status

| Area | Status on master | Evidence / qualification |
|---|---|---|
| Initialization | Implemented | Validates client ID, redirect URI, platform, and environment |
| Chrome Extension login | Implemented in source | Authorization Code + PKCE S256, UUID state, callback-state equality check |
| Code exchange | Implemented in source | JSON body includes state, code, client_id, code_verifier, redirect_uri |
| Default scope | Implemented in source | `openid profile email offline_access` |
| Session lookup | Implemented in source | Validates normalized NinjaSession; only explicit 401 INVALID_SESSION becomes anonymous |
| Current-session logout | Implemented in source | Credentialed POST /v1/logout; requires `data.loggedOut === true` |
| Web login | Unsupported | Explicit `UNSUPPORTED_PLATFORM` rejection |
| SDK tests | Test file present | 20 top-level node:test cases; this is not evidence that they passed on the reviewed commit |
| Generated IIFE | Out of sync | `dist/index.global.js` authorization request still uses `openid offline_access` |
| CI / release validation | Not established here | No passing status or local test run is asserted for reviewed commit |
| Live Extension/Worker E2E | Not verified | Chrome login/session/logout and cookie/CORS lifecycle remain open |

## Version and distribution

Verified on master:

- `package.json` version: `0.1.0`.
- `src/NinjaAuth.ts` runtime version constant: `0.1.0`.
- `src/config.ts` default scope: `openid profile email offline_access`.
- `dist/index.global.js` contains the older reduced authorization scope `openid offline_access`.

The generated artifact must be rebuilt and inspected. Do not publish or tag a new version until package metadata, source, ESM/CJS/declarations/IIFE artifacts, and any consuming application's vendored bundle are verified against the same release commit.

## Remaining work

### P0 — Align and verify distribution artifacts

- [ ] Run the documented typecheck, build, and test commands on the exact candidate commit.
- [ ] Rebuild all distribution artifacts from the reviewed source.
- [ ] Verify the default scope and version in ESM, CJS, declarations, and IIFE output.
- [ ] Compare the Extension vendored IIFE with the generated artifact before updating it.

### P0 — Complete Extension/Worker end-to-end verification

- [ ] Build and load the Extension in Chrome.
- [ ] Verify clean install, login, session lookup, logout, and login again.
- [ ] Verify HttpOnly cookie creation, retention, credentialed requests, and clearing.
- [ ] Verify Extension origin against Worker CORS configuration.
- [ ] Verify temporary network/Worker failures remain errors and do not become anonymous state.

### P1 — Finalize the public contract

- [ ] Review transaction storage validation and all OAuth failure/cleanup paths.
- [ ] Confirm tokens, verifier, and raw session secrets are not logged or unnecessarily exposed.
- [ ] Review upstream provider revocation reporting after local logout.
- [ ] Define behavior for already-anonymous logout and partial upstream revocation failure.
- [ ] Finalize public types, singleton/instance policy, timeout, and cancellation semantics.
- [ ] Keep Web login explicitly unsupported until its platform design and browser tests are complete.

### P2 — Future scope

- OIDC Discovery and provider interoperability behind Ninja Connect.
- Web platform adapter and browser-level tests.
- Account linking, MFA, passkeys, device management, and global logout.

## Cross-repository boundary

The Auth Worker currently resides in [NinjaURL-URL-Shortener/Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its transfer to a dedicated Ninja Connect repository is not complete. Worker and Extension implementation status is owned by the central NinjaURL roadmap and the relevant repository evidence; do not infer it from SDK source.

## Evidence policy

A test file is not a passing test run. A green CI run on one branch is not evidence for another branch. A focused PostgreSQL concurrency test with a mocked upstream provider is not live provider E2E. Every future status update must name the exact commit and verification boundary.
