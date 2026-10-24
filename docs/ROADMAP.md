# NinjaAuth SDK — Roadmap

This roadmap reflects the repository source inspected on 24 October 2026. Status labels describe the code currently visible in the repository, not work that may exist only in a local working tree.

## Current snapshot

| Area | Status | Evidence / note |
|---|---|---|
| TypeScript package/build setup | 🟡 Present, needs release hardening | tsup builds ESM, CJS, types, and an IIFE bundle; no stable release workflow is documented. |
| SDK initialization | 🟡 Basic implementation | `init()` stores client ID, redirect URI, and platform. Runtime validation and endpoint configuration need tightening. |
| PKCE S256 utilities | 🟢 Implemented | Verifier/challenge are generated with Web Crypto. Add tests. |
| OAuth state generation | 🟡 Implemented, contract mismatch | SDK currently generates hex state; worker's state schema expects a UUID. |
| Chrome authorization launcher | 🟡 Implemented | Uses `chrome.identity.launchWebAuthFlow`; requires end-to-end validation. |
| Chrome transaction storage | 🟡 Implemented | Uses `chrome.storage.session`; cleanup on every failure path needs work. |
| Authorization callback parsing | 🟡 Basic implementation | Parses errors/code/state. Explicit comparison against the originally generated state is not yet performed. |
| Server-side OAuth transaction registration | 🔴 Not wired in SDK | Worker exposes `POST /v1/state`; current SDK flow does not call it. |
| Code exchange | 🔴 Contract mismatch | SDK sends form-urlencoded fields and omits `state`; worker currently parses JSON and requires a UUID `state`. |
| Session lookup | 🟡 Implemented | SDK calls `GET /v1/session`; confirm response schema and cookie behavior in integration tests. |
| Logout | 🟡 Worker implemented, SDK missing | Worker exposes `POST /v1/logout`; SDK method remains a TODO. |
| Web platform | 🔴 Not implemented | The branch ends in a Promise that never settles. |
| Endpoint/environment configuration | 🔴 Incomplete | Client hardcodes `http://127.0.0.1:8787/v1`; constants in `src/config.ts` are not consistently used. |
| Automated SDK tests | 🔴 Not sufficient | No test script is present in the SDK package manifest. |
| Developer documentation | 🟡 Added in this branch | Review and keep synchronized with API changes. |
| Public SDK readiness | 🔴 Not ready | End-to-end contract, tests, errors, browser support, and release criteria remain. |

## Phase 0 — Make the existing extension flow coherent (P0)

- [ ] Agree and document the canonical request/response schemas for `/v1/state`, `/v1/exchange`, `/v1/session`, `/v1/logout`, and `/v1/user/me`.
- [ ] Align state format between SDK and worker (UUID versus hex), or change the server contract deliberately and consistently.
- [ ] Register OAuth transaction state with `POST /v1/state` if this endpoint remains part of the design.
- [ ] Send the exchange body in the format the worker actually accepts; include all required fields, especially `state`.
- [ ] Use the transaction's stored `redirectUri` when exchanging, rather than relying only on mutable client config.
- [ ] Add explicit state equality/transaction validation and remove temporary transaction data in every success/failure path.
- [ ] Add the SDK call to `POST /v1/logout` with `credentials: "include"`.
- [ ] Replace the localhost endpoint constant with explicit development/production configuration.
- [ ] Ensure HTTP error handling safely handles non-JSON responses and malformed response payloads.

**Exit criteria:** a clean install of the extension can log in, retrieve the session, log out, and log in again; invalid state/code and network/server errors fail predictably; the cookie is cleared on logout.

## Phase 1 — Security and reliability (P1)

- [ ] Add unit tests for PKCE, state generation/validation, callback parsing, request construction, and response parsing.
- [ ] Add integration tests against a mocked Auth Worker contract.
- [ ] Test OAuth denial, missing code/state, state mismatch, expired transaction, exchange failure, and browser cancellation.
- [ ] Guarantee transaction cleanup on every path, including launcher rejection and callback parsing errors.
- [ ] Review cookie attributes, CORS/credentials behavior, and supported origins with the worker deployment configuration.
- [ ] Define whether remote token revocation failure is reported, logged, or represented as a partial logout result.
- [ ] Add stable typed SDK error codes while preserving useful underlying causes.
- [ ] Verify that no access token, refresh token, verifier, or raw session secret is logged or unnecessarily exposed to application code.

**Exit criteria:** security-sensitive paths are covered by automated tests and the documented behavior matches observed worker behavior.

## Phase 2 — Stable SDK API (P1)

- [ ] Finalize public types and method contracts for `init`, `login`, `getSession`, and `logout`.
- [ ] Decide whether the public SDK is a singleton or supports independent client instances.
- [ ] Decide and document supported platforms rather than defaulting silently to an unimplemented web flow.
- [ ] Normalize user/session response types and nullability.
- [ ] Add timeout/cancellation behavior where appropriate.
- [ ] Define semantic-versioning and compatibility policy.

**Exit criteria:** API behavior is deterministic, documented, and tested; no public method silently hangs.

## Phase 3 — Web support (P2)

- [ ] Design the web redirect/callback lifecycle.
- [ ] Define browser storage and multi-tab transaction handling.
- [ ] Validate same-site cookie behavior, CORS, and credentialed requests for the production domains.
- [ ] Implement web login or reject the platform explicitly until it is supported.
- [ ] Add browser-level integration tests.

**Exit criteria:** the web flow has a separate, reviewed implementation and documented browser support.

## Phase 4 — Developer experience and release (P2)

- [ ] Add copy-paste examples for Chrome extension and web once each flow is supported.
- [ ] Document required OAuth client configuration and redirect URI registration.
- [ ] Add CI for typecheck, unit tests, build, and package inspection.
- [ ] Confirm published package contents include only intended artifacts.
- [ ] Add changelog, license, support policy, and release checklist.
- [ ] Publish a version only after the extension end-to-end exit criteria are met.

## Suggested execution order

1. **Contract first:** settle request/response schemas with the Auth Worker.
2. **Fix extension login:** state registration, state format, exchange payload, cleanup.
3. **Implement SDK logout and verify session behavior.**
4. **Add tests before broadening platform support.**
5. **Implement web support as a separate milestone.**
6. **Release only after end-to-end validation.**

## Out of scope for this roadmap

This document does not claim that the Auth Worker or Authgear deployment has been tested live. It records repository-level observations and the work needed to validate the complete system.
