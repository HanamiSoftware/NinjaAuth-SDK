# Ninja Connect Auth API — SDK/Worker Contract

This document records the contract visible in the current SDK and the Auth Worker at the time of review. Treat it as an integration checklist, not a substitute for the worker's authoritative implementation. Update it whenever either side changes.

## Worker routes currently visible in source

Worker source: [Workers/auth-worker/src/index.ts](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/blob/master/Workers/auth-worker/src/index.ts)

| Method | Path | Purpose | SDK status |
|---|---|---|---|
| `GET` | `/v1/session` | Resolve current Ninja Connect session | SDK calls it |
| `POST` | `/v1/state` | Store short-lived OAuth transaction in `OAUTH_STATE` KV | SDK does not currently call it |
| `POST` | `/v1/exchange` | Exchange authorization code and create application session | SDK calls it with a mismatched request schema |
| `POST` | `/v1/logout` | Revoke application session and clear cookie | SDK method is currently a TODO |
| `GET` | `/v1/user/me` | Return current authenticated user | No corresponding SDK method currently shown |

## Important current mismatches

### 1. Exchange request body

**SDK currently sends** `application/x-www-form-urlencoded` with:
- `grant_type=authorization_code`
- `code`
- `redirect_uri`
- `client_id`
- `code_verifier`

**Worker currently expects** JSON with:
- `state` (UUID)
- `code`
- `client_id`
- `code_verifier`
- `redirect_uri`

The SDK omits `state`, and the body encoding differs. The current flow is therefore not aligned with the worker contract.

### 2. OAuth transaction registration and state format

The worker's `POST /v1/state` expects JSON with `state` (UUID), `client_id`, `code`, `code_verifier`, and `redirect_uri`. The current SDK:
- generates a hexadecimal state string via `generateState()`;
- stores the verifier/redirect URI only in extension session storage;
- does not call `POST /v1/state`.

There is a further design question to resolve: the worker's state-registration schema requires a `code`, but a transaction is normally registered before the authorization redirect returns a code. Confirm whether that schema is intentional or should be changed before wiring the endpoint into the SDK.

### 3. Endpoint configuration

The SDK currently hardcodes `http://127.0.0.1:8787/v1` in `src/NinjaAuth.ts`. `src/config.ts` contains `https://auth.ninjaconnect.io` and an exchange endpoint constant, but the client does not consistently use these constants. Define explicit environment configuration and avoid localhost production defaults.

### 4. Authorization endpoint

The SDK currently builds the authorization URL from `https://auth.ninjaconnect.io/oauth2/authorize`. Keep this behavior only if it matches the agreed architecture for the current private SDK. If the public SDK will instead begin at a Ninja Connect-owned authorization endpoint, document that as a deliberate flow/version change rather than silently switching endpoints.

## Cookie and credential requirements

- Session creation returns a `ninja_session` cookie from the worker.
- Session and logout requests should use `credentials: "include"` so the browser can send/accept cookies where origin and cookie policy permit.
- The cookie is `HttpOnly`; SDK JavaScript cannot and should not read it directly.
- Validate CORS origin/credentials settings and cookie attributes against the actual production origin layout.
- Do not put the raw session secret or refresh token in SDK storage.

## Recommended response contract to standardize

The worker uses shared `ninjaSuccess` / `ninjaError` response helpers. Before shipping the SDK, document the exact JSON envelope and types for success and error responses. The current SDK assumes fields such as `success`, `message`, and `data.user` in some places; do not rely on those shapes until verified against the helper implementation.

## Acceptance checklist

- [ ] Request method/path, content type, required fields, and response schema are defined for each endpoint.
- [ ] State format and lifetime are consistent across SDK, KV, and callback.
- [ ] State is bound to the correct client, redirect URI, and PKCE verifier.
- [ ] Exchange cannot succeed with a missing, reused, expired, or mismatched state.
- [ ] Session cookie is set, sent, refreshed, and cleared as expected.
- [ ] Logout revokes the local session even if remote token revocation is unavailable.
- [ ] CORS and credential behavior is tested from each supported client origin.
