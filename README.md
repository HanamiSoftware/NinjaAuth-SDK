# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the shared identity and session service.

**Package/source version:** 0.1.0. No public release or release tag is asserted.

> **Development branch status:** the dev branch contains the Chrome Extension login, session, and current-session logout implementation, plus generated artifacts with the full default scope. The exported API is currently a class with a static `init()` factory that returns the singleton instance. Its public methods are instance methods; see the API contract and roadmap for an important mismatch with the current test calls.

## Current source usage shape

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = NinjaAuth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development", // or "production"; default: production
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

The example reflects the current source class shape: `init()` is static and returns the instance; `login()`, `getSession()`, and `logout()` are instance methods. Do not call those three methods directly on the exported class.

## Implementation boundaries

- Chrome Extension Authorization Code + PKCE is implemented in source.
- Web login remains explicitly unsupported and rejects with `UNSUPPORTED_PLATFORM`.
- `getSession()` observes the current server-side session and does not start interactive login.
- Only explicit `401 INVALID_SESSION` becomes an unauthenticated session; network, malformed-response, Worker, and temporary refresh failures remain errors.
- The generated dev IIFE includes `openid profile email offline_access`.
- The SDK test file contains 20 top-level cases, but the current test calls use instance methods directly on the exported class. This API/test mismatch must be resolved and the suite executed before claiming validation.

## Documentation

- [Documentation index](docs/README.md)
- [Authoritative dev branch roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [SDK ↔ Worker API contract](docs/API-CONTRACT.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Historical Core checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)

The SDK dev branch is divergent from master. Branch-specific implementation and artifact status must not be copied between them without verification.

## Repository scope

The Ninja Connect Auth Worker currently resides in [NinjaURL — Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its transfer to a dedicated repository is not complete.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
