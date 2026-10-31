# NinjaAuth SDK — Architecture

## Purpose

NinjaAuth is the client-side SDK for integrating applications with **Ninja Connect**, the central identity and session service.

The SDK must be usable both by products in the Ninja ecosystem and by independent third-party applications. Its public API must remain independent of the upstream identity provider currently configured behind Ninja Connect.

## Responsibility boundaries

### Ninja Connect

Ninja Connect is the shared **Identity Broker**. Its responsibilities are authentication through configured identity providers, resolution of the shared Ninja Connect identity, and creation, validation, refresh, and revocation of the central application session.

Ninja Connect keeps session secrets and upstream refresh tokens server-side and sets/clears the ninja_session cookie.

Ninja Connect does **not** own the business authorization model of every application that uses it.

### NinjaAuth SDK

The SDK generates PKCE material and OAuth state, launches platform-specific authorization UI, validates callbacks, exchanges authorization results through Ninja Connect, and exposes a stable API such as init(), login(), getSession(), and logout().

The SDK must not contain database credentials, refresh-token encryption keys, or raw server session secrets.

### Upstream identity-provider boundary and OIDC interoperability

AuthGear is the current upstream identity provider used by Ninja Connect. It is an implementation choice behind the broker, not a provider dependency that consuming applications or the public NinjaAuth API should know about.

- Ninja Connect owns upstream authorization-code exchange, provider credentials, refresh tokens, provider-specific user resolution, key retrieval, and revocation.
- NinjaAuth speaks the stable Ninja Connect `/v1/*` contract. It must not call AuthGear `/oauth2/*` endpoints directly or receive provider secrets.
- Future OIDC Discovery/interoperability work must allow Ninja Connect to assess and integrate another conformant provider without changing the public NinjaAuth API or consuming applications.
- Discovery metadata must be validated against a configured trusted issuer; production endpoints require HTTPS and explicit endpoint/algorithm allow-lists. Optional capabilities such as UserInfo, revocation, and provider logout must not be assumed universally available.
- The exact division of discovery metadata consumed by a browser SDK versus retained server-side must be decided against the final authorization contract. Provider credentials and broker operations remain server-side regardless.

This is an architectural constraint for current design, not a requirement to implement OIDC Discovery in the immediate extension integration milestone.

### Consuming application

Each application owns its own application data and authorization rules: application profile and preferences, roles and permissions local to that product, product-specific capabilities and business rules, and application data persistence.

For example, NinjaURL must not need to know that NinjaReviews exists. Ninja Connect provides shared identity; each product independently decides what that identity may do inside that product.

### Optional Ninja ecosystem adapter

The planned **NinjaAppAdapter<TProfile>** is an optional integration boundary for first-party Ninja products. It allows a product to enrich shared identity with its own typed application profile without adding product-specific fields to the central NinjaUser.

This adapter is distinct from OAuth/platform adapters such as a Chrome authorization launcher or a Web transaction store.

- Standalone third-party use: the application can use NinjaAuth without a NinjaAppAdapter.
- First-party product use: a product may supply its own adapter/profile integration.
- Product authorization remains in the product backend; the adapter does not centralize RBAC in Ninja Connect.

**Status:** architectural direction, not a claim that NinjaAppAdapter<TProfile> is currently exported or implemented in the SDK public API.

## Identity and authorization are separate

Keep these concepts distinct:

- **Ninja Connect user ID:** stable shared identity identifier exposed to applications.
- **Identity provider subject (sub):** upstream identifier used internally to map provider identity.
- **Product user/profile:** application-owned record associated with shared identity.
- **Product roles/permissions/capabilities:** authorization decisions owned by the relevant product.

Ninja Connect authenticates and identifies the user. It must not become the central RBAC authority for NinjaURL, Ninja Game, NinjaReviews, or independent third-party applications.

## Current SDK components

The inspected repository source includes:

- src/NinjaAuth.ts: public singleton client and lifecycle methods.
- src/config.ts: endpoint/scope constants, not yet consistently used by the client.
- src/oauth/authorization.ts: authorization URL construction and callback parsing.
- src/oauth/state.ts: OAuth state generation.
- src/utils/pkce.ts: PKCE verifier and S256 challenge generation.
- src/platform/chrome/AuthorizationLauncher.ts: Chrome Identity API launcher.
- src/platform/chrome/TransactionStorage.ts: temporary transaction storage using chrome.storage.session.
- src/types/types.ts: SDK configuration, user/session, and transaction types.

