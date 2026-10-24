# Development Guide

## Requirements

The SDK is a TypeScript package using tsup for builds. Install a supported Node.js LTS release and npm, then install dependencies:

```bash
npm install
```

## Available scripts

From the package manifest:

```bash
npm run build
npm run dev
npm run typecheck
```

- `build`: creates ESM, CJS, declaration files, and an IIFE bundle via tsup.
- `dev`: runs tsup in watch mode.
- `typecheck`: runs TypeScript without emitting output.

The current SDK package manifest does not define a test script. Add tests and a test command before treating the SDK as release-ready.

## Suggested local workflow

1. Read the [architecture](ARCHITECTURE.md) and [API contract](API-CONTRACT.md).
2. Run `npm run typecheck` before making changes.
3. Make a small change and add a focused test.
4. Run typecheck, tests, and `npm run build`.
5. Inspect generated declarations and bundles when public API changes.
6. Update the roadmap and API contract in the same change when behavior or endpoint schemas change.

## Working with the Auth Worker

The worker lives in the [NinjaURL repository](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker). The current worker has routes for session lookup, OAuth state registration, code exchange, logout, and current-user lookup.

Do not assume the SDK contract is already aligned: the current SDK sends form-encoded exchange data without `state`, while the worker parses JSON and requires `state`. See [API contract](API-CONTRACT.md).

## Security checklist for changes

- Keep PKCE verifier and OAuth transaction data short-lived.
- Validate callback state before exchanging the authorization code.
- Remove transaction data after success and all error/cancellation paths.
- Never log access tokens, refresh tokens, session secrets, or PKCE verifiers.
- Keep secrets and database access in the worker, not in the browser SDK.
- Use HTTPS in production and explicit environment configuration.
- Treat untrusted response bodies as unknown; validate them before accessing nested properties.
- Test behavior when fetch fails, the server returns non-JSON, or the user cancels authorization.

## Pull request checklist

- [ ] Typecheck passes.
- [ ] Tests added/updated and pass.
- [ ] Build succeeds.
- [ ] SDK and worker contract stays aligned.
- [ ] Documentation and roadmap are updated.
- [ ] No secrets or generated local files are committed accidentally.
