# Historical checkpoint — NinjaAuth Core 0.1

> This document records decisions and working notes from 1 November 2026. It is not the live implementation status source. Use [the dev roadmap](ROADMAP.md).

## Stable architecture decisions

- Ninja Connect is the Identity Broker for shared identity and central session lifecycle.
- NinjaAuth is a provider-neutral client SDK.
- Each consuming application owns its profiles, roles, permissions, capabilities, and business rules.
- AuthGear remains an upstream provider behind Ninja Connect.
- The client does not read or persist raw HttpOnly session secrets.
- getSession() observes the existing session and does not start interactive login.
- Only explicit INVALID_SESSION becomes unauthenticated; temporary failures remain errors.
- Web login remains unsupported until designed and implemented.

## Historical development notes

The original checkpoint described ongoing work on PKCE, OAuth state, callback handling, exchange contracts, session lookup, logout, typed errors, and backend concurrency tests. Those notes were a snapshot of the work reported at the time and must not be used to infer current branch implementation or test status.

## Current source of truth

The current dev branch export shape, package version, generated artifacts, test/API mismatch, and remaining validation tasks are documented in [ROADMAP.md](ROADMAP.md). The API contract is in [API-CONTRACT.md](API-CONTRACT.md).

No release readiness or passing test result is claimed by this historical checkpoint.