The inspected source still contains a localhost API base URL, an incomplete Web branch, and a TODO in logout(). The current source snapshot and its limitations are recorded in the [roadmap](ROADMAP.md).

## Intended extension authentication flow

1. Application calls NinjaAuth.init(config).
2. SDK generates a high-entropy PKCE verifier/challenge and unpredictable state in the format required by the Worker.
3. SDK stores the short-lived client-side transaction.
4. The extension sidepanel sends an authentication command to the background service worker; the background owns NinjaAuth initialization and the authentication lifecycle.
5. SDK opens the authorization URL through `chrome.identity.launchWebAuthFlow` from the extension background context.
6. SDK parses the callback and verifies returned state against the initiated transaction.
7. SDK sends authorization code, verifier, state, client ID, and redirect URI using the agreed exchange schema.
8. Worker validates the exchange, contacts the identity provider, resolves the Ninja Connect identity, creates the server-side session, and sets the session cookie.
9. SDK returns the normalized Ninja Connect user profile to the background, which updates the extension's authenticated state and informs the sidepanel.

The exact exchange contract must be aligned before this flow is considered complete. The experimental /v1/state endpoint is not a required step in the intended SDK flow; do not reintroduce it as an SDK dependency without an explicit architecture decision.

## Session architecture

The browser holds an opaque HttpOnly session cookie. SDK JavaScript must not read or persist the raw session secret.

At a high level, the Worker generates a cryptographically random session secret, stores only its hash in the database, stores the upstream refresh token encrypted at rest, resolves the cookie to an active database session, refreshes upstream credentials server-side when required, and revokes the local session during logout while attempting upstream token revocation.

The session has both a normal expiry and an absolute expiry. A refresh must never extend the absolute lifetime or reactivate a revoked session.

### Logout boundaries

`POST /v1/logout` currently revokes only the session represented by the current cookie. A global operation (`/v1/logout/all`) has been proposed but is not implemented. AuthGear SSO logout is separate: it terminates the provider's SSO context but does not directly revoke rows in Ninja Connect `auth_sessions`. The same distinction applies to provider `/settings` versus any future Ninja Connect account/settings UI.

## Concurrency and session invariants

The Worker has been tested for three focused refresh/logout race scenarios:

- A stale concurrent refresh receiving invalid_grant must not revoke a session whose refresh token was already rotated by another request.
- A logout that completes while refresh operations are in flight must prevail; a later refresh result must not reactivate the revoked database session.
- If logout commits before the resolver's final session revalidation, the resolver must reject the request rather than return an authenticated context.

The implementation uses conditional database updates as optimistic concurrency guards. This is not a distributed mutex and does not prove that every possible interleaving is covered. See [API contract — backend concurrency verification](API-CONTRACT.md#backend-concurrency-verification).

## Platform boundaries: Extension and Web

The Chrome extension implementation belongs behind platform adapters. The shared Core should depend on abstractions for authorization launch and short-lived OAuth transaction storage, not on `chrome.*` APIs.

- Chrome adapter: uses `chrome.identity.launchWebAuthFlow` and extension-appropriate temporary storage (currently `chrome.storage.session`).
- Web adapter: must use standard browser redirect/callback behavior and an explicitly designed transaction store; it must account for multi-tab behavior, origin boundaries, cookie policy, CORS, and credentialed requests.
- The platform-neutral contract and lifecycle must be defined before implementing either adapter further. Unsupported platforms must fail explicitly; no login promise may remain pending indefinitely.

The Web branch is not implemented in the inspected source.

## Security boundaries

- Never expose access tokens, refresh tokens, encryption keys, database credentials, or raw session secrets unnecessarily to application code.
- Do not use decoded-but-unverified JWT claims as an authorization source.
- If a service accepts an access token as a credential, that service must validate its signature, issuer, audience, expiry, and relevant claims.
- Do not add JWT validation to a flow that relies exclusively on a server-side session cookie unless the token is actually being accepted as a credential.
- Keep application-specific authorization in the consuming product.
