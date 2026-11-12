# NinjaAuth SDK — Development Guide

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
  platform: "extension", // or "web"; default: web
  environment: "development", // or "production"; default: production
});

const user = await auth.login();
const session = await auth.getSession();
await auth.logout();
```

The public constructor returns the same instance for repeated construction in the same JavaScript runtime. `init()` is an instance method, returns `this`, and may be called only once. A repeated initialization fails with `INITIALIZATION`.

## Test workflow

The automated suite lives in `test/ninja-auth.test.mjs`. It uses isolated module instances so the singleton state of one test cannot contaminate another. Chrome identity/storage and HTTP responses are mocked at their boundaries.

Coverage includes:
- Public exports, constructor singleton identity, initialization and configuration validation.
- Chrome Extension PKCE, callback state validation, exchange response validation and transaction cleanup.
- Web popup opening synchronously before asynchronous work.
- Web state registration and application callback/session handling.
- Web callback outcome and state validation.
- Session observation and logout contracts for both platform endpoint families.
- Popup cancellation/closure and provider error paths.
- Malformed responses, network failures and operational errors.
- Login → session lookup → logout sequences.

Mocks prove SDK behavior against controlled responses. They do not prove live provider behavior, popup opener preservation, browser cookie acceptance or deployed CORS configuration.

## Environment configuration

- `development`: `http://127.0.0.1:8787/v1`.
- `production`: `https://auth.ninjaconnect.io/v1`.
- The SDK defaults to production; local development must opt into `environment: "development"`.
- The authorization origin remains `https://auth.ninjaconnect.io`.

Do not change Worker ports, CORS, cookie attributes or deployment configuration without reviewing the corresponding consuming application/Worker setup and consulting the project owner.

## Extension and Worker integration

The Extension Background owns SDK initialization and translates SDK results into Chrome runtime messages. The Side Panel remains a UI client and must not implement OAuth or call Auth Worker session routes directly.

A user cached in `chrome.storage.local` can restore the interface quickly, but it is presentation state, not proof of a currently valid server session. Protected operations must require a live session check. Temporary lookup failures must remain errors and must not be converted into anonymous state or silently clear a cached user.

The Auth Worker integration is maintained in the NinjaURL Workers repository. The SDK repository documents the client contract; it does not own that Worker deployment.

## Remaining validation

- [ ] Run typecheck, build and all SDK automated tests on the exact candidate commit.
- [ ] Verify built package exports, including `NinjaSession`, from the package tarball.
- [ ] Complete Chrome/Worker checks for cookies, CORS, cache restore and protected-operation checks.
- [ ] Complete Web browser checks for popup lifecycle, callback bridge, cookies, CORS, session lookup and logout.
- [ ] Record exact SDK, Extension, Dashboard and Worker commits used for end-to-end validation.
- [ ] Complete security review before any release decision.

## Release discipline

The package and runtime source version is recorded as 0.1.0. No public release or tag is asserted here. Agree explicitly on a future version before publishing.
