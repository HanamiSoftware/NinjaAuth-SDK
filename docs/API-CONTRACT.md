# Ninja Connect Auth API — SDK/Worker Contract

This document records the contract visible in the SDK source and the Auth Worker implementation reviewed during the NinjaAuth audit. It is an integration checklist, not a substitute for the Worker implementation.

## Worker routes

Worker source currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker).

| Method | Path | Purpose | SDK status in inspected source |
|---|---|---|---|
| GET | /v1/session | Resolve current Ninja Connect session | SDK calls it |
| POST | /v1/exchange | Exchange authorization code and create application session | SDK calls it with a mismatched request schema |
| POST | /v1/logout | Revoke local session, attempt upstream token revocation, and clear cookie | SDK method is a TODO |
| GET | /v1/user/me | Return current authenticated user | No corresponding public SDK method shown |

The experimental POST /v1/state route is not part of the intended SDK flow. It may be removed; the SDK must not depend on it unless the architecture is deliberately revised.

## Exchange request — mismatch to close

The inspected SDK currently sends application/x-www-form-urlencoded with grant_type, code, redirect_uri, client_id, and code_verifier.

The reviewed Worker contract expects a JSON body containing state (UUID), code, client_id, code_verifier, and redirect_uri.

Therefore, the current SDK request is not aligned: it uses a different content type, omits state, and its state generator emits hexadecimal text rather than a UUID. The client must be updated to match the agreed Worker schema, or the server schema must be changed deliberately and consistently.

The SDK currently hardcodes http://127.0.0.1:8787/v1 in src/NinjaAuth.ts; endpoint/environment configuration must be explicit and production-safe.

## OAuth state and transaction handling

- Generate unpredictable state and bind it to the initiating client and redirect URI.
- Verify callback state against the state of the original transaction before exchanging the code.
- Retrieve the transaction only by returned state; reject missing, expired, reused, or mismatched transactions.
- Remove transaction data on success, OAuth denial, cancellation, parse errors, and network failures.
- Keep the PKCE verifier short-lived and do not log it.

The experimental /v1/state registration endpoint is not a required SDK step. The SDK stores its transaction locally and sends required state with the code exchange. Do not revive the endpoint as a dependency simply to work around the SDK/Worker exchange mismatch.

## Session and cookie requirements

- Session creation sets a ninja_session cookie.
- Session and logout requests must use credentials: "include" where browser cookie policy permits.
- The cookie is HttpOnly; SDK JavaScript cannot and must not read it directly.
- Validate CORS origin/credentials settings and cookie attributes against the actual production origin layout.
- Do not put the raw session secret or upstream refresh token in SDK storage.
- The Worker stores a hash of the session secret and encrypts the upstream refresh token at rest.
- The session has a normal expiry and an absolute expiry; refresh must not extend the absolute expiry.

## Logout semantics

Logout revokes the local Ninja Connect session in the database and clears the browser cookie. It also attempts to revoke the upstream refresh token with the identity provider.

Local session invalidation is the security boundary for subsequent application requests. Remote token revocation is a separate upstream operation and may fail independently; the SDK/API contract must define how a partial upstream failure is surfaced or logged.

A successful logout must not be undone by an in-flight refresh. Conditional database updates must require that the session is still active, and subsequent session resolution must reject a revoked session.

## Backend concurrency verification

Two focused PostgreSQL integration tests were added to the Auth Worker on branch test/auth-refresh-concurrency-rt001 in the NinjaURL repository.

### RT-001 — concurrent refresh / stale invalid_grant

**Invariant:** if request A rotates refresh token R1 to R2, a concurrent request B that used stale R1 and receives invalid_grant must not revoke the session already updated by A.

- Uses two independent PostgreSQL clients against the Neon test database.
- Simulates concurrent provider responses; Authgear token endpoints are mocked.
- Verifies both refresh operations resolve successfully for the active session and persisted token remains R2 with revokedAt = NULL.
- [CI run 41073531083](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41073531083) — success.

### RT-002 — logout while refresh operations are in flight

**Invariant:** logout must prevail over refresh operations still waiting for the provider. A later successful refresh response must not reactivate the local session.

