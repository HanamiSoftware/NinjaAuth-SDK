# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the shared identity and session service.

**Current package version:** 0.1.0

**Release status:** development milestone 0.1.0; no public npm release or release tag is asserted by this repository documentation. Do not use the former `1.0.1-beta` wording as a version or agreed milestone.

## Current public API

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

NinjaAuth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development", // or "production"; default: production
});

const user = await NinjaAuth.login();
const session = await NinjaAuth.getSession();
await NinjaAuth.logout();
```

- `login()` performs Authorization Code + PKCE for Chrome Extension and returns a normalized Ninja Connect user.
- `getSession()` observes the existing server-side session; it never starts interactive login.
- `logout()` revokes the current Ninja Connect session represented by the HttpOnly cookie.
- Only an explicit `401 INVALID_SESSION` is normalized to an unauthenticated session. Network, malformed-response, Worker, and temporary refresh failures remain errors.
- Chrome Extension login is implemented in source. Web login is explicitly unsupported and rejects with `UNSUPPORTED_PLATFORM`.

## Architecture

- **Ninja Connect** owns shared identity, authentication, and the central server-side session lifecycle.
- **NinjaAuth** implements the client-side authorization flow and stable SDK contract.
- **Consuming applications** own their application profiles, roles, permissions, capabilities, and business rules.
- AuthGear is the current upstream identity provider behind Ninja Connect; it is not part of the public SDK contract.
- Session secrets and upstream refresh tokens are never exposed to SDK JavaScript. The browser receives an opaque HttpOnly session cookie.

## Documentation

Start with the [documentation index](docs/README.md).

- [Architecture and responsibility boundaries](docs/ARCHITECTURE.md)
- [SDK ↔ Auth Worker API contract](docs/API-CONTRACT.md)
- [Roadmap and verified status](docs/ROADMAP.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Historical Core checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)
- [Historical milestone note — superseded](docs/RELEASE-NOTES-v1.0.1-beta.md)

## Version and artifact status — reviewed 4 November 2026

- `package.json`: `0.1.0`.
- `src/NinjaAuth.ts`: runtime version constant `0.1.0`.
- Source default scope: `openid profile email offline_access`.
- The committed `dist/index.global.js` still uses `openid offline_access` in its authorization request; the generated IIFE is not aligned with source.
- The Extension's vendored IIFE was previously reported to contain the full scope, but that does not establish that it matches a freshly generated SDK artifact.

The source and package version remain 0.1.0. Rebuild and verify every distribution artifact before publishing; do not infer release readiness from source code or a documentation milestone.

## Repository scope

This repository contains the NinjaAuth client SDK and its documentation. The Ninja Connect Auth Worker currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). A dedicated Worker repository transfer has not been completed.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
