# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the shared identity and session service.

> **Development status:** NinjaAuth Core 0.1 is not yet release-ready. Chrome Extension and Web popup Authorization Code + PKCE flows are implemented in the current development branch, with automated SDK tests. Real browser/provider/Worker verification, especially credentialed cookie behavior across the Dashboard and Ninja Connect origins, remains open. See the [roadmap](docs/ROADMAP.md) for evidence and next steps.

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
- Web popup Authorization Code + PKCE login, with same-origin callback messaging and session-scoped transaction storage.
- Exported `completeWebAuthCallback()` helper for the consuming application's registered Web redirect page.
- PKCE S256 and UUID state generation, with callback-state verification.
- Authorization-code exchange with Ninja Connect.
- Environment-aware endpoints; production is the default.
- Current-session lookup through `getSession()`; it does not start interactive login.
- Current-session logout through `logout()`.
- Typed SDK errors and OAuth transaction cleanup.
- Explicit rejection with `UNSUPPORTED_PLATFORM` for the not-yet-implemented web login flow.

Only an explicit `401 INVALID_SESSION` is normalized to an unauthenticated session. Network failures, malformed responses, temporary refresh failures, and other server errors remain errors.

## Web login

The Web platform uses a popup. Call `login()` directly from a user gesture (for example, the click handler); the SDK opens the blank popup synchronously before generating the asynchronous PKCE challenge.

Main application:

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_WEB_CLIENT_ID",
  redirectUri: new URL("/auth/callback", window.location.origin).toString(),
  platform: "web",
  environment: "production"
});

loginButton.addEventListener("click", async () => {
  try {
    const user = await auth.login();
    // The popup has completed and closed; the main page owns the result.
  } catch (error) {
    // Handle cancellation, popup blocking, provider errors, and exchange errors.
  }
});
```

The registered `redirectUri` must be on the **same origin** as the page that calls `login()`. Its callback page must load the SDK and call the exported helper:

```ts
import { completeWebAuthCallback } from "@ninjaconnect/auth";

completeWebAuthCallback();
```

The helper forwards only `code`, `state`, and OAuth error fields to the opener using `postMessage`, then closes the popup. The main page checks the callback origin and popup window reference, validates `state`, retrieves the PKCE verifier from its own `sessionStorage`, and performs the code exchange. The verifier and session cookie are never sent in the popup message.

Keep the callback page minimal: do not load analytics or third-party scripts, use a `no-referrer` policy, and configure response headers so the provider's popup flow preserves the opener relationship (verify the effective Cross-Origin-Opener-Policy in a real browser). The Worker must also allow the exact application origin for credentialed CORS requests, and the browser must accept the session cookie from the Ninja Connect origin. These cookie/CORS conditions require live-browser verification; passing SDK mocks does not prove them.

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
