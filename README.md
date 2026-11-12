# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK used by applications integrating with **Ninja Connect**, the shared identity broker.

> **Development status:** Core 0.1 is implemented for Chrome Extension and Web popup Authorization Code + PKCE flows, but it is **not release-ready**. SDK unit tests and CI exist; a passing mocked suite does not replace live browser, cookie, CORS, and backend integration checks. See [the branch roadmap](docs/ROADMAP.md).

## Public API

The SDK exports the `NinjaAuth` class. Its public constructor enforces one shared instance within the current JavaScript runtime. Initialize that instance once, then use it for the complete authentication lifecycle.

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "web", // or "extension"; default: web
  environment: "production", // or "development"; default: production
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

The constructor is public by design. A second `new NinjaAuth()` in the same runtime returns the existing instance. `init()` is an instance method, returns that same instance, and rejects a second initialization with `INITIALIZATION`. There is no static `NinjaAuth.init()` API.

The singleton is scoped to one JavaScript runtime. Separate pages, workers, or extension contexts do not share in-memory instances.

## Implemented behavior

- Chrome Extension Authorization Code + PKCE login.
- Web popup Authorization Code + PKCE login using a server-side OAuth transaction and an application backend callback.
- Application-owned Web sessions: the consuming backend creates its own HttpOnly cookie; NinjaAuth reads and logs out through the application API origin derived from `redirectUri`.
- Exported `completeWebAuthCallback()` helper for a same-origin result bridge; it forwards only state and outcome, never the authorization code or tokens.
- PKCE S256 and UUID state generation, with callback-state validation.
- Server-to-server authorization-code exchange with Ninja Connect for the Web flow; the Chrome Extension flow retains its existing exchange contract.
- Environment-aware endpoints; production is the default.
- Current-session lookup through `getSession()`; it does not start interactive login.
- Current-session logout through `logout()`.
- Typed SDK errors and OAuth transaction cleanup.

Only an explicit `401 INVALID_SESSION` response is normalized to an unauthenticated session. Network failures, malformed responses, temporary refresh failures, and other server errors remain errors.

## Web login

The Web platform uses a popup and a backend callback. Call `login()` directly from a user gesture; the SDK opens the blank popup synchronously before asynchronous PKCE and transaction-registration work.

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_WEB_CLIENT_ID",
  redirectUri: "https://api.example.com/v1/auth/callback",
  platform: "web",
  environment: "production",
});

loginButton.addEventListener("click", async () => {
  try {
    const user = await auth.login();
  } catch (error) {
    // Handle cancellation, popup blocking, provider errors, and session failures.
  }
});
```

`redirectUri` is the exact application backend callback registered for this client. The SDK registers state and the PKCE verifier with the broker, then opens the authorization popup. The authorization code is delivered to the backend callback, not to the opener page.

The consuming application's backend completes the server-to-server exchange, resolves the application profile, creates its own application session, and sets its own HttpOnly cookie. It redirects the popup to a minimal same-origin bridge page. The bridge sends only `state` and the success/error outcome through `postMessage`; it must never forward the code, verifier, access token, refresh token, or session cookie.

After the bridge response, NinjaAuth verifies state and reads the consuming application's session through the API origin derived from `redirectUri`. For the Web platform, `getSession()` and `logout()` use the application's own session endpoints. The Chrome Extension platform retains its existing broker session endpoints.

A same-origin bridge page can use the exported helper:

```ts
import { completeWebAuthCallback } from "@ninjaconnect/auth";

completeWebAuthCallback();
```

Keep the bridge page minimal, set a `no-referrer` policy, and do not load analytics or third-party scripts. The backend must validate the return origin against an allowlist.

**Verification boundary:** automated SDK tests cover mocked Web behavior. Real-browser verification is still required for popup opener preservation, credentialed CORS, cookie acceptance, callback registration, session refresh, and logout.

## Documentation

- [Documentation index](docs/README.md)
- [Branch roadmap and implementation status](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [SDK ↔ service API contract](docs/API-CONTRACT.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Test plan](docs/TEST-PLAN.md)
- [Historical Core checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)

## Related component

The Ninja Connect Auth Worker has historically been maintained in [NinjaURL Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Repository ownership and any future transfer are separate decisions; this README does not authorize changes to Ninja Connect.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
