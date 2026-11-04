# NinjaAuth SDK — Development Guide (dev)

## Requirements and scripts

The SDK is a TypeScript package built with tsup. Use a supported Node.js LTS release and npm.

```bash
npm install
npm run typecheck
npm run build
npm test
```

- `typecheck`: TypeScript check without emitting output.
- `build`: generates ESM, CJS, declarations, and IIFE artifacts.
- `test`: runs the Node.js built-in test runner against `test/*.test.mjs`.

The dev test file contains 20 top-level cases and imports the built ESM artifact. However, the tests call `login()`, `getSession()`, and `logout()` on the exported class, while the current source defines those as instance methods and returns the instance from static `init()`. Resolve this mismatch before treating the suite as a valid regression signal. No test pass is asserted in this guide.

## Current dev API shape

```ts
const auth = NinjaAuth.init(config);
await auth.login();
await auth.getSession();
await auth.logout();
```

The exported `NinjaAuth` symbol is a class. `init()` is static and returns the singleton instance; the lifecycle methods are instance methods. Keep examples, source exports, ESM/CJS/IIFE builds, and tests aligned with the chosen API design.

## Suggested workflow

1. Read Architecture and API contract.
2. Confirm the exact branch and commit.
3. Resolve the public export/API shape before adding more consumers.
4. Run `npm run typecheck`.
5. Run `npm run build`.
6. Fix test setup to use the returned instance, then run `npm test`.
7. Inspect ESM, CJS, declarations, and IIFE output.
8. Update the branch roadmap with the exact test and build evidence.
9. Record the exact SDK, Extension, and Worker commits used for cross-repository verification.

## Environment configuration

- development: `http://127.0.0.1:8787/v1`.
- production: `https://auth.ninjaconnect.io/v1`.
- The SDK defaults to production; local development must opt into `environment: "development"`.
- The authorization origin remains `https://auth.ninjaconnect.io`.

Do not change Worker ports, CORS, cookie attributes, or deployment configuration without reviewing the corresponding Worker setup and consulting the project owner.

## Extension and Worker integration

The Auth Worker currently resides in [NinjaURL-URL-Shortener/Workers/auth-worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). Its dedicated repository transfer has not been completed.

The Extension's Background should own SDK initialization and translate SDK results into runtime messages. The Side Panel should remain a UI client and must not implement OAuth or call Auth Worker session routes directly. Verify the exact Extension branch before documenting cache-first restore or protected-operation behavior.

A cached user restores UI only; it is not an authorization credential. Before protected operations, obtain a live NinjaAuth session result. Temporary lookup failures must remain errors.

## Release discipline

The package and runtime source version are 0.1.0. No public release or tag is asserted. The former 1.0.1-beta wording was erroneous and is superseded.

Before any future publication:

- [ ] Agree explicitly on the target package version.
- [ ] Resolve the source/export/test API mismatch.
- [ ] Run typecheck, tests, and build on the exact candidate commit.
- [ ] Verify version and default scope in all distribution artifacts.
- [ ] Compare vendored consumer bundles against the generated SDK artifact.
- [ ] Complete Chrome login/session/logout and cookie/CORS E2E.
- [ ] Confirm documentation, package metadata, source version, and distributed artifacts describe the same commit.
