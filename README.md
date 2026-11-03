# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the shared identity and session service.

> **Project milestone — NinjaAuth v1.0.1-beta (3 November 2026).** This is the agreed internal milestone name, not yet the published npm/package version. Repository metadata and the source constant still report **0.1.0**; the generated SDK distribution must be rebuilt and aligned before a v1.0.1-beta package or tag is published.

> **Release status:** beta development milestone; not production-release-ready. The Chrome Extension integration is present on the NinjaURL Extension master branch. The cache-first restore optimization is present on the Extension dev branch, not yet on Extension master. Live Extension/Worker end-to-end verification remains open.

## Current public API

~~~ts
import { NinjaAuth } from "@ninjaconnect/auth";

NinjaAuth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development", // or "production"; default: production
});

const user = await NinjaAuth.login();         // Promise<NinjaUser>
const session = await NinjaAuth.getSession();  // Promise<NinjaSession>
await NinjaAuth.logout();                     // Promise<void>
~~~

- login() performs Authorization Code + PKCE and returns the normalized Ninja Connect user.
- getSession() observes the existing server-side session; it never starts interactive login.
- logout() revokes the current Ninja Connect session represented by the HttpOnly cookie.
- Only an explicit 401 INVALID_SESSION is normalized to an unauthenticated session. Network, malformed-response, Worker, and temporary refresh failures remain errors.
- Chrome Extension login is implemented. Web login is explicitly unsupported and rejects with UNSUPPORTED_PLATFORM.

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
- [Beta milestone notes](docs/RELEASE-NOTES-v1.0.1-beta.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Core checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)

## Version and artifact caveat

As reviewed on 3 November 2026:

- package.json version: **0.1.0**.
- src/NinjaAuth.ts runtime version constant: **0.1.0**.
- The source now reads the default authorization scope from NINJA_CONNECT.DEFAULT_SCOPE (openid profile email offline_access).
- dist/index.global.js has not yet been rebuilt after that source change; its authorization request still uses openid offline_access.
- The NinjaURL Extension's vendored IIFE currently contains openid profile email offline_access.

Do not publish or tag the package as 1.0.1-beta until package metadata, source version, generated dist/, and the Extension's vendored bundle are aligned and the release checks in the roadmap pass.

## Repository scope

This repository contains the NinjaAuth client SDK and its documentation. The Ninja Connect Auth Worker currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). A dedicated Worker repository transfer has not been completed.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
