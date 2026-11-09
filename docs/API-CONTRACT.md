# Ninja Connect Auth API — SDK/Worker Contract

This document describes the server-side Web PKCE flow and the existing Chrome Extension flow. The new broker runtime lives in [Ninja Connect — Workers/auth-broker](https://github.com/HanamiSoftware/Ninja-Connect/tree/main/Workers/auth-broker). The legacy NinjaURL Auth Worker continues to serve the existing Extension endpoints during this transition.

## Public SDK contract

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();
auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "web",
  environment: "production"
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

- `NinjaAuth` is a runtime-local singleton with a public constructor.
- `init()` is an instance method and can be called once.
- `login()` returns `Promise<NinjaUser>`.
- `getSession()` observes the current session; it never starts interactive login.
- `logout()` resolves only after the server confirms `data.loggedOut === true`.
- The singleton is not shared across separate tabs, workers, or extension contexts.

## Web Authorization Code + PKCE flow

The Web flow separates the identity broker from the application's session:

1. The SDK opens a blank popup synchronously from the user's click handler.
2. It generates PKCE S256 and a UUID `state`.
3. The browser sends `POST https://auth.ninjaconnect.io/v1/state` with JSON:
   - `state`
   - `client_id`
   - `code_verifier`
   - `redirect_uri`
4. Ninja Connect validates the client and exact callback against `oauth_clients_internal`, validates the calling `Origin`, and stores the short-lived transaction in the `OAUTH_TRANSACTIONS` Durable Object namespace.
5. The popup opens the AuthGear authorization URL. The registered redirect URI is the consuming application's backend callback, for NinjaURL:
   `https://api.ninjaurl.io/v1/auth/callback`.
6. AuthGear redirects the authorization code and state directly to that backend callback. The code is not delivered to the parent page.
7. The NinjaURL backend calls Ninja Connect's protected server-to-server endpoint:
   `POST https://auth.ninjaconnect.io/v1/exchange/internal`
   with `{ state, code }` and `Authorization: Bearer <NINJAURL_EXCHANGE_SECRET>`.
8. Ninja Connect atomically consumes the transaction, retrieves the verifier, and exchanges the authorization code with AuthGear. It returns tokens and the stored, validated return origin only to the authenticated backend caller.
9. NinjaURL resolves the user profile, creates its own application session, stores the session hash and encrypted refresh token, and sets its own HttpOnly cookie on `api.ninjaurl.io`.
10. The backend redirects the popup to the Dashboard's same-origin `/auth-callback.html` bridge. The bridge posts only `state` and the success/error outcome to the opener. It never posts the authorization code, verifier, access token, refresh token, or session cookie.
11. The SDK verifies state and calls the application API's `/v1/session` endpoint. The API origin is derived from the registered backend callback URI.

The `redirectUri` must be the exact callback registered for the client. The parent application's origin must be allowlisted by Ninja Connect and by the consuming API's credentialed CORS policy.

## Web transaction request

```http
POST /v1/state
Content-Type: application/json
Origin: https://dashboard.ninjaurl.io
```

```json
{
  "state": "UUID",
  "client_id": "registered-client-id",
  "code_verifier": "PKCE-verifier",
  "redirect_uri": "https://api.ninjaurl.io/v1/auth/callback"
}
```

The endpoint does not accept an authorization code. If client_id is omitted, the exact callback URI must resolve to exactly one active registered client. The endpoint returns the resolved clientId. The verifier is stored server-side for at most five minutes. A transaction is consumed atomically once; a replay or expired transaction is rejected.

## Internal exchange contract

```http
POST /v1/exchange/internal
Authorization: Bearer <NINJAURL_EXCHANGE_SECRET>
Content-Type: application/json
```

```json
{
  "state": "UUID",
  "code": "authorization-code"
}
```

This endpoint is backend-only. It rejects calls without the configured shared secret. It consumes the transaction before calling AuthGear, so failed or interrupted exchanges require a new login attempt. It returns upstream tokens only to the trusted backend and uses `Cache-Control: no-store`.

For an OAuth provider error, the application backend calls the protected `POST /v1/exchange/internal/cancel` endpoint with `{ state }`; Ninja Connect consumes the pending transaction and returns the previously validated return origin.

## Chrome Extension flow

The Chrome Extension flow remains on its existing launcher and exchange contract in this iteration. It continues to use its platform-specific transaction storage and Ninja Connect session endpoints. The new backend callback/session flow is selected only when `platform: "web"`.

## Session endpoints by platform

| Platform | `getSession()` | `logout()` |
|---|---|---|
| Chrome Extension | Ninja Connect `/v1/session` | Ninja Connect `/v1/logout` |
| Web | Application API origin derived from `redirectUri`, `/v1/session` | Application API origin derived from `redirectUri`, `/v1/logout` |

For NinjaURL, those Web endpoints are hosted on `api.ninjaurl.io`. The Dashboard's existing `/v1/user/me` endpoint continues to use the same host-only application cookie.

## Cookie and security requirements

- NinjaURL sets `ninja_session` only from a response served by `api.ninjaurl.io`.
- The cookie is host-only: no `Domain` attribute.
- Cookie attributes: `HttpOnly; Secure; SameSite=Strict; Path=/`.
- The Dashboard uses credentialed requests to `api.ninjaurl.io`; the browser must accept the cookie for same-site, cross-origin requests.
- The shared `NINJAURL_EXCHANGE_SECRET` must be configured as a Worker secret on both the Auth Worker and the NinjaURL API Worker. Use the same high-entropy value; never put it in browser code.
- The Auth Worker must have the `OAUTH_TRANSACTIONS` Durable Object binding and the `oauth-state-v1` migration deployed.
- The `oauth_clients_internal` table migration must be applied before the state endpoint can validate clients.
- The registered callback URI must exactly match the backend callback URL; no wildcard or prefix matching.
- No authorization code, PKCE verifier, access token, refresh token, or session secret may be forwarded through popup `postMessage`.
- A transaction is single-use. If the upstream exchange fails after consumption, the user must restart login.

## Remaining verification

Mocks and typechecks do not prove browser behavior. Required live checks include popup opener preservation across the AuthGear round-trip, CORS preflight and exact-origin credentialed requests, cookie acceptance on the API host, callback bridge messaging, session refresh, and logout.
