# NinjaAuth SDK

NinjaAuth is the TypeScript client SDK for integrating applications with **Ninja Connect**, the identity and session service.

> **Development status:** NinjaAuth Core 0.1 is not yet release-ready. The inspected SDK source still has an incomplete exchange contract, a local development endpoint, an unfinished Web flow, a placeholder logout method, and no SDK test suite in its package scripts. Recent refresh/logout concurrency tests validate important backend invariants, but are not a complete live Authgear end-to-end test.

## Documentation

All detailed documentation lives under **docs/**. Start with the [documentation index](docs/README.md).

- [Architecture and responsibility boundaries](docs/ARCHITECTURE.md)
- [SDK ↔ Auth Worker API contract](docs/API-CONTRACT.md)
- [Implementation roadmap and audit status](docs/ROADMAP.md)
- [Core 0.1 checkpoint](docs/NINJAAUTH-CORE-CHECKPOINT.md)
- [Development guide](docs/DEVELOPMENT.md)

## Quick start — intended API shape

~~~ts
import { NinjaAuth } from "@ninjaconnect/auth";

NinjaAuth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
});

const user = await NinjaAuth.login();
const session = await NinjaAuth.getSession();
~~~

This illustrates the intended developer experience; it is **not** a guarantee that the current implementation completes the full flow. Review the [roadmap](docs/ROADMAP.md) and [API contract](docs/API-CONTRACT.md) before integrating it.

## Core principles

- Ninja Connect owns shared identity, authentication, and the central session lifecycle.
- NinjaAuth orchestrates the client-side authentication flow; it does not manage database credentials, refresh-token encryption keys, or raw session secrets.
- The SDK can be used by applications outside the Ninja ecosystem.
- Product-specific profiles, roles, permissions, and capabilities remain owned by each application.
- The optional **NinjaAppAdapter<TProfile>** is an integration boundary for Ninja ecosystem products; it must not turn product-specific data into shared identity data.
- OAuth state and PKCE must be validated across client and server. Session secrets remain opaque to SDK JavaScript.
- A passing focused concurrency test is evidence for the tested interleaving, not proof that every possible distributed execution has been covered.

## Repository scope

This repository contains the NinjaAuth client SDK and its documentation. The corresponding [Ninja Connect Auth Worker](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker) currently resides in the NinjaURL repository. Its recent reliability tests were developed on a separate branch there; see the [roadmap](docs/ROADMAP.md) for exact status.

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
