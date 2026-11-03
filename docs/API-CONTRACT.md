# Ninja Connect Auth API — SDK/Worker Contract

This document records the current contract implemented by the NinjaAuth SDK source and the Auth Worker currently hosted in the NinjaURL repository. It is an integration reference, not a substitute for the Worker implementation.

## Worker routes

Worker source currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker).

| Method | Path | Purpose | SDK status |
|---|---|---|---|
| POST | /v1/exchange | Exchange authorization code and create the Ninja Connect session | Implemented; JSON request and data.user validation |
| GET | /v1/session | Resolve current session; may refresh server-side | Implemented; normalized NinjaSession validation |
| GET | /v1/user/me | Return current authenticated user | Worker route exists; not a separate public NinjaAuth method |
| POST | /v1/logout | Revoke the session identified by the current ninja_session cookie and clear that cookie | Implemented; requires explicit logout confirmation |
| POST (proposed, not implemented) | /v1/logout/all | Revoke all active sessions for the authenticated user | Not available; not an SDK method |

The experimental POST /v1/state route is not part of the intended SDK flow. NinjaAuth creates and validates the OAuth transaction client-side and sends its UUID state in the exchange request.

## SDK public contract

~~~ts
NinjaAuth.init({
  clientId: string,
  redirectUri: string,
  platform?: "extension" | "web",
  environment?: "development" | "production"
});

const user: NinjaUser = await NinjaAuth.login();
const session: NinjaSession = await NinjaAuth.getSession();
await NinjaAuth.logout();
~~~

- login() returns Promise<NinjaUser>.
- getSession() returns Promise<NinjaSession>.
- logout() returns Promise<void>.
- The current implementation supports interactive login on Chrome Extension. Web login rejects with UNSUPPORTED_PLATFORM.

## Exchange request

The SDK sends a JSON body containing:

- state — UUID generated for the initiating OAuth transaction;
- code — authorization code from the validated callback;
- client_id — registered consuming application client ID;
- code_verifier — PKCE verifier stored for the transaction;
- redirect_uri — redirect URI associated with the original transaction.

The SDK uses PKCE S256, compares the returned callback state with the original state before exchange, and validates the response envelope and data.user before resolving login().

## Authorization scope and environment

The source default is read from NINJA_CONNECT.DEFAULT_SCOPE:

~~~text
openid profile email offline_access
~~~

The scope is used to obtain the profile claims consumed by NinjaURL. Per-consumer custom scope configuration is future work, not part of the current public configuration contract.

API endpoints are environment-aware:

| Environment | API base |
|---|---|
| development | http://127.0.0.1:8787/v1 |
| production | https://auth.ninjaconnect.io/v1 |

The default environment is production. The authorization endpoint remains https://auth.ninjaconnect.io.

**Artifact mismatch:** the current SDK source uses the full default scope above, but dist/index.global.js has not yet been rebuilt after the scope change and still sends openid offline_access in its authorization request. The Extension's vendored IIFE contains the full scope. Rebuild and compare artifacts before publishing the SDK.

## OAuth state and transaction handling

- Generate unpredictable state and bind it to the initiating client and redirect URI.
- Verify callback state against the state of the original transaction before exchanging the code.
- Retrieve the transaction only by the original state; reject missing or mismatched transactions.
- Remove transaction data on success, OAuth denial, cancellation, parse errors, and exchange failures.
- If cleanup fails after a successful operation, surface TRANSACTION_CLEANUP_FAILED.
- If the main operation already failed, cleanup failure must not mask the primary error.
- Keep the PKCE verifier short-lived and do not log it.

## Session and cookie requirements

- Session creation sets the ninja_session cookie.
- Session and logout requests use credentials: "include".
- The cookie is HttpOnly; SDK JavaScript cannot and must not read it directly.
- Validate CORS origin/credentials settings and cookie attributes against the actual Extension and production origins.
- Do not put the raw session secret or upstream refresh token in SDK storage.
- The Worker stores a hash of the session secret and encrypts the upstream refresh token at rest.
- The session has a normal expiry and an absolute expiry; refresh must not extend the absolute expiry.

