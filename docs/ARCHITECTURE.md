# NinjaAuth SDK — Architecture (dev)

## Purpose

NinjaAuth is the client SDK for integrating applications with Ninja Connect, the central identity and session service. It is designed for first-party Ninja products and independent third-party applications. Its public API must remain independent from the upstream identity provider configured behind Ninja Connect.

## Responsibility boundaries

### Ninja Connect

Ninja Connect owns upstream authentication, shared Ninja identity resolution, central application sessions, server-side refresh/revocation, the HttpOnly session cookie, and provider-specific operations. It does not own each application's business authorization model.

### NinjaAuth SDK

The SDK owns client configuration, PKCE and OAuth state generation, platform authorization launch, callback validation, authorization-code exchange, normalized session observation, current-session logout, typed errors, and short-lived OAuth transaction cleanup.

The SDK must not contain database credentials, refresh-token encryption keys, or raw server session secrets.

### Consuming application

Each application owns its own profile, preferences, roles, permissions, capabilities, subscriptions, and business logic. Ninja Connect authenticates and identifies the user; it is not the central RBAC authority for consuming products.

### Upstream provider boundary

AuthGear is the current upstream identity provider behind Ninja Connect. It is not a public SDK dependency. NinjaAuth must speak the Ninja Connect API and must not call AuthGear endpoints directly or receive provider secrets. OIDC Discovery/interoperability remains future work.

## Actual dev export shape

The reviewed dev source exports `NinjaAuthClient` as `NinjaAuth`.

- Static `NinjaAuth.init(config)` creates or returns the singleton client instance.
- The returned instance owns `login()`, `getSession()`, and `logout()`.
- The ESM and IIFE outputs expose the class, not an already-created client instance.

This API shape must be kept distinct from the older singleton-object example. The current test file uses the lifecycle methods as if they were static, so the source, test setup, and public API example are not yet aligned.

## Authentication and session behavior

- Chrome Extension Authorization Code + PKCE is implemented in source.
- PKCE uses S256; OAuth state is a UUID and callback state is checked against the initiating transaction.
- Code exchange sends JSON with state, code, client_id, code_verifier, and redirect_uri.
- Default scope: `openid profile email offline_access`.
- `getSession()` observes the existing session and never starts interactive login.
- Only explicit 401 INVALID_SESSION becomes unauthenticated; operational failures remain errors.
- `logout()` revokes the current cookie session and requires explicit server confirmation.
- Web login is unsupported and rejects with UNSUPPORTED_PLATFORM.

## Identity and authorization are separate

- Ninja Connect user ID: stable shared identity identifier.
- Provider subject: upstream identifier used internally.
- Product user/profile: application-owned record associated with shared identity.
- Product roles, permissions, and capabilities: authorization decisions owned by the relevant product.

The optional NinjaAppAdapter remains a design direction only; it is not currently claimed as an exported SDK API.

## Session architecture

The browser holds an opaque HttpOnly session cookie. SDK JavaScript must not read or persist the raw session secret. Ninja Connect stores only a hash of the session secret and encrypts upstream refresh tokens at rest.

The session has normal and absolute expiry. Refresh must never extend the absolute lifetime or reactivate a revoked session.

POST /v1/logout revokes only the session represented by the current cookie. Global logout at /v1/logout/all is not implemented. AuthGear SSO logout is separate from Ninja Connect session revocation.

## Platform boundaries

- Chrome adapter: chrome.identity.launchWebAuthFlow and short-lived chrome.storage.session transaction storage.
- Web adapter: not implemented. A future implementation must design redirects/callbacks, multi-tab transaction handling, origin boundaries, cookie policy, CORS, and credentialed requests.
- Unsupported platform behavior must fail explicitly.

## Security boundaries

- Never expose access tokens, refresh tokens, encryption keys, database credentials, or raw session secrets unnecessarily.
- Do not use decoded-but-unverified JWT claims as an authorization source.
- Keep application-specific authorization in the consuming product.
- A cached user is presentation state, not an authorization credential.
