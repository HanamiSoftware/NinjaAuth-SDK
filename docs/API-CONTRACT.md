# Ninja Connect Auth API — SDK/Worker Contract (dev)

This document records the public SDK contract visible in the dev source. The Auth Worker currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Verify its branch and commit independently before treating cross-repository behavior as current.

## Public export and singleton contract

The package entry point exports the `NinjaAuth` class.

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development"
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

Contract:

- The public constructor is callable.
- Repeated construction in the same JavaScript runtime returns the same instance.
- `init(config)` is an instance method and returns that instance.
- Initialization is accepted once. A subsequent call throws `INITIALIZATION`.
- `login()`, `getSession()`, and `logout()` are instance methods.
- The singleton is not shared across separate JavaScript runtimes or extension contexts.
- The old static API `NinjaAuth.init(config)` is not the public contract.

The package entry point currently exports the types `NinjaAuthConfig` and `NinjaUser`. The method `getSession()` returns `NinjaSession`, but that type is not currently re-exported from `src/index.ts`; this is an API completeness item to decide and verify.

## SDK methods

| Method | Return | Behavior |
|---|---|---|
| `new NinjaAuth()` | `NinjaAuth` | Returns the runtime singleton instance |
| `init(config)` | `NinjaAuth` | Validates configuration and initializes the instance once |
| `login()` | `Promise<NinjaUser>` | Starts interactive Chrome Extension Authorization Code + PKCE |
| `getSession()` | `Promise<NinjaSession>` | Observes the current server session; does not start login |
| `logout()` | `Promise<void>` | Revokes the current cookie session and requires server confirmation |

## Worker routes

| Method | Path | Purpose | SDK status |
|---|---|---|---|
| POST | /v1/exchange | Exchange authorization code and create the Ninja Connect session | Implemented |
| GET | /v1/session | Resolve the current session; may refresh server-side | Implemented |
| GET | /v1/user/me | Return current authenticated user | Worker route; not a separate SDK method |
| POST | /v1/logout | Revoke the session identified by the current ninja_session cookie and clear that cookie | Implemented |
| POST (proposed, not implemented) | /v1/logout/all | Revoke all active sessions for the authenticated user | Not available; not an SDK method |

The experimental POST /v1/state route is not part of the SDK flow. NinjaAuth creates and validates the OAuth transaction client-side and sends its UUID state in the exchange request.

## Exchange request

The SDK sends JSON containing `state` (UUID), `code`, `client_id`, `code_verifier`, and `redirect_uri`. It uses PKCE S256, compares callback state with the original transaction before exchange, and validates the response envelope and `data.user`.

## Scope and endpoints

The source default scope is `openid profile email offline_access`. Per-consumer custom scope configuration is future work.

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

The dev test suite has been updated to the constructor-singleton contract and contains 33 cases. It is test code, not a passing test result: execution on the current dev commit remains pending. Live Chrome/Worker cookie/CORS E2E and the Extension cache/protected-operation checks remain separate verification tasks.
