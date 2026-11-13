# NinjaAuth — Test Plan

This plan separates deterministic SDK and Worker tests from real-browser/provider checks. Passing mocks does not prove cookie, CORS, popup, or upstream-provider behavior.

## 1. SDK automated tests

File: test/ninja-auth.test.mjs  
Runner: Node.js built-in test runner.

Coverage includes:
- public constructor/singleton and one-shot initialization;
- Chrome Extension PKCE, state validation, exchange response validation, and cleanup;
- Web desktop popup opened synchronously before asynchronous work;
- Web mobile same-tab redirect to the broker-provided authorization URL, without opening a popup;
- mobile detection for iPhone/Android and iPadOS Safari desktop mode;
- Web POST /v1/state request with client ID, exact backend callback, state, and verifier;
- Web callback outcome accepted only from the popup and the opener's exact origin;
- state mismatch rejected before session lookup;
- Web success reads the application session endpoint with credentials;
- popup blocked/closed and provider cancellation/error paths;
- callback bridge sends only state and outcome; authorization code, verifier, tokens, and cookie are never posted;
- same-tab callback bridge handles a missing opener, scrubs callback parameters, and returns to the application origin;
- session observation and logout contracts for both platform endpoint families;
- malformed responses, network failures, and operational errors remain errors.

Required commands on the exact branch commit:

    npm run typecheck
    npm run build
    npm test

Record the commit SHA and complete output. Do not mark the suite green until all three commands finish successfully.

## 2. Auth Worker transaction-store tests

File: Workers/auth-worker/test/oauth-transaction-store.test.ts

The Cloudflare Worker test environment must verify:
- a valid PKCE transaction can be stored;
- two concurrent consume requests produce exactly one success and one 410;
- already-expired transactions are rejected;
- the oauth-state-v1 Durable Object migration is present in the test configuration.

The integration contract still needs tests for POST /v1/state registry validation, the internal-secret gate, AuthGear token exchange, and the cancel path.

## 3. Web browser integration matrix

Run from the real Dashboard HTTPS origin using the exact callback registered for the Web client.

| ID | Scenario | Expected result |
|---|---|---|
| WEB-01 | Login initiated from a user click | Blank popup opens synchronously before PKCE/state network work |
| WEB-02 | State registration | Browser posts verifier only to Ninja Connect /v1/state; response is no-store |
| WEB-03 | Client/callback mismatch | Ninja Connect rejects the transaction before opening provider authorization |
| WEB-04 | Successful provider login | AuthGear redirects code/state directly to api.ninjaurl.io; parent never receives code |
| WEB-05 | Server exchange | NinjaURL backend calls the protected Ninja Connect endpoint; verifier is retrieved server-side |
| WEB-06 | Session creation | NinjaURL persists its session and sets host-only HttpOnly cookie on api.ninjaurl.io |
| WEB-07 | Popup bridge | API callback redirects to Dashboard bridge; bridge posts only state/outcome to opener |
| WEB-08 | State mismatch | SDK rejects the callback and does not read an authenticated session |
| WEB-09 | Provider cancellation | Transaction is consumed through the cancel endpoint and the bridge reports a generic error |
| WEB-10 | Popup blocked/closed | SDK rejects clearly and closes/cleans up its popup |
| WEB-11 | Opener preservation | window.opener survives the AuthGear → API callback → Dashboard bridge round-trip |
| WEB-12 | Credentialed session lookup | SDK calls https://api.ninjaurl.io/v1/session; browser sends the NinjaURL cookie |
| WEB-13 | Logout | SDK calls the NinjaURL API /v1/logout; cookie is cleared and session revoked |
| WEB-14 | Replay | A second internal exchange for the same state is rejected |
| WEB-15 | Mobile launch | iPhone/Android/iPadOS use same-tab navigation to the Ninja Connect authorization endpoint; no popup is opened and the /v1/state PKCE contract is unchanged |
| WEB-16 | Mobile callback | Bridge works without window.opener, removes callback parameters, and returns to the application origin |
| WEB-17 | Mobile session restore | After the app reloads, NinjaAuth is initialized again and getSession() observes the application cookie |

WEB-11 through WEB-14 require real browser/Worker testing. WEB-15 through WEB-17 require real mobile browser testing (iOS Safari/Chrome and Android Chrome) in addition to SDK mocks. SDK mocks do not prove browser navigation, cookie, or session behavior.

## 4. Cookie and CORS checks

- [ ] Cookie is set only by a response from api.ninjaurl.io.
- [ ] Cookie has no Domain attribute; it is host-only.
- [ ] Cookie attributes are HttpOnly; Secure; SameSite=Strict; Path=/.
- [ ] Dashboard requests to api.ninjaurl.io use credentials: include.
- [ ] API CORS allows the exact Dashboard origin and credentials.
- [ ] Auth Worker CORS allows the exact Dashboard origin for POST /v1/state.
- [ ] Browser accepts the cookie on the top-level backend callback response and sends it on subsequent same-site cross-origin API requests.
- [ ] SDK JavaScript cannot read the cookie.
- [ ] No code, verifier, access token, refresh token, or raw session secret appears in URLs, logs, local/session storage, or popup messages.

## 5. Operational prerequisites

- [ ] Apply the internal OAuth client registry migration from Ninja Platform Data PR #17 before testing /v1/state.
- [ ] Register the exact callback https://api.ninjaurl.io/v1/auth/callback for the NinjaURL Web client in the internal registry and upstream OAuth provider.
- [ ] Deploy the Auth Worker OAUTH_TRANSACTIONS Durable Object binding and oauth-state-v1 migration.
- [ ] Configure the same high-entropy NINJAURL_EXCHANGE_SECRET as a Worker secret on both Auth Worker and NinjaURL create-worker.
- [ ] Verify the API Worker route api.ninjaurl.io/v1/* serves /v1/auth/callback, /v1/session, and /v1/logout.
- [ ] Verify Dashboard hosts /auth-callback.html at the same origin as the opener.
- [ ] Confirm effective COOP/COEP response headers do not sever the popup opener.
- [ ] Verify iOS Safari/Chrome and Android Chrome complete the same-tab flow and restore the app session after the callback bridge returns to the application origin.

## 6. Evidence record

For every run, record:
- repository, branch, and exact commit SHA for SDK, Worker, and Dashboard;
- browser/version and test profile;
- environment and exact origin;
- test ID/command, expected result, and actual result;
- sanitized console/network evidence.

Never include cookie values, authorization codes, PKCE verifiers, access/refresh tokens, or shared secrets in test evidence.
