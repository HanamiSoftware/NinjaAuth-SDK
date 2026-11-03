# NinjaAuth SDK — Development Guide

## Requirements

The SDK is a TypeScript package built with tsup. Use a supported Node.js LTS release and npm.

~~~bash
npm install
~~~

## SDK scripts

~~~bash
npm run typecheck
npm test
npm run build
~~~

- typecheck: runs TypeScript without emitting output.
- test: runs the Node.js built-in test runner against test/ninja-auth.test.mjs. The tests import the built ESM artifact, so build before running the suite when source changes have not yet been built.
- build: creates ESM, CJS, declaration files, and the IIFE bundle via tsup.

The current test file contains 20 top-level test cases. It uses mocked Chrome extension APIs and mocked Auth Worker HTTP responses. These tests validate the SDK contract and selected success/failure paths; they are not live end-to-end tests against a deployed Worker or identity-provider tenant.

## Suggested SDK workflow

1. Read Architecture and API contract.
2. Run npm run typecheck.
3. Add a focused test for each behavior change.
4. Run npm run build.
5. Run npm test.
6. Inspect generated declarations, ESM/CJS output, and IIFE bundle when public API or protocol behavior changes.
7. Update Roadmap and the relevant technical document.
8. For cross-repository changes, record the exact SDK, Extension, and Worker commits used.

## Environment configuration

- development: http://127.0.0.1:8787/v1 for the local Ninja Connect Auth Worker.
- production: https://auth.ninjaconnect.io/v1.
- The SDK defaults to production; local development must opt into environment: "development".
- The authorization origin remains https://auth.ninjaconnect.io.

Do not change Worker ports, CORS, cookie attributes, or deployment configuration without reviewing the corresponding Worker setup.

## Chrome Extension integration

The NinjaURL Extension loads the SDK IIFE in its classic Manifest V3 Background Service Worker through importScripts. The Background owns SDK initialization and translates SDK results into runtime messages. The Side Panel remains a UI client and must not implement OAuth or call Auth Worker session routes directly.

The Extension's cache-first restore implementation is present on its remote dev branch as reviewed on 3 November 2026. It is not yet present on Extension master.

### Cache-first restore rule

- Cached user: restore the UI immediately with authenticated: true, user, and session: null; do not call /v1/session just to open the panel.
- No cached user: call NinjaAuth getSession().
- Temporary session lookup failure: preserve the cache and surface the error; do not convert the failure into anonymous state.
- Before any protected operation, verify the live session. A cached user is not an authorization credential.

## Cross-repository verification

The Auth Worker currently lives in [NinjaURL-URL-Shortener/Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its transfer to a dedicated Ninja Connect repository has not been completed.

When verifying backend concurrency behavior, record whether PostgreSQL is real or mocked and whether the upstream identity provider is live or simulated. RT-001/RT-002/RT-003 are focused PostgreSQL integration tests with mocked upstream provider responses, not live provider E2E.

## Beta milestone and release checklist

The project milestone is named **NinjaAuth v1.0.1-beta**. This is not yet the actual package version: package.json and src/NinjaAuth.ts still say 0.1.0.

Before creating a beta package/tag:

- [ ] Align package.json and the source runtime version constant to 1.0.1-beta.
- [ ] Rebuild all SDK artifacts after the default scope change.
- [ ] Verify the generated IIFE sends openid profile email offline_access.
- [ ] Re-vendor the rebuilt IIFE into the Extension.
- [ ] Run typecheck, tests, and build on the exact release commit.
- [ ] Build and load the Extension in Chrome.
- [ ] Verify login, session restoration, logout, login again, and cookie/CORS behavior.
- [ ] Verify cache-first restore and ensure protected actions perform a live session check.
- [ ] Confirm docs, package metadata, source version, and distributed artifacts describe the same release.

Do not claim a release or CI success unless the exact commit and run provide evidence.
