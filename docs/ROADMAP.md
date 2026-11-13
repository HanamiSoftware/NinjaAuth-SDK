# NinjaAuth — Roadmap and implementation status

**Last reviewed:** 13 November 2026  
**Repository:** `HanamiSoftware/NinjaAuth-SDK`  
**Branch for this documentation revision:** `feature/auth-mobile-redirect-flow`  
**Package/source version recorded in repository:** `0.1.0`  
**Release status:** not declared release-ready

> This is a branch-specific status document. Before relying on an item for a release, verify the exact branch SHA and rerun the required checks. Do not copy this status to `master` without reviewing its diff.

## 1. Executive status

The SDK source on the reviewed development line contains:
- Chrome Extension Authorization Code + PKCE login;
- Web desktop popup and mobile same-tab Authorization Code + PKCE launch, using the existing broker flow, backend callback and application-owned session.

The Web flow is **implemented in the SDK source**. This does not mean that every live browser/provider/cookie scenario has been verified. Automated SDK tests use mocks at external boundaries; real-browser and environment integration checks remain a separate release requirement.

The package remains pre-release. No public release or tag is asserted by this document.

## 2. Public API and implementation

The public entry point exports:
- `NinjaAuth`;
- `completeWebAuthCallback`;
- types `NinjaAuthConfig`, `NinjaUser`, and `NinjaSession`.

The constructor enforces a singleton within one JavaScript runtime. `init()` is an instance method and can be called once.

### Implemented source behavior

| Area | Source status | Verification boundary |
|---|---|---|
| Configuration | Required client ID and redirect URI; platform defaults to Web; environment defaults to production | Unit tests cover validation; verify exact consumer configuration separately |
| Chrome Extension login | Authorization Code + PKCE, transaction storage, callback-state validation and exchange | Chrome/Worker E2E must be tied to exact commits |
| Web login | Desktop popup or mobile same-tab navigation, server-side state registration, callback outcome/state validation and application session lookup | Mocked SDK coverage does not prove live popup, mobile navigation, cookie or CORS behavior |
| Session lookup | `getSession()` observes current session and does not initiate login | Explicit `401 INVALID_SESSION` is unauthenticated; operational failures remain errors |
| Logout | Uses platform-appropriate endpoint and requires explicit `loggedOut === true` confirmation | Verify revocation, cookie clearing and login-again in browser |
| Web bridge | `completeWebAuthCallback()` forwards only state and outcome | Verify exact origin and opener behavior in browser |
| Types | `NinjaAuthConfig`, `NinjaUser`, `NinjaSession` exported by package entry point | Add/retain type-level export tests |

## 3. Architecture decisions

- Ninja Connect is the shared identity broker; NinjaAuth is a client SDK.
- The consuming application owns its application session/cookie, user/profile mapping, business authorization, roles and capabilities.
- Product-specific RBAC must not be moved into the identity broker.
- The SDK public API remains provider-neutral; upstream provider details and credentials are not exposed to consumers.
- `login()` starts interactive authentication; `getSession()` observes the current session.
- Only explicit `401 INVALID_SESSION` is normalized to unauthenticated. Network failures, malformed responses and other operational failures remain errors.
- The Web flow uses an application backend callback and application-owned session. The Extension flow retains its platform-specific transaction and session contract.
- No repository transfer, merge, or deployment is implied by SDK implementation or tests.

## 4. Test and evidence status

The repository's test plan is authoritative for test scope: [Test Plan](TEST-PLAN.md).

A previously recorded CI run (#25) reported typecheck, build and 37/37 SDK tests passing on development commit `a8e79dceea72cbc8c2b0c69f897ec42c9e0ce9d4`. This is historical evidence for that exact commit, not proof that the current branch head has been tested.

### Required checks before release consideration

1. Run `npm run typecheck`, `npm run build`, and `npm test` on the exact candidate commit.
2. Record full run URL, branch, commit SHA and outcomes.
3. Complete Chrome Extension ↔ Worker checks for login, session restore, logout and login-again.
4. Complete Web browser checks for popup lifecycle, callback bridge, state mismatch, credentialed CORS, cookie creation/retention/clearing, session lookup and logout.
5. Verify no code, verifier, tokens, cookie values or shared secrets are exposed in URLs, logs, storage or popup messages.
6. Review release metadata, package contents, versioning and publication process.

Mocks, typecheck and build are not substitutes for live integration testing.

## 5. Open work, ordered

### P0 — Evidence and security hardening

- [ ] Run the complete SDK CI suite on the exact current development commit and record evidence.
- [ ] Complete the real-browser Web integration matrix in [TEST-PLAN.md](TEST-PLAN.md), including iOS and Android same-tab login/session restoration.
- [ ] Reconcile the central AuthGear callback URI across Ninja Connect broker configuration and the NinjaURL callback Worker before live end-to-end testing.
- [ ] Complete the Extension ↔ Worker integration matrix on identified commits.
- [ ] Review OAuth transaction cleanup and error preservation on all cancellation/failure paths.
- [ ] Review verifier, tokens, session secrets and logging boundaries before release.

### P1 — API and release readiness

- [ ] Confirm the public API/type surface with a package-consumer type test.
- [ ] Verify package contents and exports from the built tarball, not only source imports.
- [ ] **Provide the Web callback bridge as an official, reusable NinjaAuth SDK asset.** Start from the existing `auth-callback.html` in NinjaURL Dashboard, adapt it into a provider- and application-neutral page, and document how consumers obtain and host it. Preserve the current bridge contract (state plus success/error outcome only; no authorization codes, verifiers, tokens or cookies), and explicitly document/test its same-origin, opener and target-origin requirements. Do not make the Dashboard's branded page or its application-specific backend callback a dependency for external SDK consumers.
- [ ] Define release/tag/version policy and publish only after explicit approval.

### P2 — Future capabilities

- OIDC Discovery and additional provider interoperability behind the identity broker.
- Account linking, MFA, passkeys, device management and global logout.

Future capabilities are not prerequisites for the current NinjaURL documentation alignment.

## 6. Related repositories and boundaries

- [NinjaURL Workers](https://github.com/HanamiSoftware/NinjaURL-URL-Shortener)
- [NinjaURL Dashboard](https://github.com/HanamiSoftware/Ninja-URL-Dashboard)
- [NinjaURL Extension](https://github.com/HanamiSoftware/NinjaUrl-Extension)
- [Ninja Platform Data](https://github.com/HanamiSoftware/Ninja-Platform-Data)

The identity broker is an external dependency to this SDK repository. This roadmap does not authorize changes to the Ninja Connect repository, its configuration, migrations, secrets or deployment.