- Uses PostgreSQL/Neon with independent database clients and exercises the real Worker logout route.
- Simulates provider token/revocation responses; Authgear endpoints are mocked.
- Verifies logout persists revokedAt before refresh operations complete, both refresh operations return INVALID_REFRESH_TOKEN, and the final database row remains revoked with the old stored refresh token.
- [CI run 41078846722](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41078846722) — success.

**Evidence boundary:** these are real PostgreSQL integration tests with a simulated identity provider. They are not full end-to-end tests against a live Authgear tenant. They validate the specific interleavings described above, not every possible distributed execution. The changes and tests are on a separate branch; they have not been merged or deployed.

## Remaining concurrency questions

The following cases remain open for analysis/testing; they are not claimed to be defects until the exact interleavings and intended semantics are verified:

1. **Resolver return window:** logout may occur after refreshSession() succeeds but before resolveSession() finishes returning an authenticated result. The current RT-002 scenario does not exercise this exact window.
2. **Late upstream rotation:** logout may revoke R1 while a refresh request is still in flight; the provider may subsequently return R2 after logout has completed. The local database session remains revoked, but the lifecycle/revocation of the newly issued upstream token needs separate analysis.
3. **Additional ordering/failure cases:** provider timeout, network failure, duplicate logout, absolute expiry, and refresh completion ordering should be covered according to risk and observed behavior.

## Response contract still to standardize

The exact JSON success/error envelope and the data.user shape returned by /v1/exchange must be verified against the shared Worker response helpers and the actual current Worker branch. Do not assume the SDK's current data.user cast proves the response contract.

## SDK implementation notes — 1 November 2026

The following reflects changes reported in the developer's local working tree during the current session. It is not evidence that the changes have been pushed, reviewed from the repository, or covered by automated tests.

### Internal errors and callback handling

- An internal `NinjaAuthInternalError` class carries a typed `InternalErrorCode` and optional original cause.
- `NinjaAuthErrorException(error, code, message)` returns an existing classified error unchanged, or wraps an unknown error with a clear SDK-level message.
- Callback parsing classifies malformed callbacks, OAuth denial (`access_denied`), and other provider errors separately.
- The authorization flow compares the callback state with the originally generated state and removes the stored transaction in a `finally` path.
- The transaction cleanup path still needs review to ensure a storage-removal failure cannot mask the primary operation error.

### Chrome transaction storage

The local implementation uses `chrome.storage.session`. The `get()` method currently uses a TypeScript assertion for the retrieved value:

```ts
return (result[key] as OAuthTransaction | undefined) ?? null;
```

This resolves the static type mismatch but does not validate the stored value at runtime. Runtime validation remains a separate hardening consideration. The `@types/chrome` package has been installed as a development dependency to provide Chrome API typings.

### Authorization request parameters

The current local authorization URL builder retains the `openid` and `offline_access` scopes and no longer adds `profile`, `email`, or a `resource` parameter by default. Any future supported parameters should be configured and validated through the SDK initialization contract rather than silently hardcoded.

### Session lookup semantics to preserve

- A valid anonymous Worker response is a successful normalized session: `{ authenticated: false, user: null, session: null }`.
- A valid authenticated response must contain a valid user and session metadata.
- Network failures, non-success Worker envelopes, malformed JSON, and malformed session data are operational errors; they must reject the Promise and must not be treated as anonymous.
- `getSession()` must not launch interactive authorization.

The implementation of `getSession()` validation and these semantics is the next SDK task; this section records the contract, not a claim that the method is already complete.

## Acceptance checklist

- [ ] Method, path, content type, required fields, and response schema are documented for each endpoint.
- [ ] State format and lifetime are consistent across SDK, callback, and exchange endpoint.
- [ ] State is bound to the correct client, redirect URI, and PKCE verifier.
- [ ] Missing, reused, expired, or mismatched state cannot complete an exchange.
- [ ] Session cookie is set, sent, refreshed, and cleared as expected.
- [ ] Logout revokes the local session even if remote token revocation is unavailable.
- [ ] CORS and credential behavior is tested from every supported client origin.
- [ ] SDK error handling matches the Worker response envelope.
