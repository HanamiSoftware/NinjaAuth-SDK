# Ninja Connect Auth API — SDK/Worker Contract

This document records the SDK contract implemented in source and the Auth Worker contract as currently documented. The Worker lives in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Verify the Worker branch and commit before treating cross-repository behavior as current.

## Worker routes

| Method | Path | Purpose | SDK status |
|---|---|---|---|
| POST | /v1/exchange | Exchange authorization code and create the Ninja Connect session | Implemented in SDK source; JSON request and data.user validation |
| GET | /v1/session | Resolve current session; may refresh server-side | Implemented in SDK source; normalized NinjaSession validation |
| GET | /v1/user/me | Return current authenticated user | Worker route; not a separate public NinjaAuth method |
| POST | /v1/logout | Revoke the session identified by the current ninja_session cookie and clear that cookie | Implemented in SDK source; requires explicit logout confirmation |
| POST (proposed, not implemented) | /v1/logout/all | Revoke all active sessions for the authenticated user | Not available; not an SDK method |

The experimental POST /v1/state route is not part of the intended SDK flow. NinjaAuth creates and validates the OAuth transaction client-side and sends its UUID state in the exchange request.

## SDK public contract

```ts
NinjaAuth.init({
  clientId: string,
  redirectUri: string,
  platform?: "extension" | "web",
  environment?: "development" | "production"
});

const user: NinjaUser = await NinjaAuth.login();
const session: NinjaSession = await NinjaAuth.getSession();
await NinjaAuth.logout();
```

- login() returns Promise<NinjaUser>.
- getSession() returns Promise<NinjaSession>.
- logout() returns Promise<void>.
- Interactive login is implemented for Chrome Extension. Web login rejects with UNSUPPORTED_PLATFORM.

## Exchange request

The SDK sends a JSON body containing state (UUID), code, client_id, code_verifier, and redirect_uri. It uses PKCE S256, compares callback state with the original state before exchange, and validates the response envelope and data.user before resolving login().

## Authorization scope and environment

The source default scope is `openid profile email offline_access`. Per-consumer custom scope configuration is future work, not part of the current public configuration contract.

| Environment | API base |
|---|---|
| development | http://127.0.0.1:8787/v1 |
| production | https://auth.ninjaconnect.io/v1 |

The default environment is production. The authorization origin remains https://auth.ninjaconnect.io.

**Known artifact mismatch on SDK master:** source uses the full default scope, while the committed `dist/index.global.js` authorization request still uses `openid offline_access`. Rebuild and inspect generated artifacts before distribution. The vendored Extension IIFE must be compared against the generated SDK artifact; its previous reported scope alone does not prove byte-for-byte alignment.

## OAuth state and transaction handling

- Generate unpredictable state and bind it to the initiating client and redirect URI.
- Verify callback state against the original transaction before exchanging the code.
- Retrieve the transaction only by the original state; reject missing or mismatched transactions.
- Remove transaction data on success, OAuth denial, cancellation, parse errors, and exchange failures.
- If cleanup fails after a successful operation, surface TRANSACTION_CLEANUP_FAILED.
- If the main operation already failed, cleanup failure must not mask the primary error.
- Keep the PKCE verifier short-lived and do not log it.

## Session and cookie requirements

- Session creation sets the ninja_session cookie.
- Session and logout requests use credentials: "include".
- The cookie is HttpOnly; SDK JavaScript cannot and must not read it directly.
- Validate CORS origin/credentials settings and cookie attributes against actual Extension and production origins.
- Do not put the raw session secret or upstream refresh token in SDK storage.
- The Worker stores a hash of the session secret and encrypts the upstream refresh token at rest.
- The session has a normal expiry and an absolute expiry; refresh must not extend the absolute expiry.

## Session observation semantics — getSession()

getSession() observes the current Ninja Connect session and returns its normalized authentication state. It does not start interactive authorization.

- A successful 200 response with data.authenticated === false is a normal unauthenticated result.
- A 401 response is mapped to unauthenticated only when the response envelope explicitly contains error.code === INVALID_SESSION.
- Other authorization errors, including USER_NOT_FOUND, remain errors.
- Network failures, malformed JSON/payloads, server errors, and temporary refresh failures remain errors. They must not be represented as an unauthenticated session.

```ts
type NinjaSession = {
  authenticated: boolean;
  user: NinjaUser | null;
  session: {
    expiresAt: string;
    absoluteExpiresAt: string;
  } | null;
};
```

## Extension runtime adapter

The Background adapts the SDK session contract to Chrome runtime messages. The Side Panel must remain a UI client and must not implement OAuth or call Auth Worker session routes directly.

Cache-first restore is an Extension-branch-specific behavior, not part of the SDK API contract. A cached user restores UI only; it is not proof of a valid server session. A protected operation must obtain a fresh getSession() result before relying on authentication. See the central NinjaURL roadmap for the current Extension branch and evidence.

## Logout semantics

POST /v1/logout is current-session-only. It identifies the session using the ninja_session cookie on the current request, revokes that local session, attempts upstream refresh-token revocation, and clears the current cookie. Other active sessions belonging to the same user remain independent.

The SDK resolves logout() only when the HTTP response and success envelope confirm data.loggedOut === true.

Global logout at POST /v1/logout/all is not implemented. AuthGear SSO sessions and Ninja Connect auth_sessions are separate lifecycles.

## Backend concurrency verification

RT-001, RT-002, and RT-003 are focused PostgreSQL integration scenarios recorded in the NinjaURL repository. They use real PostgreSQL/Neon state and mocked upstream provider responses. They prove only the orchestrated interleavings; they are not live provider E2E tests or proof of every possible distributed execution. Exact branch/commit/CI evidence is maintained in the central NinjaURL roadmap.

## Verification boundary

For the reviewed SDK master commit:

- Source and a 20-case Node.js test file are present.
- Presence of tests is not a claim that they passed on this commit.
- No successful status check or fresh local validation run is asserted here.
- The generated SDK IIFE is stale after the source scope change.
- Extension build and real Chrome/Worker cookie/CORS E2E have not been verified here.

Do not infer release readiness from the presence of source code or tests alone.
