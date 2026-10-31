# NinjaAuth — Roadmap and implementation status

> **Last reviewed:** 31 October 2026  
> This is the only authoritative roadmap for the NinjaAuth SDK and its integration with Ninja Connect. The repository-root ROADMAP.md has been retired; use this document.

## Executive status

NinjaAuth Core 0.1 is **not release-ready**. The central architecture is defined, and three focused Auth Worker concurrency scenarios have passed PostgreSQL integration tests. However, the inspected SDK source still has an incomplete extension exchange contract, a local development endpoint, an unfinished Web platform, a placeholder logout method, and no SDK test suite in its package scripts.

The backend test results below are branch-only evidence. They have not been merged or deployed.

## Architecture decisions — agreed

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

## Completed and verified work

### Auth Worker reliability — RT-001, RT-002, and RT-003

**PASS — focused integration tests**

| Test | Invariant | Result |
|---|---|---|
| RT-001 — concurrent refresh | A stale concurrent invalid_grant must not revoke a session whose refresh token was already rotated by another request | PostgreSQL integration test passed |
| RT-002 — logout during refresh | Logout must prevail over refresh operations that are still in flight; refresh must not reactivate the revoked local session | PostgreSQL integration test passed |
| RT-003 — logout before resolver return | A session revoked before the resolver's final revalidation must not be returned as authenticated | Focused PostgreSQL integration test; CI owner-reported successful |

Evidence:

- Branch: test/auth-refresh-concurrency-rt001 in [NinjaURL-URL-Shortener](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener).
- [RT-001 CI run 41073531083](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41073531083) — success.
- [RT-002 CI run 41078846722](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41078846722) — success.
- PostgreSQL persistence is real (Neon test database); identity-provider HTTP responses are mocked.
- The test branches have not been merged or deployed.
- RT-003 implementation commit: `7d89d4412cd85727578225517b8f03ed58f71aa3`; regression test commit: `65c8127377ebcb3c8712452f223a07fd0b1649d1`.
- RT-003 test: `Workers/auth-worker/integration-tests/resolve-session-logout-race.integration.test.ts`; it uses real Neon/PostgreSQL state, a mocked upstream refresh, and the real Worker logout route. CI run [41196276386](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41196276386) was reported successful by the project owner; recheck before treating it as independently audited evidence.

The implementation uses conditional database updates and a final session re-read as concurrency guards. These are not distributed locks. The tests prove the specific scenarios they orchestrate, not all possible race conditions.

### RT-003 — final session revalidation before authenticated return

**PASS — focused integration test added; CI reported successful by the project owner.**

`resolveSession()` now performs a final read of the session row after refresh and user lookup, before returning an authenticated context. A missing, revoked, absolutely expired, or ordinarily expired session is rejected. This covers a logout that commits before the final read; it cannot prevent a logout that commits immediately afterward.

### Additional backend improvement

- The logout route closes its database client in a `finally` block, including error paths.

## Current SDK source snapshot

The following status reflects the SDK source inspected on its current default branch, not uncommitted local work or code that may exist elsewhere.

| Area | Status | Notes |
|---|---|---|
| TypeScript package/build setup | 🟡 Present | tsup builds ESM, CJS, types, and IIFE; release hardening remains |
| init() | 🟡 Basic implementation | Validates client ID and redirect URI; platform defaults to web even though Web is not implemented |
| PKCE S256 | 🟢 Implemented | Needs SDK unit tests |
| OAuth state | 🟡 Implemented, format mismatch | SDK generator emits hex; Worker exchange schema expects UUID |
| Chrome authorization launcher | 🟡 Implemented | Needs full end-to-end validation |
| Chrome transaction storage | 🟡 Implemented | Cleanup on all failure paths needs review |
| Callback validation | 🔴 Incomplete | Explicit comparison with the originally generated state is missing |
| Code exchange | 🔴 Contract mismatch | SDK sends form-urlencoded and omits required state; Worker expects JSON |
| Session lookup | 🟡 Implemented | Uses GET /v1/session; response handling needs stronger runtime validation |
| Logout | 🔴 SDK incomplete | Worker route exists; SDK method is a TODO |
| Web platform | 🔴 Not implemented | Current branch can leave the login promise pending |
| Endpoint configuration | 🔴 Incomplete | Client hardcodes localhost instead of using explicit environment configuration |
| SDK automated tests | 🔴 Missing | Package manifest has no test script |
| Stable public API and release | 🔴 Not ready | Contract, errors, platform behavior, tests, and release criteria remain |

## Remaining work — priority order

