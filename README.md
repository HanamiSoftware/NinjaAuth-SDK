# NinjaAuth SDK

NinjaAuth is the TypeScript SDK for integrating applications with the Ninja Connect authentication service. This repository currently contains an early implementation focused on the Chrome extension flow; the web flow and the public SDK contract are still under development.

> **Status:** early development — not yet ready to be treated as a stable public SDK. See the [roadmap](docs/ROADMAP.md) before integrating it into a production application.

## Documentation

- [Architecture and authentication flows](docs/ARCHITECTURE.md)
- [Roadmap and current implementation status](docs/ROADMAP.md)
- [Development guide](docs/DEVELOPMENT.md)
- [HTTP API contract and known mismatches](docs/API-CONTRACT.md)

## Quick start (current implementation)

The current API exposes a singleton:

```ts
import { NinjaAuth } from "@ninjaconnect/auth";

NinjaAuth.init({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "YOUR_REGISTERED_REDIRECT_URI",
  platform: "extension",
});

const user = await NinjaAuth.login();
const session = await NinjaAuth.getSession();
```

This example describes the intended usage shape, **not a claim that the current end-to-end flow is production-ready**. Before using it, review the API contract: the SDK and the Auth Worker currently disagree on the exchange request format and required parameters. The `web` platform is not implemented, and `logout()` is currently a stub in the SDK.

## Core design principles

- The SDK orchestrates authentication; server-side session creation, validation, and revocation belong to the Ninja Connect Auth Worker.
- The browser session secret is stored in an `HttpOnly` cookie and must not be read or managed by SDK JavaScript.
- PKCE and OAuth `state` protect the authorization flow; they must be validated and consistently handled across the SDK and server.
- The Ninja Connect user ID is distinct from the identity provider's subject (`sub`). Application code should use the Ninja Connect user ID returned by the service.
- Environment-specific endpoints must be configured explicitly. Local development URLs must not ship as production defaults.

## Repository scope

This repository documents and implements the client SDK. The corresponding server-side worker lives in the [NinjaURL repository](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener/tree/master/Workers/auth-worker).

## License

Check the repository's license and package metadata before redistributing or publishing the SDK.
