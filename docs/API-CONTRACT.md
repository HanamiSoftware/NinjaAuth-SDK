# Ninja Connect Auth API — SDK/Worker Contract (dev)

This document records the contract visible in SDK dev source and the current generated artifacts. The Auth Worker currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Verify its branch and commit independently before treating cross-repository behavior as current.

## Public export shape on dev

The current dev source exports the class `NinjaAuthClient` as `NinjaAuth`.

- `NinjaAuth.init(config)` is static and returns the singleton instance.
- `login()`, `getSession()`, and `logout()` are instance methods.
- The ESM build exports the class, and the IIFE exposes the class on `window.NinjaAuth`.

Correct usage for the current source shape:

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = NinjaAuth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development"
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

Do not call `NinjaAuth.login()`, `NinjaAuth.getSession()`, or `NinjaAuth.logout()` directly on the exported class. Those methods are not static in the reviewed source.

**Test mismatch:** the current test file invokes these instance methods on the class after calling init() without retaining the returned instance. This must be corrected and the suite executed before validation can be claimed.

## Worker routes

| Method | Path | Purpose | SDK status |
|---|---|---|---|
| POST | /v1/exchange | Exchange authorization code and create the Ninja Connect session | Implemented in source; JSON request and data.user validation |
| GET | /v1/session | Resolve current session; may refresh server-side | Implemented in source; normalized NinjaSession validation |
| GET | /v1/user/me | Return current authenticated user | Worker route; not a separate SDK method |
| POST | /v1/logout | Revoke the session identified by the current ninja_session cookie and clear that cookie | Implemented in source; requires explicit logout confirmation |
| POST (proposed, not implemented) | /v1/logout/all | Revoke all active sessions for the authenticated user | Not available; not an SDK method |

The experimental POST /v1/state route is not part of the SDK flow. NinjaAuth creates and validates the OAuth transaction client-side and sends its UUID state in the exchange request.

## Exchange request

The SDK sends JSON containing `state` (UUID), `code`, `client_id`, `code_verifier`, and `redirect_uri`. It uses PKCE S256, compares callback state with the original transaction before exchange, and validates the response envelope and `data.user`.

## Scope and endpoints

The source default scope is `openid profile email offline_access`. The dev generated IIFE also contains this full scope. Per-consumer custom scope configuration is future work.

| Environment | API base |
|---|---|
| development | http://127.0.0.1:8787/v1 |
| production | https://auth.ninjaconnect.io/v1 |

The default environment is production; the authorization origin remains https://auth.ninjaconnect.io.

## Session semantics

`getSession()` observes the current Ninja Connect session and never starts interactive login.

- A successful 200 response with `data.authenticated === false` is a normal unauthenticated result.
- A 401 response is mapped to unauthenticated only when `error.code === "INVALID_SESSION"`.
- Other authorization errors, malformed responses, network failures, server errors, and temporary refresh failures remain errors.

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

## Cookie and security requirements

- Session and logout requests use `credentials: "include"`.
- The session cookie is HttpOnly; SDK JavaScript must not read it.
- Validate CORS and cookie attributes against actual Extension and production origins.
- Do not store the raw session secret or upstream refresh token in SDK storage.
- Refresh must not extend absolute session expiry or reactivate a revoked session.

## Logout

`POST /v1/logout` is current-session-only. The SDK resolves `logout()` only after the HTTP response and success envelope confirm `data.loggedOut === true`.

Global logout at `POST /v1/logout/all` is proposed but not implemented. AuthGear SSO sessions and Ninja Connect sessions are separate lifecycles.

## Verification boundary

The dev branch contains 20 top-level node:test cases, but the current test calls do not match the class/instance export shape described above. No test pass is asserted. Generated artifacts exist and the dev IIFE contains the full default scope; that does not establish that the API behavior is correct. Live Chrome/Worker cookie/CORS E2E remains unverified.
