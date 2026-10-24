# NinjaAuth SDK — Architecture

## Purpose and boundaries

NinjaAuth is the client-side integration layer for Ninja Connect authentication. It should make the authentication lifecycle straightforward for application developers while keeping security-sensitive session operations on the server.

### Responsibilities

**SDK**
- Build authorization requests and generate PKCE material.
- Generate and validate OAuth `state`.
- Launch the platform-specific authorization UI.
- Exchange the authorization result through the Ninja Connect API.
- Offer stable methods such as `init()`, `login()`, `getSession()`, and `logout()`.
- Translate HTTP and OAuth failures into predictable SDK errors.

**Ninja Connect Auth Worker**
- Store short-lived OAuth transaction state.
- Exchange the authorization code with the identity provider.
- Create the Ninja Connect application session.
- Store only a hash of the session secret in the database.
- Validate/refresh sessions and revoke them on logout.
- Set and clear the `ninja_session` cookie.

**Identity provider (currently Authgear)**
- Authenticate the user and issue OAuth tokens.
- Supply user identity claims.
- Support token refresh and, where available, token revocation.

The SDK must not handle database credentials, refresh-token encryption keys, or raw session secrets.

## Current components in this repository

- `src/NinjaAuth.ts`: public SDK client and lifecycle methods.
- `src/config.ts`: central endpoint/scope constants (currently not consistently used by the client).
- `src/oauth/authorization.ts`: authorization URL construction and callback parsing.
- `src/oauth/state.ts`: random OAuth state generation.
- `src/utils/pkce.ts`: PKCE verifier and S256 challenge generation.
- `src/platform/chrome/AuthorizationLauncher.ts`: Chrome Identity API authorization launcher.
- `src/platform/chrome/TransactionStorage.ts`: temporary OAuth transaction storage using `chrome.storage.session`.
- `src/types/types.ts`: public configuration, user/session, and transaction types.

## Intended extension flow

1. Application calls `NinjaAuth.init(config)`.
2. SDK generates a high-entropy PKCE verifier/challenge and an unpredictable `state`.
3. SDK starts an authorization transaction with the server if required by the API contract.
4. SDK opens the authorization URL through `chrome.identity.launchWebAuthFlow`.
5. SDK parses the redirect and validates that the returned `state` matches the initiated transaction.
6. SDK sends the authorization code, verifier, state, client ID, and redirect URI to the exchange endpoint using the exact agreed request schema.
7. Worker validates the transaction, exchanges the code, resolves the Ninja Connect identity, creates the server-side session, and sets the session cookie.
8. SDK returns the normalized Ninja Connect user profile.

**Current status:** steps are only partially wired together. In particular, the SDK does not currently register state with the worker, the SDK state generator emits hex while the worker schema expects a UUID, and the exchange request body does not match the worker's JSON schema. See [API contract](API-CONTRACT.md).

## Session retrieval

The SDK calls `GET /v1/session` with `credentials: "include"`. The browser attaches the cookie where browser cookie policy permits it. The worker validates the session and may refresh the upstream OAuth token.

The SDK should treat the cookie as opaque. Do not expose the session secret to JavaScript or persist it in extension storage/local storage.

## Logout

The Auth Worker implements `POST /v1/logout`. Its intended behavior is to revoke the local session, attempt remote refresh-token revocation, and clear the `ninja_session` cookie.

The SDK's public `logout()` method is still a TODO in the current source. It should call the worker endpoint with `credentials: "include"`, handle the response consistently, and document that local application-session revocation is distinct from guaranteed remote token revocation.

## Web platform

The `platform: "web"` branch is currently unimplemented. Before enabling it, define the redirect/callback handling strategy, storage strategy, cookie/CORS requirements, and supported browser environments. Do not silently allow a web login promise to remain pending.

## Identity mapping

Keep these identifiers distinct:
- **Ninja Connect user ID:** the application-facing user identifier returned by the worker.
- **Identity provider subject (`sub`):** the upstream identity-provider identifier used internally for account mapping.

Application code should use the Ninja Connect ID, not infer or reconstruct the upstream subject.
