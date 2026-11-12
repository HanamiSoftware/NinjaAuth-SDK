# NinjaAuth SDK — Architecture

## Purpose

NinjaAuth is the client SDK for integrating applications with Ninja Connect, the shared identity broker. The public SDK is provider-neutral; upstream identity-provider details remain behind the broker.

## Responsibility boundaries

### Identity broker dependency

The broker is responsible for shared identity and broker-side authentication operations. This document describes the integration as a dependency of the SDK; it is not an operational runbook for that service and does not authorize changes to its repository, configuration, secrets, migrations or deployment.

### NinjaAuth SDK

The SDK owns:
- client configuration;
- PKCE S256 and state generation;
- platform-specific authorization launch;
- state/outcome validation;
- session observation and logout through the correct platform endpoint;
- typed errors and lifecycle semantics.

For Web login, the SDK registers the PKCE transaction with the broker, opens the authorization popup, receives only a same-origin result signal from the application bridge, and then observes the application session through the application API. The SDK does not receive or forward the authorization code through popup messaging.

### Consuming application

Each consuming application owns:
- its backend callback;
- its user/profile mapping and product roles;
- its application session records and cookie;
- its capabilities, subscriptions, preferences and business logic.

For NinjaURL, the application callback is `https://api.ninjaurl.io/v1/auth/callback`. The NinjaURL backend completes the server-to-server exchange, creates the NinjaURL application session and sets the host-only HttpOnly cookie on `api.ninjaurl.io`. The Dashboard sends credentialed requests to that API; it does not read the cookie.

### Third-party SDK consumers

The SDK is designed to be provider-neutral and reusable by independent applications. Each consuming application must implement and secure its own backend callback, session lifecycle, profile mapping and authorization. A generic third-party integration guide remains future documentation work.

## Authentication flows

### Web

1. The SDK opens a popup synchronously from a user gesture.
2. It generates PKCE S256 and UUID state.
3. It registers state, client ID, verifier and exact application callback with the broker.
4. The broker returns an authorization URL; the provider redirects the authorization code to the broker callback.
5. The consuming application's backend completes the protected server-to-server exchange.
6. The application backend resolves identity, creates its own session and sets its own HttpOnly cookie.
7. The backend redirects to a same-origin bridge page. The bridge posts only state and outcome; it never forwards code, tokens, verifier or cookie.
8. The SDK validates state and reads the application session through the API origin derived from the registered callback.

### Chrome Extension

The Chrome Extension flow retains its platform-specific launcher, transaction storage and broker session endpoints. The Web application callback/session flow does not replace or repurpose Extension behavior.

## Identity and authorization are separate

- Shared identity is established by the broker.
- The consuming product maps that identity to its own user/profile record.
- Product roles, permissions and capabilities remain product-owned.
- A shared identity does not imply a shared application session or shared authorization context.

## Session architecture

For NinjaURL Web, the cookie is issued by the application backend on `api.ninjaurl.io`. It is host-only, HttpOnly, Secure, SameSite=Strict, Path=/, and has no Domain attribute. The Dashboard never reads the cookie; it sends credentialed requests to the API.

NinjaURL stores a hash of its session secret and encrypts the upstream refresh token at rest. Session expiry and refresh rules are owned by the NinjaURL backend and must be verified in that repository.

## Security boundaries

- Exact callback URI registration; no wildcard/prefix matching.
- The calling application origin must be validated by the relevant backend services.
- Inter-service credentials remain server-side and must never be bundled into browser code.
- The authorization code is delivered to a backend callback, not the parent JavaScript context.
- No code, verifier, access token, refresh token or session secret is posted to the opener.
- Application cookies are host-only and issued by the application API host.
- Cached user state is presentation state, not an authorization credential.

## Operational dependencies

The consuming application and broker have operational prerequisites such as callback registration, server-side credentials, transaction storage and browser CORS/cookie configuration. Their exact deployment state is not asserted by the SDK source. Verify these dependencies in their owning repositories and environments before a live integration test.