### P0 — Close the Extension authentication flow

- [ ] Align SDK /v1/exchange request with the Worker JSON schema, including UUID state.
- [ ] Add explicit callback state equality validation against the initiated transaction.
- [ ] Use the transaction's stored redirect URI during exchange.
- [ ] Ensure transaction cleanup on launcher rejection, OAuth denial, callback parse errors, exchange failure, and success.
- [ ] Replace the hardcoded localhost base URL with explicit development/production endpoint configuration.
- [ ] Verify the exact exchange success/error envelope and data.user shape against the Worker response helpers.
- [ ] Validate HTTP status and response JSON safely, including non-JSON and malformed responses.
- [ ] Complete extension login end-to-end against the intended Auth Worker environment.
- [ ] Verify cookie creation and subsequent authenticated session lookup.

**Exit condition:** a clean extension install can log in, retrieve the session, log out, and log in again; invalid state/code and network/server errors fail predictably.

### P0 — Complete session lifecycle in the SDK

- [ ] Validate getSession() for anonymous, active, near-expiry, refreshed, revoked, expired, and temporary provider failure cases.
- [ ] Ensure getSession() never starts interactive login.
- [ ] Implement NinjaAuth.logout() using POST /v1/logout with credentials: "include".
- [ ] Define SDK behavior for already-anonymous sessions and partial upstream revocation failures.
- [ ] Verify that a subsequent session lookup after logout returns unauthenticated.
- [ ] Document `/v1/logout` as current-session-only.
- [ ] Decide whether a proposed `/v1/logout/all` belongs in the public SDK API or remains an account-management operation; it is not implemented.
- [ ] Handle upstream revocation HTTP failures explicitly; the reviewed Worker handler does not currently check `response.ok` on the provider revoke response.

**Exit condition:** the public SDK reliably exposes the central session lifecycle and logout invalidates the local session server-side.

### P1 — SDK security and test foundation

- [ ] Add a test runner and CI for the SDK package.
- [ ] Add unit tests for PKCE, state generation/validation, callback parsing, request construction, and response parsing.
- [ ] Add integration tests against a mocked Auth Worker contract.
- [ ] Test OAuth denial, missing code/state, state mismatch, expired/reused transaction, exchange failure, network failure, and browser cancellation.
- [ ] Add typed SDK error codes while preserving underlying causes.
- [ ] Confirm no token, verifier, or raw session secret is logged or unnecessarily exposed.
- [ ] Verify cookie attributes, CORS, and credentialed requests from each supported origin.

### P1 — Finish and validate backend concurrency coverage

RT-003 covers logout committed before the resolver's final session revalidation. The following cases remain open investigation/test items; they are not asserted defects until their exact ordering and expected behavior are established.

- [ ] Analyze late upstream rotation: logout may revoke R1 while refresh is in flight, after which the provider may return R2. Determine whether R2 must be revoked upstream even though the local session remains revoked.
- [ ] Add focused tests for relevant timeout, provider failure, duplicate logout, absolute expiry, and additional refresh/logout orderings according to risk.
- [ ] Keep tests explicit about real PostgreSQL state versus mocked provider behavior.
- [ ] Preserve the invariant that a revoked local session can never be reactivated by refresh.

### P1 — Stabilize the public SDK contract

- [ ] Finalize public types and contracts for init, login, getSession, and logout.
- [ ] Decide whether the SDK remains a singleton or supports independent client instances.
- [ ] Do not silently default to an unsupported platform; reject unsupported platform use explicitly until implemented.
- [ ] Normalize user/session response types and nullability.
- [ ] Add timeout/cancellation behavior where appropriate.
- [ ] Define semantic-versioning and compatibility policy.
- [ ] Decide and document the public status of NinjaAppAdapter<TProfile>; do not imply it is available until implemented and exported.

### P2 — Web support

- [ ] Define platform-neutral authorization-launcher and transaction-storage interfaces before implementing platform adapters.
- [ ] Design the web redirect/callback lifecycle.
- [ ] Define browser storage and multi-tab transaction handling.
- [ ] Validate same-site cookie behavior, CORS, and credentialed requests for production domains.
- [ ] Implement the Web launcher and transaction storage.
- [ ] Reject unsupported Web use explicitly until the implementation is complete.
- [ ] Add browser-level integration tests.

### P2 — OIDC Discovery and provider interoperability

**Goal:** make the identity-provider integration replaceable without changing the public NinjaAuth API or coupling consuming applications to a specific provider. Authgear remains the current provider; this work is about interoperability, not a planned provider migration.

