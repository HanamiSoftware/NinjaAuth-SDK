# NinjaAuth SDK — Development Guide (dev)

## Requirements and commands

Use a supported Node.js LTS release and npm.

```bash
npm install
npm run typecheck
npm run build
npm test
```

- `typecheck`: TypeScript validation without emitting output.
- `build`: creates the package artifacts.
- `test`: runs the Node.js built-in test runner against `test/*.test.mjs`.

Run the commands from the SDK repository root. Record the exact branch and commit alongside the results. A test file being present is not evidence that it passed.

## Public API and singleton lifecycle

The public entry point exports the `NinjaAuth` class:

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

const auth = new NinjaAuth();

auth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
  environment: "development",
});

await auth.login();
const session = await auth.getSession();
await auth.logout();
```

The public constructor returns the same instance for repeated construction in the same JavaScript runtime. `init()` is an instance method, returns `this`, and may be called only once. A repeated initialization fails with `INITIALIZATION`.

Do not use the former static form `NinjaAuth.init(config)`. The Extension Background currently creates the instance with `new NinjaAuth()` and initializes it once.

## Test workflow

The automated suite lives in `test/ninja-auth.test.mjs`. It uses isolated module instances so the singleton state of one test cannot contaminate another. Chrome identity/storage and Worker HTTP responses are mocked at their boundaries.

The suite currently contains 33 test cases covering:

- Export shape, constructor singleton identity, initialization and configuration validation.
- Calls made before initialization and unsupported web login.
- Authenticated and anonymous session responses.
- The distinction between `INVALID_SESSION` and operational errors.
- Network and malformed-response handling.
- Current-session logout and its confirmation contract.
- Authorization Code + PKCE, state validation, cancellation and exchange failures.
- Transaction cleanup, including preservation of the primary error.
- A complete mocked login → session lookup → logout sequence.

Run:

```bash
npm run typecheck
npm run build
npm test
```

The suite was updated on dev, but it has not yet been executed on the resulting commit. Do not report it as passing until the commands have been run and their output reviewed.

## Environment configuration

- `development`: `http://127.0.0.1:8787/v1`.
- `production`: `https://auth.ninjaconnect.io/v1`.
- The SDK defaults to production; local development must opt into `environment: "development"`.
- The authorization origin remains `https://auth.ninjaconnect.io`.

Do not change Worker ports, CORS, cookie attributes, or deployment configuration without reviewing the corresponding Worker setup and consulting the project owner.

## Extension and Worker integration

The Extension Background owns SDK initialization and translates SDK results into Chrome runtime messages. The Side Panel remains a UI client and must not implement OAuth or call Auth Worker session routes directly.

A user cached in `chrome.storage.local` can restore the interface quickly, but it is presentation state, not proof of a currently valid server session. Protected operations must require a live session check. Temporary lookup failures must remain errors and must not be converted into an anonymous state or silently clear a cached user.

The Auth Worker currently resides in [NinjaURL-URL-Shortener/Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker).

## Remaining validation

- [ ] Run typecheck, build, and all 33 automated tests on the exact dev commit.
- [ ] Review the public type exports, including whether `NinjaSession` should be exported from the package entry point.
- [ ] Complete Chrome/Worker tests for cookies, CORS, cache restore, and protected-operation checks.
- [ ] Record the exact SDK, Extension, and Worker commits used for end-to-end validation.
- [ ] Complete security review before any release decision.

## Release discipline

The package and runtime source version are 0.1.0. No public release or tag is asserted. Agree explicitly on a future version before publishing.
