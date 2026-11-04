# Historical checkpoint — NinjaAuth Core 0.1.0

> **Historical document.** This checkpoint was written on 3 November 2026 and is retained for decision history only. It is not the current status source; see [ROADMAP.md](ROADMAP.md).

## Version correction

The package metadata and source runtime constant are 0.1.0. The former title and references to `1.0.1-beta` were erroneous and are superseded. No 1.0.1-beta package version, release tag, or agreed milestone is asserted.

## Snapshot recorded at the time

The checkpoint described the following source implementation:

- init(): configuration with client ID, redirect URI, platform, and environment.
- login(): Authorization Code + PKCE for Chrome Extension.
- UUID state and callback-state equality validation.
- JSON exchange conforming to the documented Worker contract.
- Default scope read from NINJA_CONNECT.DEFAULT_SCOPE.
- getSession(): observation of the existing session and distinction between anonymous state and operational errors.
- logout(): current-session revocation through POST /v1/logout.
- Typed internal errors, including TRANSACTION_CLEANUP_FAILED.
- SDK node:test suite with 20 top-level cases.

This is a historical inventory, not a claim that every check passed on the current branch or commit.

## Architecture decisions retained

- Ninja Connect is the broker for shared identity and session.
- NinjaAuth is the client SDK, not the owner of application profiles.
- Each product maintains its own profiles, roles, permissions, capabilities, and business rules.
- AuthGear is an upstream provider behind Ninja Connect.
- The session cookie is HttpOnly; the client does not read or persist the secret.
- getSession() does not start interactive login.
- Only explicit 401 INVALID_SESSION becomes unauthenticated; temporary failures remain errors.
- Web login is not implemented and must fail explicitly.

## Verification limits

- A test file containing 20 cases is not evidence that the suite passed on a particular commit.
- The Extension build, Chrome runtime flow, and live cookie/CORS E2E require separate verification.
- Focused PostgreSQL tests with a mocked provider are not live identity-provider E2E.

For current branch state, release gates, and evidence, use [the roadmap](ROADMAP.md).
