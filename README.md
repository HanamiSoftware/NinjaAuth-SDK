# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the shared identity and session service.

> **Development status:** NinjaAuth Core 0.1 is not yet release-ready. The inspected SDK source still has an incomplete Extension exchange contract, a local development endpoint, an unfinished Web flow, a placeholder SDK logout method, and no SDK test suite in its package scripts. RT-001/RT-002 and RT-003 cover focused backend concurrency scenarios (real PostgreSQL, mocked upstream provider); they are not a complete live AuthGear end-to-end test. See the [roadmap](docs/ROADMAP.md) for evidence and next steps.

## Public API

The SDK exports the `NinjaAuth` class. Its public constructor enforces one shared instance within the current JavaScript runtime. Initialize that instance once, then use it for the complete authentication lifecycle.

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development", // or "production"; default: production
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

The constructor is public by design. A second `new NinjaAuth()` in the same runtime returns the existing instance. `init()` is an instance method, returns that same instance, and rejects a second initialization with `INITIALIZATION`. There is no static `NinjaAuth.init()` API.

The singleton is scoped to one JavaScript runtime. Separate pages, workers, or extension contexts do not share in-memory instances.

## Implemented behavior

- Chrome Extension Authorization Code + PKCE login.
- PKCE S256 and UUID state generation, with callback-state verification.
- Authorization-code exchange with Ninja Connect.
- Environment-aware endpoints; production is the default.
- Current-session lookup through `getSession()`; it does not start interactive login.
- Current-session logout through `logout()`.
- Typed SDK errors and OAuth transaction cleanup.
- Explicit rejection with `UNSUPPORTED_PLATFORM` for the not-yet-implemented web login flow.

Only an explicit `401 INVALID_SESSION` is normalized to an unauthenticated session. Network failures, malformed responses, temporary refresh failures, and other server errors remain errors.

## Public types

The current package entry point exports `NinjaAuthConfig` and `NinjaUser`. The `getSession()` return shape is `NinjaSession`; exporting that type from the package entry point remains an API completeness item to review.

## Documentation

- [Documentation index](docs/README.md)
- [Branch roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [SDK â†” Worker API contract](docs/API-CONTRACT.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Test plan](docs/TEST-PLAN.md)
- [Historical Core checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)

## Related component

The Ninja Connect Auth Worker currently resides in [NinjaURL â€” Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its transfer to a dedicated repository is not complete.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
