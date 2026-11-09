# Application-Owned Session Contract

**Status:** Proposed architecture contract  
**Scope:** Ninja Connect, NinjaAuth SDK, and every consuming application (including NinjaURL)  
**Decision principle:** Ninja Connect authenticates and verifies identity; each application creates, owns, and revokes its own application session.

## 1. Responsibility boundaries

### Ninja Connect

Ninja Connect is the central Identity Broker. It owns:

- Upstream authentication and provider integration.
- Verification of OAuth Authorization Code + PKCE exchanges.
- Resolution of the stable shared Ninja identity.
- Application/client registration and redirect URI validation.
- A trusted server-to-server response that tells an application's backend which identity was authenticated and for which registered client.

Ninja Connect must not set or share an application's session cookie. Its own website may maintain a separate Ninja Connect session for Ninja Connect features.

### Consuming application

Every application backend owns:

- Its application-specific user/profile record and authorization rules.
- Creation, persistence, rotation/refresh policy, expiry, and revocation of its own sessions.
- Its own opaque session cookie (or platform-appropriate credential where cookies are not available).
- Its own session, current-user, and logout endpoints.

An application must not treat a Ninja Connect browser cookie as its application session.

### NinjaAuth SDK

The SDK orchestrates the browser/extension authorization flow and calls the consuming application's authentication endpoints. It must not own application session secrets, read HttpOnly cookies, or call provider-specific endpoints directly.

## 2. Web login sequence (proposed)

1. The application initializes NinjaAuth with its registered `clientId`, same-origin OAuth `redirectUri`, and its own `apiBaseUrl`.
2. The user calls `login()` from a user gesture. The SDK opens the popup synchronously, generates PKCE S256 and a unique state, and keeps the verifier in the parent runtime's short-lived transaction store.
3. The popup completes the authorization at Ninja Connect and returns only `code`, `state`, and provider error fields to the opener. The verifier and any session credential never cross the popup message boundary.
4. The SDK validates the popup source, exact callback origin, state, and provider response.
5. The SDK sends the authorization code, verifier, state, client ID, and redirect URI to the **consuming application's backend** using a credentialed request.
6. The application backend validates its registered client/redirect configuration and makes an authenticated **server-to-server** request to Ninja Connect. The browser must never receive an application server secret.
7. Ninja Connect redeems/verifies the code and PKCE proof, resolves the shared identity, and returns a trusted, client/audience-bound identity result to the calling application backend. This response does not set a browser cookie.
8. The application backend maps the shared identity to its own application user, applies its own access policy, creates a fresh application session, stores only a hash of the session secret, and sets its own HttpOnly cookie on its API host.
9. The application backend returns the application user/session envelope. Only after this succeeds does `login(): Promise<NinjaUser>` resolve.

If any step fails, login rejects. A provider-authenticated identity without a successfully created application session is not a successful application login.

## 3. Application API contract (proposed)

The exact route names can be aligned with each backend, but the SDK-facing semantics should be consistent:

| Operation | Application endpoint | Expected behavior |
|---|---|---|
| Complete login | `POST {apiBaseUrl}/auth/exchange` | Redeem the one-time authorization result through Ninja Connect, create the app session, set the app cookie, return the app user |
| Restore/check session | `GET {apiBaseUrl}/auth/session` | Resolve only this application's session |
| Logout | `POST {apiBaseUrl}/auth/logout` | Revoke only this application's current session and clear its cookie |

The exchange request contains `code`, `state`, `client_id`, `code_verifier`, and `redirect_uri`. The application backend must validate the request and registered values; it must not trust a user/profile supplied by the browser.

The response from the application exchange endpoint should include a normalized user object compatible with the SDK's public type. It must not include raw session secrets, upstream access/refresh tokens, or provider tokens.

## 4. Cookie and browser requirements

- Each application uses a distinct, opaque, host-only session cookie on its own API host.
- Prefer a `__Host-` prefixed cookie where deployment constraints allow it: `Secure`, `HttpOnly`, `Path=/`, and no `Domain` attribute.
- Choose `SameSite` based on the actual navigation and deployment topology; do not weaken it to `None` without a demonstrated requirement.
- Cross-origin frontend-to-API requests use `credentials: "include"`.
- Credentialed CORS returns the exact allowlisted frontend origin and `Access-Control-Allow-Credentials: true`; wildcard origins are forbidden.
- JavaScript never reads, copies, or persists the HttpOnly cookie.
- Cookie/session creation and subsequent session lookup must be verified in a real HTTPS browser. Unit mocks alone are not evidence of cookie persistence.

## 5. Callback-page ergonomics

The popup still needs a callback document that can execute code at the registered redirect URI. The SDK should remove the consumer's need to call a manually named callback function by offering a dedicated auto-running callback entry point (for example, `@ninjaconnect/auth/web-callback`). Importing that entry point from the minimal callback document performs the safe postMessage handoff and closes the popup.

This removes the explicit `completeWebAuthCallback()` invocation, but it does not eliminate the callback route/document itself. A fully hosted central callback is a separate design and requires registered redirect URI, opener-origin binding, and open-redirect protections.

## 6. Public SDK behavior

The intended consumer experience is:

```ts
const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: new URL("/auth/callback", window.location.origin).toString(),
  apiBaseUrl: "https://api.your-app.example",
  platform: "web"
});

const user = await auth.login();
// The application's own backend has confirmed and created its session.
```

- `login()` resolves with the application user only after the application backend confirms session creation.
- `getSession()` queries the application's session endpoint, not a shared browser session at Ninja Connect.
- `logout()` revokes the application's session. It does not implicitly log the user out of every other application.
- Ninja Connect identity and an application's user/profile remain distinct concepts. Applications may map one shared identity to their own local user record.

## 7. Current implementation gap

The current SDK branch still points its `exchange`, `session`, and `logout` calls at `https://auth.ninjaconnect.io/v1`. Its exchange response is treated as the login result, and the corresponding Auth Worker sets a `ninja_session` cookie on the Ninja Connect origin. That is a central Ninja Connect session, not yet the independent application-owned session described here.

Therefore, changing only the SDK's callback helper or return type would not implement this architecture. The application API contract and the Ninja Connect server-to-server identity-verification contract must be implemented together before switching the SDK endpoints.

## 8. Safe migration sequence

1. Agree and implement the server-to-server identity exchange contract in Ninja Connect without returning an application cookie from that service.
2. Implement the application-owned `/auth/exchange`, `/auth/session`, and `/auth/logout` routes in NinjaURL's backend. Keep the existing central session path intact until the new flow is verified.
3. Add `apiBaseUrl` and application endpoint handling to NinjaAuth behind tests; preserve the existing Chrome Extension path until its credential/session transport is explicitly designed.
4. Add the auto-running Web callback entry point so consumers no longer invoke `completeWebAuthCallback()` manually.
5. Verify Web login, cookie host/attributes, subsequent session lookup, logout, and login-again in a real HTTPS browser.
6. Migrate other applications independently. Do not share cookie values or session records between applications.

No existing endpoint or cookie should be removed until the replacement has passed integration tests and a real-browser verification.
