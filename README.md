# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the shared identity and session service.

> **Development status:** NinjaAuth Core 0.1 is not yet release-ready. Chrome Extension and Web popup Authorization Code + PKCE flows are implemented in the current development branch, with automated SDK tests. See the [roadmap](docs/ROADMAP.md) for evidence and next steps.

## Public API

The SDK exports the `NinjaAuth` class. Its public constructor enforces one shared instance within the current JavaScript runtime. Initialize that instance once, then use it for the complete authentication lifecycle.

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension", //or "web"; default: web
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
- Web popup Authorization Code + PKCE login using a server-side OAuth transaction and a backend callback.
- Application-owned Web sessions: the backend callback creates the app's HttpOnly cookie; NinjaAuth reads and logs out through the application API origin.
- Exported `completeWebAuthCallback()` helper for a same-origin result bridge; it forwards only state and outcome, never the authorization code or tokens.
- PKCE S256 and UUID state generation, with callback-state verification.
- Server-to-server authorization-code exchange with Ninja Connect for the Web flow; the Chrome Extension flow retains its existing exchange contract.
- Environment-aware endpoints; production is the default.
- Current-session lookup through `getSession()`; it does not start interactive login.
- Current-session logout through `logout()`.
- Typed SDK errors and OAuth transaction cleanup.
- Explicit rejection with `UNSUPPORTED_PLATFORM` for the not-yet-implemented web login flow.

Only an explicit `401 INVALID_SESSION` is normalized to an unauthenticated session. Network failures, malformed responses, temporary refresh failures, and other server errors remain errors.

## Web login

The Web platform uses a popup and a backend callback. Call `login()` directly from a user gesture; the SDK opens the blank popup synchronously before generating the PKCE challenge.

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_WEB_CLIENT_ID",
  redirectUri: "https://<redirect_uri>/callback",
  platform: "web",
  environment: "production"
});

loginButton.addEventListener("click", async () => {
  try {
    const user = await auth.login();
  } catch (error) {
    // Handle cancellation, popup blocking, provider errors, and session failures.
  }
});
```

`redirectUri` is the exact backend callback registered for this client. Before opening the provider, the SDK sends `state`, `code_verifier`, and `redirect_uri`, `client_id` to Ninja Connect's `/v1/state` endpoint. Ninja Connect validates the exact client/callback registration and stores the short-lived PKCE transaction server-side. The authorization code returns directly to the backend callback; it is never exposed to the opener page.

The NinjaURL callback backend calls Ninja Connect's protected internal exchange endpoint server-to-server. Ninja Connect atomically consumes the transaction, retrieves the verifier, and exchanges the code with AuthGear. The caller APP then resolves the profile, creates its own application session, and sets an HttpOnly, Secure, host-only cookie on caller verified domain. It redirects the popup to a minimal bridge page on the caller origin. The bridge sends only `state` and the success/error outcome through `postMessage`; it never forwards the code, verifier, access token, refresh token, or session cookie.

After the bridge response, NinjaAuth verifies the state and reads the caller APP session through the API origin derived from `redirectUri`. `getSession()` and `logout()` therefore operate on the application's own session endpoints for the Web platform; the Chrome Extension platform retains the Ninja Connect endpoints.

A same-origin bridge page can use the exported helper:

```ts
import { completeWebAuthCallback } from "@ninjaconnect/auth";

completeWebAuthCallback();
```

Keep the bridge page minimal, set a `no-referrer` policy, and do not load analytics or third-party scripts. The backend must validate the return origin against an allowlist. Real browser verification is still required for popup opener preservation, credentialed CORS, cookie acceptance, and the exact production callback registration.

## Documentation

- [Documentation index](docs/README.md)
- [Branch roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [SDK â†” Worker API contract](docs/API-CONTRACT.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Test plan](docs/TEST-PLAN.md)
- [Historical Core checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)

## Related component

The Ninja Connect Auth Worker currently resides in [NinjaURL Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its transfer to a dedicated repository is not complete.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
