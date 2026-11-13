# Ninja Connect Auth API — SDK/Worker Contract

This document describes the server-side Web PKCE flow and the existing Chrome Extension flow. The new broker runtime lives in [Ninja Connect — Workers/auth-broker](https://github.com/HanamiSoftware/Ninja-Connect/Workers/auth-broker). The legacy NinjaURL Auth Worker continues to serve the existing Extension endpoints during this transition.

## Public SDK contract

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();
auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "web",//optional web by default
  environment: "production"//optional production by default
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

1. The SDK selects the navigation container: desktop browsers open a blank popup synchronously from the user's click handler; mobile browsers use the current tab.
2. It generates PKCE S256 and a UUID `state`.
3. The browser sends `POST https://auth.ninjaconnect.io/v1/state` with JSON:
   - `state`
   - `client_id`
   - `code_verifier`
   - `redirect_uri`
4. Ninja Connect validates the client and exact callback against `oauth_clients_internal`, validates the calling `Origin`, and stores the short-lived transaction in the `OAUTH_TRANSACTIONS` Durable Object namespace.
5. The popup or current tab navigates to the authorization URL returned by Ninja Connect. The URL targets the broker authorization endpoint and uses the central callback URI `https://auth.ninjaconnect.io/v1/callback`; the consuming application's backend callback remains the separately registered `redirect_uri` stored with the transaction.
6. AuthGear returns the authorization code and state to the central Ninja Connect callback, not to the application or opener page.
7. The central callback Worker forwards the provider result to Ninja Connect's protected completion endpoint `POST /v1/callback/complete`. Ninja Connect consumes the PKCE transaction, retrieves the verifier, exchanges the AuthGear code server-to-server, and creates a random, one-time Ninja Connect application code bound to the exact registered application callback.
8. The callback Worker redirects the browser to that application backend callback with the Ninja Connect application code and state.
9. The NinjaURL backend redeems the application code through `POST /v1/exchange/internal/redeem` with `{ state, code, redirect_uri }` and `Authorization: Bearer <NINJAURL_EXCHANGE_SECRET>`. Ninja Connect returns tokens only to the trusted backend. NinjaURL resolves the user profile, creates its own application session, stores the session hash and encrypted refresh token, and sets its own HttpOnly cookie on `api.ninjaurl.io`.
10. The backend redirects the browser to the Dashboard's same-origin `/auth-callback.html` bridge. In popup mode, the bridge posts only `state` and the success/error outcome to the opener. In same-tab mobile mode there is no opener: the bridge removes callback parameters and redirects to the Dashboard origin. It never posts codes, verifier, tokens, or the session cookie.
11. In popup mode, the SDK validates the bridge state and calls the application API's `/v1/session` endpoint. In mobile mode, the original document unloads and its `login()` promise does not resolve; after the app reloads, it initializes NinjaAuth and calls `getSession()`. The API origin is derived from the registered backend callback URI.

The `redirectUri` must be the exact application backend callback registered for the client. The SDK validates the broker authorization URL against the central callback URI `https://auth.ninjaconnect.io/v1/callback`; the Ninja Connect broker constant and callback Worker route must use the same exact URI. The parent application's origin must be allowlisted by Ninja Connect and by the consuming API's credentialed CORS policy.

**Cross-repository integration check:** the currently reviewed Ninja Connect broker source contains an `AUTHGEAR_CALLBACK_URI` value of `https://auth.ninjaconnect.io/call`, while this SDK and the NinjaURL callback Worker currently expect `/v1/callback`. This SDK-only PR does not change either server repository. Reconcile that route before live end-to-end testing.

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

The endpoint does not accept an authorization code. The endpoint returns the resolved clientId. The verifier is stored server-side for at most five minutes. A transaction is consumed atomically once; a replay or expired transaction is rejected.

## Internal application-code redemption contract

```http
POST /v1/exchange/internal/redeem
Authorization: Bearer <NINJAURL_EXCHANGE_SECRET>
Content-Type: application/json
```

```json
{
  "state": "UUID",
  "code": "one-time-ninja-connect-application-code",
  "redirect_uri": "https://api.ninjaurl.io/v1/auth/callback"
}
```

This endpoint is backend-only. It rejects calls without the configured shared secret and atomically consumes the one-time application code, which is bound to the exact registered callback and expires after 60 seconds. It returns upstream tokens only to the trusted application backend and uses `Cache-Control: no-store`. AuthGear authorization codes and PKCE verifiers remain inside Ninja Connect.

For a provider cancellation/error before an application code is issued, the callback flow returns the sanitized result to the validated application origin. The protected `POST /v1/exchange/internal/cancel` endpoint consumes an outstanding transaction when backend cancellation is required.

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
- No AuthGear authorization code, PKCE verifier, access token, refresh token, or session secret may be forwarded through popup `postMessage`.
- The central PKCE transaction and application code are single-use. If the upstream exchange fails after transaction consumption, the user must restart login.

## Remaining verification

Mocks and typechecks do not prove browser behavior. Required live checks include popup opener preservation, iOS/Android same-tab navigation and session restoration, CORS preflight and exact-origin credentialed requests, cookie acceptance on the API host, callback bridge messaging, session refresh, and logout.
