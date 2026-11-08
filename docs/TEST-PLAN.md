# NinjaAuth â€” Test Plan (dev)

This plan separates deterministic SDK regression tests from real Chrome/Worker integration checks. A passing mock suite does not prove cookie, CORS, browser, or provider behavior.

## 1. Automated SDK suite

File: `test/ninja-auth.test.mjs`  
Runner: Node.js built-in test runner  
Current coverage: 37 top-level cases.

The suite imports the built SDK entry point with a fresh module identity for each case. This isolates the runtime singleton between tests while preserving the real constructor behavior within each case.

| Area | Assertions |
|---|---|
| Public API | Named class export; no old static init; constructor returns same instance |
| Initialization | init returns this; second init rejected; missing/invalid config rejected |
| Lifecycle guards | login/getSession/logout before init rejected |
| Platform | web login explicitly unsupported |
| Session | authenticated and anonymous payloads; only 401 INVALID_SESSION becomes anonymous |
| Session failures | USER_NOT_FOUND, refresh unavailable, network, malformed JSON and invalid payload remain errors |
| Logout | credentialed current-session request; requires data.loggedOut === true; network and malformed confirmation rejected |
| OAuth | Authorization Code + PKCE S256; state and verifier format; callback state validation; access_denied |
| Exchange | correct request body, endpoint and credentials; exchange errors and network failures |
| Cleanup | transaction removed; primary failure preserved; cleanup failure after successful exchange is reported |
| Lifecycle | mocked login â†’ getSession â†’ logout sequence |

### Required local execution

Run on the exact SDK dev commit:

```bash
npm run typecheck
npm run build
npm test
```

Record the commit SHA and complete output. Do not mark the suite green until all three commands finish successfully.

### Verified CI evidence â€” 4 November 2026

- Repository: `HanamiSoftware/NinjaAuth-SDK`
- Branch: `dev`
- Commit: `a8e79dceea72cbc8c2b0c69f897ec42c9e0ce9d4`
- Workflow: `SDK CI`, run [#25](https://github.com/HanamiSoftware/NinjaAuth-SDK/actions/runs/41863128345)
- Event: `push` (the commit itself adds `workflow_dispatch` for future manual runs)
- Result: completed / success
- Steps: `npm ci`, `npm run typecheck`, `npm run build`, `npm test` â€” all successful
- Test summary: 37 passed, 0 failed, 0 skipped

This verifies the SDK checks on `dev`. It does not replace the Chrome/Worker integration matrix below and does not prove cookie, CORS, provider, or live browser behavior.

## 2. Chrome Extension integration matrix

Run with the Extension dev branch and the intended local or production Auth Worker environment.

| ID | Scenario | Expected result |
|---|---|---|
| CH-01 | Fresh install, no cached user, no server session | Restore resolves anonymous; no user is written to local storage |
| CH-02 | Fresh install, no cached user, valid server session | SDK getSession resolves authenticated; user is cached |
| CH-03 | Cached user exists at startup | UI restores immediately; result has session null; no session request is made in the cache-hit path |
| CH-04 | Cached user removed, valid server cookie remains | Restore calls getSession and repopulates local user |
| CH-05 | Cached user exists, server is temporarily unavailable | Cache is not silently deleted; error remains observable; protected action must not proceed |
| CH-06 | No cache and server returns INVALID_SESSION | Restore resolves anonymous |
| CH-07 | No cache and server returns temporary/operational error | Error is not converted into anonymous state |
| CH-08 | Login succeeds | OAuth completes; SDK session is authenticated; local user is saved; UI receives USER_UPDATED |
| CH-09 | User cancels authorization | Login cancellation is reported; no authenticated cache is written |
| CH-10 | Logout succeeds | Server confirms current-session logout; local user is removed; UI receives anonymous USER_UPDATED |
| CH-11 | Logout fails on server/network | Local cache is not cleared as if logout had succeeded |
| CH-12 | Login after successful logout | A new interactive login can create a new session |
| CH-13 | Service Worker restarts | A new runtime instance initializes correctly and resolves session from cache/server |
| CH-14 | Protected operation with cache-only result | Operation first obtains a live session; session null is never treated as authorization |

## 3. Cookie and CORS checks

These require a real browser and Worker; mocks are insufficient.

- [ ] Session cookie is HttpOnly and has the intended Secure/SameSite/Path/Domain attributes.
- [ ] JavaScript cannot read the session cookie.
- [ ] Exchange, session, and logout requests send credentials.
- [ ] Worker CORS allows the exact Chrome Extension origin and credentialed requests.
- [ ] Browser accepts and retains the cookie after exchange.
- [ ] Session lookup observes the cookie after page/Service Worker restart.
- [ ] Logout clears/revokes the current session and the browser drops the cookie.
- [ ] No raw session secret, access token, refresh token, or PKCE verifier is persisted in `chrome.storage.local`.

## 4. Failure and security review

- [ ] State mismatch prevents code exchange.
- [ ] OAuth denial does not create an authenticated session.
- [ ] Invalid/malformed exchange response is rejected.
- [ ] Temporary session refresh failure remains an error.
- [ ] Cache restoration is treated as UI state only.
- [ ] Every protected operation requires a live server-side session check.
- [ ] A stale cache is not sufficient to authorize a protected operation.
- [ ] Logout failure does not falsely report local logout completion.

## 5. Evidence record

For each execution, record:

- Repository and branch.
- Exact commit SHA for SDK, Extension, and Worker.
- Browser version and test profile.
- Environment and origin.
- Test ID or command.
- Expected and actual result.
- Relevant sanitized console/network evidence.

Never include cookie values, authorization codes, PKCE verifiers, access/refresh tokens, or other secrets in the evidence.
