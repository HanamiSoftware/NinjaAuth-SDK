# NinjaAuth SDK — Architecture

## Purpose

NinjaAuth is the client-side SDK for integrating applications with **Ninja Connect**, the central identity and session service.

The SDK must be usable both by products in the Ninja ecosystem and by independent third-party applications.

## Responsibility boundaries

### Ninja Connect

Ninja Connect is the shared **Identity Broker**. Its responsibilities are authentication through configured identity providers, resolution of the shared Ninja Connect identity, and creation, validation, refresh, and revocation of the central application session.

Ninja Connect keeps session secrets and upstream refresh tokens server-side and sets/clears the ninja_session cookie.

Ninja Connect does **not** own the business authorization model of every application that uses it.

### NinjaAuth SDK

The SDK generates PKCE material and OAuth state, launches platform-specific authorization UI, validates callbacks, exchanges authorization results through Ninja Connect, and exposes a stable API such as init(), login(), getSession(), and logout().

The SDK must not contain database credentials, refresh-token encryption keys, or raw server session secrets.

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

The inspected source still contains a localhost API base URL, an incomplete Web branch, and a TODO in logout(). See the [roadmap](ROADMAP.md).

## Intended extension authentication flow

1. Application calls NinjaAuth.init(config).
2. SDK generates a high-entropy PKCE verifier/challenge and unpredictable state in the format required by the Worker.
3. SDK stores the short-lived client-side transaction.
4. SDK opens the authorization URL through chrome.identity.launchWebAuthFlow.
5. SDK parses the callback and verifies returned state against the initiated transaction.
6. SDK sends authorization code, verifier, state, client ID, and redirect URI using the agreed exchange schema.
7. Worker validates the exchange, contacts the identity provider, resolves the Ninja Connect identity, creates the server-side session, and sets the session cookie.
8. SDK returns the normalized Ninja Connect user profile.

The exact exchange contract must be aligned before this flow is considered complete. The experimental /v1/state endpoint is not a required step in the intended SDK flow; do not reintroduce it as an SDK dependency without an explicit architecture decision.

## Session architecture

The browser holds an opaque HttpOnly session cookie. SDK JavaScript must not read or persist the raw session secret.

At a high level, the Worker generates a cryptographically random session secret, stores only its hash in the database, stores the upstream refresh token encrypted at rest, resolves the cookie to an active database session, refreshes upstream credentials server-side when required, and revokes the local session during logout while attempting upstream token revocation.

The session has both a normal expiry and an absolute expiry. A refresh must never extend the absolute lifetime or reactivate a revoked session.

## Concurrency and session invariants

The Worker has been tested for two important refresh-token rotation races:

- A stale concurrent refresh receiving invalid_grant must not revoke a session whose refresh token was already rotated by another request.
- A logout that completes while refresh operations are in flight must prevail; a later refresh result must not reactivate the revoked database session.

The implementation uses conditional database updates as optimistic concurrency guards. This is not a distributed mutex and does not prove that every possible interleaving is covered. See [API contract — backend concurrency verification](API-CONTRACT.md#backend-concurrency-verification).

## Web platform

The platform: "web" branch is not implemented in the inspected source. Before enabling it, define redirect/callback handling, transaction storage, cookie/CORS requirements, and supported browser environments. A public method must never remain pending indefinitely for an unsupported platform.

## Security boundaries

- Never expose access tokens, refresh tokens, encryption keys, database credentials, or raw session secrets unnecessarily to application code.
- Do not use decoded-but-unverified JWT claims as an authorization source.
- If a service accepts an access token as a credential, that service must validate its signature, issuer, audience, expiry, and relevant claims.
- Do not add JWT validation to a flow that relies exclusively on a server-side session cookie unless the token is actually being accepted as a credential.
- Keep application-specific authorization in the consuming product.