## Session observation semantics — getSession()

getSession() observes the current Ninja Connect session and returns its normalized authentication state. It does not start the interactive authorization flow.

The SDK distinguishes an unauthenticated state from a failure to determine the session:

- A successful 200 response with data.authenticated === false is a normal unauthenticated result.
- A 401 response is mapped to unauthenticated only when the response envelope explicitly contains error.code === "INVALID_SESSION".
- Other authorization errors, including USER_NOT_FOUND, remain errors.
- Network failures, malformed JSON or payloads, server errors, and temporary refresh failures remain errors. They must not be represented as an unauthenticated session.

A normalized NinjaSession has the shape:

~~~ts
type NinjaSession = {
  authenticated: boolean;
  user: NinjaUser | null;
  session: {
    expiresAt: string;
    absoluteExpiresAt: string;
  } | null;
};
~~~

## Extension runtime adapter — cache-first restore

The Extension Background adapts the SDK session contract to Chrome runtime messages.

The Side Panel sends RESTORE_SESSION. The Background responds with a stable envelope containing success, authenticated, user, session, and data (the normalized session object).

The cache-first optimization is currently present on the Extension remote dev branch, not on master:

1. Read the cached user from chrome.storage.local.
2. If a user exists, return { authenticated: true, user, session: null } without a GET /v1/session request.
3. If no user exists, call NinjaAuth getSession().
4. Save the user only when the server returns an authenticated session with a user.
5. A temporary lookup error is propagated; it does not delete the cached user.

**Important security distinction:** a cache hit restores the UI, not the server session. In the cache-only response, authenticated: true means that a user profile is cached; session: null means the live session has not been checked in that call. A protected operation must obtain a fresh getSession() result before relying on authentication. Do not use cached UI state as authorization.

## Logout semantics

### Current-session logout — POST /v1/logout

The route is session-specific, not global. It identifies the session using the ninja_session cookie on the current request, revokes that local session, attempts upstream refresh-token revocation, and clears the current cookie. Other active sessions belonging to the same user remain independent.

The SDK resolves logout() only when the HTTP response and success envelope confirm data.loggedOut === true.

**Open backend review item:** the previously reviewed handler did not check response.ok after the upstream provider revoke request. Local session revocation must remain authoritative, while the upstream result should be observed and represented accurately. Recheck the current Worker handler before closing this item.

### Global logout — POST /v1/logout/all (proposed)

This route is not implemented. Do not advertise it as an available Worker route or SDK capability.

### Local session versus upstream SSO

AuthGear SSO sessions and Ninja Connect auth_sessions are separate. Ending an AuthGear SSO session does not directly mutate Ninja Connect session rows. Revoking a Ninja Connect session does not prove that every upstream SSO session has ended.

## Backend concurrency verification

The Auth Worker has three focused PostgreSQL integration scenarios recorded on diagnostic/work branches:

- **RT-001:** stale concurrent invalid_grant does not revoke a session whose refresh token was already rotated. CI run 41073531083 was reported successful.
- **RT-002:** logout wins over refresh operations still in flight. CI run 41078846722 was reported successful.
- **RT-003:** a session revoked before the resolver's final database revalidation is not returned as authenticated. CI run 41196276386 was owner-reported successful and should be rechecked independently.

The tests use real PostgreSQL/Neon state and mocked upstream provider responses. They cover the orchestrated interleavings only; they are not live provider E2E tests or proof of all possible distributed executions.

## Verification boundary

As of 3 November 2026:

- SDK source and the 20-case Node.js test file are present on SDK master.
- No commit status checks were returned for the latest reviewed SDK commit.
- The generated SDK IIFE is stale after the source scope change.
- The Extension integration is present on Extension master; the cache-first restore path is present on Extension dev.
- Extension build and real Chrome/Worker cookie/CORS E2E have not been verified.

Do not infer release readiness from the presence of source code or tests alone.
