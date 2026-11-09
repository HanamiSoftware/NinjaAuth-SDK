# NinjaAuth SDK — Architecture

## Purpose

NinjaAuth is the client SDK for integrating applications with Ninja Connect, the shared identity broker. The public SDK is provider-neutral; AuthGear is an upstream implementation detail behind Ninja Connect.

## Responsibility boundaries

### Ninja Connect

Ninja Connect owns:
- OAuth client registration and exact callback validation;
- short-lived server-side PKCE transaction storage;
- atomic transaction consumption;
- server-to-server authorization-code exchange with the upstream identity provider;
- normalized identity/token handoff to an authenticated consuming backend.

Ninja Connect does not own each product's business authorization model or the product's application cookie.

### NinjaAuth SDK

The SDK owns:
- client configuration;
- PKCE S256 and state generation;
- platform-specific authorization launch;
- state/outcome validation;
- session observation and logout through the correct platform endpoint;
- typed errors and lifecycle semantics.

For Web login, the SDK never receives the authorization code. It registers the verifier with Ninja Connect, opens the authorization popup, receives only a same-origin result signal from the application bridge, and then observes the application session through the application API.

The SDK must not contain database credentials, refresh-token encryption keys, inter-service secrets, or raw session secrets.

### Consuming application

Each application owns:
- its own backend callback;
- its own user/profile mapping and product roles;
- its own application session records and cookie;
- its own capabilities, subscriptions, preferences, and business logic.

For NinjaURL, the backend callback is `https://api.ninjaurl.io/v1/auth/callback`. It calls Ninja Connect server-to-server, creates the NinjaURL session, and sets a host-only HttpOnly cookie on `api.ninjaurl.io`. The Dashboard uses that cookie for its API requests.

## Authentication flow

### Web

1. The SDK opens a popup synchronously from a user gesture.
2. It generates PKCE S256 and UUID state.
3. It posts state, client ID, verifier, and exact backend callback to Ninja Connect's `/v1/state`.
4. Ninja Connect validates the client/callback against its internal client registry and stores the transaction in a dedicated Durable Object for five minutes.
5. AuthGear redirects the code and state directly to the registered application backend callback.
6. The application backend calls Ninja Connect's protected internal exchange endpoint with only code and state.
7. Ninja Connect atomically consumes the transaction and exchanges the code using the stored verifier.
8. The application backend resolves identity, creates its own session, and sets its own HttpOnly cookie.
9. The backend redirects to a same-origin bridge page. The bridge posts only state and outcome; it never forwards code, tokens, verifier, or cookie.
10. The SDK validates state and reads the application session through the API origin derived from the registered callback.

### Chrome Extension

The Chrome Extension flow retains its existing platform-specific launcher, transaction storage, and Ninja Connect session endpoints in this iteration. The Web callback changes do not replace or repurpose Extension behavior.

## Identity and authorization are separate

- Shared identity is established by Ninja Connect.
- The consuming product maps that identity to its own user/profile record.
- Product roles, permissions, and capabilities remain product-owned.
- A shared identity does not imply a shared application session or shared authorization context.

## Session architecture

The Web application's cookie is issued only by the application backend on its own host. NinjaURL's cookie is host-only on `api.ninjaurl.io`; it is HttpOnly, Secure, SameSite=Strict, Path=/, and has no Domain attribute. The Dashboard never reads the cookie; it sends credentialed requests to the API.

NinjaURL stores a hash of its session secret and encrypts the upstream refresh token at rest. The session has normal and absolute expiry. Refresh must never extend the absolute lifetime or reactivate a revoked session.

## Transaction storage

The Web PKCE verifier is not stored in localStorage/sessionStorage and is never sent through popup messaging. Ninja Connect stores it in a dedicated `OAuthTransactionStore` Durable Object with a five-minute lifetime. The consume operation uses a SQLite transaction to ensure that a state can be consumed only once. This is OAuth transaction state, not an SSO handoff ticket; the existing SSO ticket flow remains separate and untouched.

## Security boundaries

- Exact callback URI registration; no wildcard/prefix matching.
- The calling application origin is checked against an allowlist.
- Inter-service token exchange requires a shared server-side secret.
- The authorization code is delivered to the backend callback, not the parent JavaScript context.
- No code, verifier, access token, refresh token, or session secret is posted to the opener.
- The internal exchange response is no-store and only available to the trusted backend.
- Application cookies are host-only and issued by the application API host.
- Never use decoded-but-unverified JWT claims as an authorization source.
- Cached user state is presentation state, not an authorization credential.

## Operational dependencies

- The internal OAuth client registry migration must be applied before `/v1/state` can validate client IDs and callbacks.
- The Auth Worker requires the `OAUTH_TRANSACTIONS` Durable Object binding and `oauth-state-v1` migration.
- The same high-entropy `NINJAURL_EXCHANGE_SECRET` must be configured on the Auth Worker and NinjaURL API Worker.
- The exact callback must be registered with the upstream OAuth provider.
- Real-browser verification is required for popup opener preservation, credentialed CORS, cookie acceptance, session refresh, and logout.
