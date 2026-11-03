# NinjaAuth SDK — Architecture

## Purpose

NinjaAuth is the client SDK for integrating applications with Ninja Connect, the central identity and session service. It is designed for first-party Ninja products and independent third-party applications. Its public API remains independent from the upstream identity provider configured behind Ninja Connect.

## Responsibility boundaries

### Ninja Connect

Ninja Connect is the shared Identity Broker. It owns authentication through configured upstream providers, resolution of the shared Ninja identity, creation and validation of central application sessions, session refresh and revocation, the HttpOnly session cookie, and provider-specific operations.

Ninja Connect does not own each application's business authorization model.

### NinjaAuth SDK

The SDK owns configuration, PKCE and OAuth state generation, platform authorization launch, callback validation, authorization-code exchange through the stable Ninja Connect API, normalized session observation, current-session logout, typed errors, and short-lived OAuth transaction cleanup.

The SDK must not contain database credentials, refresh-token encryption keys, or raw server session secrets.

### Consuming application

Each application owns its own application data and authorization rules: profile, preferences, roles, permissions, capabilities, subscriptions, and business logic.

Ninja Connect authenticates and identifies the user. It does not become the central RBAC authority for NinjaURL, Ninja Game, NinjaReviews, or third-party applications.

### Upstream identity-provider boundary

AuthGear is the current upstream identity provider used by Ninja Connect. It is an implementation choice behind the broker, not a provider dependency that consuming applications or the public NinjaAuth API should know about.

NinjaAuth speaks the stable Ninja Connect API contract. It must not call AuthGear endpoints directly or receive provider secrets. OIDC Discovery/interoperability remains future work and must preserve this boundary.

## Current public SDK API

~~~ts
NinjaAuth.init({
  clientId,
  redirectUri,
  platform: "extension",
  environment: "development" | "production"
});

const user = await NinjaAuth.login();
const session = await NinjaAuth.getSession();
await NinjaAuth.logout();
~~~

- login() starts interactive Authorization Code + PKCE.
- getSession() observes the current server-side session and never starts interactive login.
- logout() revokes the session identified by the current HttpOnly cookie.
- Only an explicit 401 INVALID_SESSION is normalized to unauthenticated. Other errors remain distinguishable failures.
- Chrome Extension login is implemented. Web login is explicitly unsupported and rejects with UNSUPPORTED_PLATFORM.

The package metadata and runtime version constant currently remain 0.1.0. NinjaAuth v1.0.1-beta is the agreed internal milestone name, not yet a published package version. See the roadmap.

## Extension integration

The Chrome Extension uses the SDK from its Manifest V3 Background Service Worker.

- The Background imports the vendored IIFE bundle with importScripts.
- The Background initializes NinjaAuth with the registered Extension client ID, the Chrome Identity redirect URI, platform extension, and the development environment in the reviewed branch.
- The Background adapts SDK results to Chrome runtime messages.
- The Side Panel is a UI client; it sends RESTORE_SESSION, LOGIN, and LOGOUT messages and consumes normalized session data.
- NinjaAuth and Ninja Connect own authentication and the central session. The Extension owns UI state and product-specific data.

The integration is present on Extension master at commit 9606469a3f6412c5d47c9ee83c38b359499e1e8d. A cache-first restore optimization is present on Extension dev, two commits ahead of master on 3 November 2026.

### Cache-first restore semantics — Extension dev

The Background restoreSession() first reads the cached user from chrome.storage.local.

- If a cached user exists, it returns an authenticated UI snapshot with that user and session null, without calling NinjaAuth getSession() or GET /v1/session.
- If no cached user exists, it calls NinjaAuth getSession() and saves the user only for a valid authenticated response.
- A temporary lookup failure is propagated and does not erase the cached user.
- The Side Panel receives the result through RESTORE_SESSION.

A cache hit restores the interface quickly; it is not proof that the server session is still valid. The authenticated flag in this cache-only response is a UI restoration hint. A null session means that no live session was checked in that call. A protected operation must obtain a fresh NinjaAuth session result before relying on authentication. That next-operation guard remains a release item.

The cache stores the user profile, not the HttpOnly session secret. The server remains the authority for protected operations.

## Identity and authorization are separate

- Ninja Connect user ID: stable shared identity identifier exposed to applications.
- Identity provider subject: upstream identifier used internally to map provider identity.
- Product user/profile: application-owned record associated with shared identity.
- Product roles, permissions, and capabilities: authorization decisions owned by the relevant product.

The optional NinjaAppAdapter remains a design direction only; it is not currently claimed as an exported SDK API.

## Session architecture

The browser holds an opaque HttpOnly session cookie. SDK JavaScript must not read or persist the raw session secret.

Ninja Connect generates a cryptographically random session secret, stores only its hash in the database, stores the upstream refresh token encrypted at rest, resolves the cookie to an active database session, refreshes upstream credentials server-side when required, and revokes the local session during logout.

The session has both a normal expiry and an absolute expiry. A refresh must never extend the absolute lifetime or reactivate a revoked session.

POST /v1/logout currently revokes only the session represented by the current cookie. A global operation at /v1/logout/all has been proposed but is not implemented. AuthGear SSO logout is separate and does not directly revoke Ninja Connect auth_sessions rows.

## Concurrency and session invariants

The Auth Worker has focused tests for three refresh/logout scenarios: stale concurrent refresh, logout while refresh operations are in flight, and logout committed before the resolver's final session revalidation.

These tests use real PostgreSQL state and mocked upstream provider responses. They cover the specific orchestrated interleavings only; they are not live provider E2E tests or proof of every possible race.

## Platform boundaries

- Chrome adapter: uses chrome.identity.launchWebAuthFlow and short-lived transaction storage via chrome.storage.session.
- Web adapter: not implemented. A future implementation must design redirect/callback behavior, multi-tab transaction handling, origin boundaries, cookie policy, CORS, and credentialed requests.
- Unsupported platform behavior must fail explicitly; no login Promise may remain pending indefinitely.

## Security boundaries

- Never expose access tokens, refresh tokens, encryption keys, database credentials, or raw session secrets unnecessarily to application code.
- Do not use decoded-but-unverified JWT claims as an authorization source.
- Keep application-specific authorization in the consuming product.
- A cached user is presentation state, not an authorization credential.
