# Ninja Connect Auth API — SDK/Worker Contract

This document records the contract visible in the SDK source and the Auth Worker implementation reviewed during the NinjaAuth audit. It is an integration checklist, not a substitute for the Worker implementation.

## Worker routes

Worker source currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker).

| Method | Path | Purpose | SDK status in inspected source |
|---|---|---|---|
| POST | /v1/exchange | Exchange authorization code and create application session | SDK request currently mismatches Worker schema |
| GET | /v1/session | Resolve current Ninja Connect session; may refresh server-side | SDK calls it; runtime response validation needs strengthening |
| GET | /v1/user/me | Return the current authenticated user | Worker route exists; public SDK method/contract mapping remains to finalize |
| POST | /v1/logout | Revoke only the session identified by the current `ninja_session` cookie; attempt upstream refresh-token revocation; clear current cookie | Worker route exists; SDK method is incomplete/TODO |
| POST (proposed; not implemented) | /v1/logout/all | Revoke all active Ninja Connect sessions belonging to the authenticated user | Architecture proposal only; not an available route or SDK method |

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

### Current-session logout — `POST /v1/logout`

The reviewed Worker implementation is **session-specific**, not global. It identifies the session using the `ninja_session` cookie on the current request, revokes only that `auth_sessions` row, attempts to revoke that row's encrypted upstream refresh token, and clears the cookie in the current browser response. Other active sessions belonging to the same user remain independent.

**Known implementation issue:** the reviewed handler does not check `response.ok` after the upstream `/oauth2/revoke` fetch. HTTP 4xx/5xx responses do not necessarily throw, so the route may report success even when the provider rejected revocation. Local revocation must remain authoritative, while the upstream outcome should be observed and represented accurately.

### Global logout — `POST /v1/logout/all` (proposed)

This route has been discussed but is **not implemented**. Intended semantics, subject to final contract approval:

1. Authenticate the current session and derive the user ID from the authenticated server-side context, never from a client-supplied user ID.
2. Revoke all active Ninja Connect sessions for that user in the local database.
3. Attempt upstream refresh-token revocation for each affected session, with bounded work and explicit partial-failure reporting.
4. Clear the current browser's cookie. Other devices retain their cookies, but their local session records are revoked and subsequent requests must fail.

Whether NinjaAuth exposes this operation directly or leaves it to an account-management layer remains undecided. Do not advertise it as an existing SDK capability.

### Local session versus upstream SSO

AuthGear SSO sessions and Ninja Connect `auth_sessions` are separate. An AuthGear `/logout` operation ends the provider's SSO session; it does not directly mutate Ninja Connect's database. Conversely, revoking a Ninja Connect session does not by itself prove that every AuthGear SSO session or provider-issued credential has been terminated.

The custom AuthGear `/settings` page is provider account/security UI (for example, provider sessions and connected devices). Ninja Connect may provide its own account/settings experience for Ninja identity and application sessions. These are separate product responsibilities.

Local session invalidation is the security boundary for subsequent Ninja Connect requests. Remote token revocation is a separate upstream operation and may fail independently; API/SDK behavior must distinguish local logout success from upstream revocation failure.

A successful local logout must not be undone by an in-flight refresh. Conditional database updates must require that the session is still active, and subsequent session resolution must reject a revoked session.

## Backend concurrency verification

Three focused PostgreSQL integration tests were added to the Auth Worker across test/diagnostic branches in the NinjaURL repository.

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

### RT-003 — logout before resolver return

**Invariant:** if logout commits after the user lookup/refresh work but before the resolver's final session revalidation, the resolver must not return an authenticated context.

- `resolveSession()` performs a final database read of the same session before returning authenticated.
- It rejects a missing row, a revoked row, an absolute expiry, or an ordinary expiry at the final check.
- Implementation commit: `7d89d4412cd85727578225517b8f03ed58f71aa3`.
- Integration test: `Workers/auth-worker/integration-tests/resolve-session-logout-race.integration.test.ts`.
- Test commit: `65c8127377ebcb3c8712452f223a07fd0b1649d1`.
- The test uses real Neon/PostgreSQL state, the actual Worker logout route, and a mocked upstream refresh response; it checks resolver rejection and `/v1/session` HTTP 401, then verifies the row remains revoked.
- [CI run 41196276386](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/actions/runs/41196276386) was reported successful by the project owner; verify the run before relying on it as independently audited evidence.

RT-003 covers logout committed before the final session read. A logout that commits after that final read is outside the guarantee of this check; the final read is not a distributed lock.

## Remaining concurrency questions

The following cases remain open for analysis/testing; they are not claimed to be defects until the exact interleavings and intended semantics are verified:

1. **Late upstream rotation:** logout may revoke R1 while a refresh request is still in flight; the provider may subsequently return R2 after logout has completed. The local database session remains revoked, but the lifecycle/revocation of the newly issued upstream token needs separate analysis.
3. **Additional ordering/failure cases:** provider timeout, network failure, duplicate logout, absolute expiry, and refresh completion ordering should be covered according to risk and observed behavior.

## Response contract still to standardize

The exact JSON success/error envelope and the data.user shape returned by /v1/exchange must be verified against the shared Worker response helpers and the actual current Worker branch. Do not assume the SDK's current data.user cast proves the response contract.

## Acceptance checklist

- [ ] Method, path, content type, required fields, and response schema are documented for each endpoint.
- [ ] `/v1/logout` is explicitly documented as current-session-only; any global logout route is marked proposed until implemented.
- [ ] AuthGear SSO logout/settings and Ninja Connect session/account management are documented as separate lifecycles.
- [ ] State format and lifetime are consistent across SDK, callback, and exchange endpoint.
- [ ] State is bound to the correct client, redirect URI, and PKCE verifier.
- [ ] Missing, reused, expired, or mismatched state cannot complete an exchange.
- [ ] Session cookie is set, sent, refreshed, and cleared as expected.
- [ ] Logout revokes the local session even if remote token revocation is unavailable.
- [ ] CORS and credential behavior is tested from every supported client origin.
- [ ] SDK error handling matches the Worker response envelope.
