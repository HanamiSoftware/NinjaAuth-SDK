# NinjaAuth browser E2E tests

This suite uses Playwright with headless Chromium to exercise the built SDK in a real browser engine.

## Run locally

```bash
npm ci
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser binary is installed separately from the npm package. GitHub Actions installs Chromium on its ephemeral runner; no hosted browser account or paid Playwright service is required.

## Coverage

- Desktop Web login opens a popup synchronously and completes through the same-origin callback bridge.
- The popup bridge returns only state and outcome; the SDK then reads the application session.
- The backend callback sets a host-only, HttpOnly, Secure, SameSite=Strict cookie. Chromium accepts it and sends it on the subsequent same-site cross-origin session request.
- iPhone and Android user-agent/device emulation use same-tab navigation and return to the app without an opener.
- iPadOS Safari desktop-mode detection uses the MacIntel plus touch-points signal.
- The broker transaction request carries the configured application callback and a PKCE verifier.

## Test boundary

The tests run against deterministic in-memory HTTP route fixtures. They exercise the actual compiled SDK and browser navigation, popup, origin, cookie and session behavior, but they do **not** contact AuthGear, deployed Ninja Connect Workers, NinjaURL production APIs, Cloudflare routes, or live credentials. They are browser-level SDK integration tests, not proof of the complete production OAuth deployment.

A separate staging E2E suite should later run against deployed services with dedicated test clients and credentials. Real iOS Safari and Android Chrome checks remain required; Chromium device emulation does not reproduce every platform-specific browser behavior.

## Diagnostics

On failure, Playwright retains a trace and screenshot under `test-results/`. CI uploads this directory as an artifact when the browser job fails. Never add real cookies, OAuth codes, PKCE verifiers, tokens or shared secrets to fixtures or test output.
