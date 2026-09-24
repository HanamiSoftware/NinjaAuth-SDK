# NinjaAuth Core 0.1 — Roadmap A → E

> Roadmap to complete, validate and freeze the NinjaAuth Core 0.1 implementation.

## A — Close the Extension Authentication Flow

* [ ] Clean up `NinjaAuth.init()` without mutating the caller's configuration object.
* [ ] Align `NinjaAuthConfig.platform` with the intended default (`web` when omitted).
* [ ] Remove the duplicate OAuth transaction cleanup in `createAuthFlow()`.
* [ ] Align `/v1/exchange` response with the SDK contract:

  * `data.user` must contain the authenticated `NinjaUser`.
* [ ] Complete the extension login flow through `NinjaAuth.login()`.
* [ ] Verify the `ninja_session` HttpOnly cookie is created correctly.
* [ ] Verify the authenticated session through `/v1/session` and `/v1/user/me`.

**Exit condition:** Extension login works end-to-end through the public NinjaAuth API.

---

## B — Complete Session Restoration

Implement and validate `NinjaAuth.getSession()`.

Required scenarios:

* [ ] No session → anonymous response.
* [ ] Valid session → authenticated user and session information.
* [ ] Session close to expiration → server-side refresh.
* [ ] Invalid/revoked session → unauthenticated result.
* [ ] Refresh temporarily unavailable → correct error handling.
* [ ] Verify that `getSession()` does not start an interactive login flow.

**Exit condition:** The SDK can reliably restore and inspect the current Ninja Connect session.

---

## C — Complete Logout

Implement logout as a real Ninja Connect session lifecycle operation.

### Backend

* [ ] Add `/v1/logout`.
* [ ] Resolve the current `ninja_session`.
* [ ] Revoke the corresponding `authSession`.
* [ ] Clear the `ninja_session` cookie.
* [ ] Return the standard `NinjaApiResponse`.

### SDK

* [ ] Implement `NinjaAuth.logout()`.
* [ ] Call `/v1/logout` with credentials.
* [ ] Handle already-anonymous sessions safely.
* [ ] Verify that subsequent `getSession()` returns an anonymous session.

**Exit condition:** Logout invalidates the Ninja Connect session server-side and clears the browser session.

---

## D — Add Web Authentication

Extend the same Core API to the web platform.

### Web adapters

Create:

```text
src/platform/web/
├── AuthorizationLauncher.ts
└── TransactionStorage.ts
```

* [ ] Implement web OAuth transaction storage.
* [ ] Implement the web authorization launcher using `window.open()`.
* [ ] Implement the callback flow using the configured redirect URI.
* [ ] Complete `NinjaAuth.login()` for `platform: "web"`.
* [ ] Send `credentials: "include"` for session requests.
* [ ] Add/verify the production web origin in CORS.
* [ ] Validate web login, session restoration and logout end-to-end.

**Exit condition:** The same NinjaAuth Core API works for both Extension and Web clients.

---

## E — Validate, Document and Freeze Core 0.1

Final stabilization phase before moving to the next Ninja ecosystem layer.

### Validation

* [ ] Run the complete Extension E2E flow.
* [ ] Run the complete Web E2E flow.
* [ ] Test anonymous, authenticated, refreshed, revoked and expired sessions.
* [ ] Test logout and session invalidation.
* [ ] Verify OAuth state and PKCE flows.
* [ ] Verify API error handling and the unified response contract.
* [ ] Remove obsolete/duplicate code identified during the implementation.

### Documentation

* [ ] Update `docs/NINJAAUTH-CORE-CHECKPOINT.md`.
* [ ] Verify every Definition of Done item against the actual code.
* [ ] Document the final Core 0.1 public API.
* [ ] Prepare the verified source material for public Ninja Connect / NinjaAuth documentation.

### Freeze

* [ ] Confirm code and checkpoint are aligned.
* [ ] Confirm Extension and Web flows are working.
* [ ] Confirm session lifecycle is complete.
* [ ] Tag/release NinjaAuth Core 0.1.

> **Core 0.1 is considered complete only when the implementation, tests and checkpoint describe the same behavior.**

---

## Final sequence

```text
A — Extension Flow
        ↓
B — Session Restoration
        ↓
C — Logout
        ↓
D — Web Authentication
        ↓
E — Validation + Documentation + Freeze
        ↓
   NinjaAuth Core 0.1
```