- [ ] Define the trusted OIDC issuer configuration for Ninja Connect and the public discovery URL (for example, the well-known OpenID Connect configuration document on the stable Ninja Connect authentication domain).
- [ ] Add an OIDC Discovery client that retrieves and parses the provider metadata document and maps the advertised endpoints and capabilities into a typed configuration.
- [ ] Validate the metadata issuer against the configured/trusted issuer; require HTTPS for production endpoints and apply explicit endpoint and algorithm allow-lists.
- [ ] Define which discovery metadata is consumed by NinjaAuth to initiate authorization and which metadata remains server-side for Ninja Connect's token exchange, user identity resolution, refresh, key retrieval, and revocation.
- [ ] Keep provider-specific credentials, token exchange, refresh tokens, and server-side secrets inside Ninja Connect; do not move broker responsibilities into the browser SDK.
- [ ] Define the minimum provider conformance profile: Authorization Code flow, PKCE S256, required OIDC claims and stable subject identifier, token response semantics, signing algorithms/JWKS validation, and required session lifecycle capabilities.
- [ ] Treat optional metadata and capabilities (for example UserInfo, revocation, and supported logout mechanisms) explicitly; do not assume every provider implements every optional endpoint.
- [ ] Add controlled metadata caching and refresh behavior, including handling for unavailable, malformed, stale, or inconsistent discovery documents.
- [ ] Add conformance tests using Authgear as the first verified implementation and a standards-compliant test provider or mock as an interoperability fixture.
- [ ] Document the public provider integration contract so that a provider implementation can be assessed against the same requirements without changing NinjaAuth's consumer-facing API.

**Architecture guardrail:** NinjaAuth integrates with the stable Ninja Connect contract. Discovery may inform the authorization flow, but the SDK must not become coupled to Authgear-specific behavior or receive provider secrets. Ninja Connect remains responsible for the upstream identity-provider integration and central session lifecycle. The exact division of discovery consumption between SDK and broker must be finalized against the implemented authorization-flow contract before coding.

**Exit condition:** the current Authgear integration continues to pass the conformance suite, and a second compatible provider can be integrated behind Ninja Connect without changing the public NinjaAuth API or consuming applications.

### P2 — Developer experience and release

- [ ] Add copy-paste examples for supported platforms.
- [ ] Document OAuth client configuration and redirect URI registration.
- [ ] Add CI for typecheck, unit tests, build, and package inspection.
- [ ] Confirm package contents include only intended artifacts.
- [ ] Add changelog, license, support policy, and release checklist.
- [ ] Publish only after the extension end-to-end and session lifecycle exit criteria pass.

## Near-term implementation plan — next working session

1. Complete the Extension API contracts for `/v1/exchange`, `/v1/session`, `/v1/user/me`, and `/v1/logout`, including payloads, response/error envelopes, cookie behavior, CORS, and failure handling.
2. Define platform-neutral SDK interfaces and the Web redirect/callback/transaction-storage flow.
3. Integrate NinjaAuth into the extension background service worker; keep OAuth, PKCE, and session orchestration out of the sidepanel.
4. Validate Extension login, session restoration, logout, and login-again end-to-end; add SDK tests.
5. Decide whether global logout should be exposed by the SDK. `/v1/logout/all` remains a proposal, not an implemented route.
6. Preserve provider neutrality: do not encode AuthGear-specific behavior in the public SDK contract. OIDC Discovery/interoperability remains a future architectural requirement.

## Future scope — not Core 0.1

- Provider management and dynamic provider selection beyond the interoperability contract described above.
- Account linking, MFA, passkeys, and device management.
- Application profile management.
- Product roles, permissions, and capabilities.
- Analytics and plan-specific provider availability.

These remain separate from the Core identity/session contract.

## Definition of Done — NinjaAuth Core 0.1

Core 0.1 is complete only when the implementation, tests, and documentation agree that the following works on every platform explicitly declared as supported:

~~~ts
NinjaAuth.init(config);
const user = await NinjaAuth.login();
const session = await NinjaAuth.getSession();
await NinjaAuth.logout();
~~~

Required evidence:

- OAuth and PKCE work, and state is validated.
- Session creation, restoration, refresh, and logout behave as documented.
- SDK and Worker request/response contracts match.
- Automated tests and CI cover critical success and failure paths.
- No platform-specific dependency leaks into the platform-agnostic Core.
- Product-specific authorization remains with the consuming product.
- No unsupported platform silently hangs.
- The release artifact and public documentation describe the same API.

Only then should Core 0.1 be frozen and released.
