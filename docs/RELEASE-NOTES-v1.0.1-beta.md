# NinjaAuth v1.0.1-beta — project milestone notes

**Milestone date:** 3 November 2026  
**Status:** internal beta milestone; not a published SDK package or release tag.

## What this milestone represents

NinjaAuth has reached a coherent client-side authentication design for Chrome Extension consumers of Ninja Connect. The SDK owns the client-side Authorization Code + PKCE flow and the public session/logout contract. Ninja Connect remains responsible for shared identity and server-side session lifecycle. Consuming applications retain ownership of their profiles, permissions, capabilities, and business rules.

## Included implementation

- Environment-aware Ninja Connect endpoints for development and production.
- Chrome Extension Authorization Code + PKCE login.
- UUID OAuth state and callback-state equality validation.
- JSON /v1/exchange request contract.
- Default authorization scope in source: openid profile email offline_access.
- Normalized getSession() result, with explicit handling of 401 INVALID_SESSION.
- Current-session logout() with explicit server confirmation.
- Typed SDK errors and OAuth transaction cleanup that does not mask the primary failure.
- NinjaURL Extension integration on Extension master, using the SDK IIFE from the MV3 Background Service Worker.
- Cache-first session restore is present on Extension dev: a cached user restores the UI with session null; a missing cache falls back to NinjaAuth getSession().

## Important limitations

- The actual SDK package and source runtime version are still 0.1.0, not 1.0.1-beta.
- The generated SDK dist/index.global.js is stale after the source default-scope change; it still sends openid offline_access in the authorization request.
- The Extension vendored IIFE contains the full default scope, so it is not yet proven byte-for-byte aligned with a rebuilt SDK release artifact.
- Web login is unsupported and rejects explicitly.
- The Extension cache-first restore path is on dev, not master.
- A cached user is a UI restoration hint, not proof of a valid server session. Protected operations must perform a live session check.
- Extension build and real Chrome/Worker cookie/CORS end-to-end verification remain open.
- No public npm publish or release tag is claimed.

## Required work before publishing the beta package

1. Align package.json, source VERSION, generated artifacts, and the Extension vendored bundle to 1.0.1-beta.
2. Run typecheck, tests, and build on the exact release commit.
3. Build and load the Extension in Chrome.
4. Verify login, session restoration, logout, login again, cookie/CORS, and temporary failure behavior.
5. Verify cache-first restore and live session validation before protected actions.
6. Confirm documentation and shipped artifacts match the same commit.

This milestone records the current architectural and implementation checkpoint. It is not a declaration of production readiness.
