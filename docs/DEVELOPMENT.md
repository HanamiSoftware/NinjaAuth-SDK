# NinjaAuth SDK — Development Guide

## Requirements

The SDK is a TypeScript package built with tsup. Use a supported Node.js LTS release and npm.

```bash
npm install
```

## SDK scripts

```bash
npm run typecheck
npm run build
npm test
```

- `typecheck`: runs TypeScript without emitting output.
- `build`: creates ESM, CJS, declaration files, and the IIFE bundle via tsup.
- `test`: runs the Node.js built-in test runner against `test/*.test.mjs`. Tests import the built ESM artifact, so build before running the suite when source changes have not yet been built.

The master test file contains 20 top-level test cases and uses mocked Chrome extension APIs and mocked Auth Worker HTTP responses. This is test coverage evidence only; it does not mean the tests passed on every commit. These tests are not live end-to-end tests against a deployed Worker or identity-provider tenant.

## Suggested SDK workflow

1. Read Architecture and API contract.
2. Run `npm run typecheck`.
3. Add a focused test for each behavior change.
4. Run `npm run build`.
5. Run `npm test`.
6. Inspect generated declarations, ESM/CJS output, and IIFE bundle when public API or protocol behavior changes.
7. Update Roadmap and the relevant technical document.
8. For cross-repository changes, record the exact SDK, Extension, and Worker commits used.

## Environment configuration

- development: `http://127.0.0.1:8787/v1` for the local Ninja Connect Auth Worker.
- production: `https://auth.ninjaconnect.io/v1`.
- The SDK defaults to production; local development must opt into `environment: "development"`.
- The authorization origin remains `https://auth.ninjaconnect.io`.

Do not change Worker ports, CORS, cookie attributes, or deployment configuration without reviewing the corresponding Worker setup and consulting the project owner.

## Chrome Extension integration

The NinjaURL Extension loads the SDK IIFE in its classic Manifest V3 Background Service Worker through `importScripts`. The Background owns SDK initialization and translates SDK results into runtime messages. The Side Panel remains a UI client and must not implement OAuth or call Auth Worker session routes directly.

Extension branch status is maintained in the central NinjaURL roadmap. Do not assume Extension master and dev contain the same integration behavior.

### Cache-first restore security rule

A cached user may restore the UI immediately, but it is not an authorization credential. A null session means that no live session was checked in that call. Before any protected operation, verify the live session with NinjaAuth. Temporary lookup failures must remain errors and must not silently become anonymous state.

## Cross-repository verification

The Auth Worker currently lives in [NinjaURL-URL-Shortener/Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its transfer to a dedicated Ninja Connect repository has not been completed.

When verifying backend concurrency behavior, record whether PostgreSQL is real or mocked and whether the upstream identity provider is live or simulated. RT-001/RT-002/RT-003 are focused PostgreSQL integration tests with mocked upstream provider responses, not live provider E2E.

## Version and release discipline

The package metadata and runtime source constant currently report **0.1.0**. Do not use the former `1.0.1-beta` wording as a release milestone or package version.

Before publishing any future package:

- [ ] Agree explicitly on the target package version.
- [ ] Run typecheck, tests, and build on the exact release commit.
- [ ] Verify version and default scope in ESM, CJS, declarations, and IIFE output.
- [ ] Compare any vendored consumer bundle against the generated artifact.
- [ ] Build and load the Extension in Chrome.
- [ ] Verify login, session restoration, logout, login again, cookie/CORS behavior, and temporary failures.
- [ ] Confirm documentation, package metadata, source version, and distributed artifacts describe the same commit.

Do not claim a release or CI success unless the exact commit and run provide evidence.
