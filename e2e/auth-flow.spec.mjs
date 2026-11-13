import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const APP_ORIGIN = "https://dashboard.ninjaurl.test";
const APP_URL = `${APP_ORIGIN}/`;
const API_ORIGIN = "https://api.ninjaurl.test";
const APP_CALLBACK = `${API_ORIGIN}/v1/auth/callback`;
const CENTRAL_CALLBACK = "https://auth.ninjaconnect.io/v1/callback";

const APP_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>NinjaAuth browser fixture</title></head>
<body>
  <button id="login" type="button">Sign in</button>
  <script type="module">
    import { NinjaAuth } from "/dist/index.js";

    window.__bridgeHadOpener = sessionStorage.getItem("ninja-auth-e2e-bridge-had-opener");
    const auth = new NinjaAuth();
    auth.init({
      clientId: "ninja-auth-e2e-client",
      redirectUri: "${APP_CALLBACK}",
      platform: "web",
      environment: "production"
    });
    window.__ninjaAuth = auth;
    window.__loginStatus = "idle";

    window.__initialSessionPromise = auth.getSession().then((session) => {
      window.__session = session;
      return session;
    }).catch((error) => {
      window.__sessionError = String(error);
      throw error;
    });

    document.querySelector("#login").addEventListener("click", () => {
      window.__loginStatus = "pending";
      auth.login().then((user) => {
        window.__loginStatus = "resolved";
        window.__loginUser = user;
      }).catch((error) => {
        window.__loginStatus = "rejected";
        window.__loginError = String(error);
      });
    });
  </script>
</body>
</html>`;

const BRIDGE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>NinjaAuth callback bridge</title></head>
<body>
  <script type="module">
    import { completeWebAuthCallback } from "/dist/index.js";
    sessionStorage.setItem("ninja-auth-e2e-bridge-had-opener", String(Boolean(window.opener)));
    completeWebAuthCallback();
  </script>
</body>
</html>`;

function redirectDocument(target) {
    const safeTarget = JSON.stringify(target).replace(/</g, "\\\\u003c");
    return `<!doctype html><html><body><script>window.location.replace(${safeTarget});</script></body></html>`;
}

async function installOAuthRoutes(context) {
    const transactions = [];
    const authorizationRequests = [];
    const backendCallbacks = [];
    const sessionRequests = [];
    const bundle = await readFile(new URL("../dist/index.js", import.meta.url), "utf8");

    await context.route(`${APP_ORIGIN}/**`, async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/" || url.pathname === "/index.html") {
            return route.fulfill({
                status: 200,
                contentType: "text/html; charset=utf-8",
                headers: { "cache-control": "no-store" },
                body: APP_HTML
            });
        }
        if (url.pathname === "/auth-callback.html") {
            return route.fulfill({
                status: 200,
                contentType: "text/html; charset=utf-8",
                headers: { "cache-control": "no-store" },
                body: BRIDGE_HTML
            });
        }
        if (url.pathname === "/dist/index.js") {
            return route.fulfill({
                status: 200,
                contentType: "text/javascript; charset=utf-8",
                headers: { "cache-control": "no-store" },
                body: bundle
            });
        }
        return route.fulfill({ status: 404, body: "Not found" });
    });

    await context.route("https://auth.ninjaconnect.io/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());

        if (url.pathname === "/v1/state" && request.method() === "OPTIONS") {
            return route.fulfill({
                status: 204,
                headers: {
                    "access-control-allow-origin": APP_ORIGIN,
                    "access-control-allow-methods": "POST, OPTIONS",
                    "access-control-allow-headers": "content-type",
                    "access-control-max-age": "600",
                    "vary": "Origin"
                }
            });
        }

        if (url.pathname === "/v1/state" && request.method() === "POST") {
            const body = request.postDataJSON();
            transactions.push(body);

            const authorizationUrl = new URL("https://auth.ninjaconnect.io/oauth2/authorize");
            authorizationUrl.searchParams.set("response_type", "code");
            authorizationUrl.searchParams.set("client_id", "ninja-connect-upstream-client");
            authorizationUrl.searchParams.set("redirect_uri", CENTRAL_CALLBACK);
            authorizationUrl.searchParams.set("scope", body.scope);
            authorizationUrl.searchParams.set("state", body.state);

            return route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "access-control-allow-origin": APP_ORIGIN,
                    "vary": "Origin",
                    "cache-control": "no-store"
                },
                body: JSON.stringify({
                    success: true,
                    data: {
                        clientId: "ninja-auth-e2e-client",
                        authorizationUrl: authorizationUrl.toString()
                    }
                })
            });
        }

        if (url.pathname === "/oauth2/authorize") {
            authorizationRequests.push(request.url());
            const state = url.searchParams.get("state");
            return route.fulfill({
                status: 200,
                contentType: "text/html; charset=utf-8",
                headers: { "cache-control": "no-store" },
                body: redirectDocument(
                    `https://auth.ninjaconnect.io/v1/callback?code=simulated-provider-code&state=${encodeURIComponent(state)}`
                )
            });
        }

        if (url.pathname === "/v1/callback") {
            const state = url.searchParams.get("state");
            return route.fulfill({
                status: 200,
                contentType: "text/html; charset=utf-8",
                headers: { "cache-control": "no-store" },
                body: redirectDocument(
                    `${APP_CALLBACK}?code=simulated-ninja-connect-app-code&state=${encodeURIComponent(state)}`
                )
            });
        }

        return route.fulfill({ status: 404, body: "Unexpected Ninja Connect request" });
    });

    await context.route(`${API_ORIGIN}/**`, async (route) => {
        const request = route.request();
        const url = new URL(request.url());

        if (url.pathname === "/v1/auth/callback" && request.isNavigationRequest()) {
            backendCallbacks.push({
                code: url.searchParams.get("code"),
                state: url.searchParams.get("state")
            });
            const state = url.searchParams.get("state");
            return route.fulfill({
                status: 200,
                contentType: "text/html; charset=utf-8",
                headers: {
                    // Host-only application session cookie, as set by the real backend.
                    "set-cookie": "ninja_session=e2e-session; Path=/; HttpOnly; Secure; SameSite=Strict",
                    "cache-control": "no-store"
                },
                body: redirectDocument(
                    `${APP_ORIGIN}/auth-callback.html?state=${encodeURIComponent(state)}&result=success`
                )
            });
        }

        if (url.pathname === "/v1/session" && request.method() === "GET") {
            const cookie = request.headers().cookie ?? "";
            sessionRequests.push(cookie);
            const cors = {
                "access-control-allow-origin": APP_ORIGIN,
                "access-control-allow-credentials": "true",
                "vary": "Origin",
                "cache-control": "no-store"
            };

            if (!cookie.includes("ninja_session=e2e-session")) {
                return route.fulfill({
                    status: 401,
                    contentType: "application/json",
                    headers: cors,
                    body: JSON.stringify({
                        success: false,
                        error: { code: "INVALID_SESSION" }
                    })
                });
            }

            return route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: cors,
                body: JSON.stringify({
                    success: true,
                    data: {
                        authenticated: true,
                        user: {
                            id: "e2e-user",
                            email: "browser-test@ninjaurl.test",
                            name: "Browser Test",
                            pictureUrl: null
                        },
                        session: {
                            expiresAt: "2035-01-01T00:00:00.000Z",
                            absoluteExpiresAt: "2035-01-02T00:00:00.000Z"
                        }
                    }
                })
            });
        }

        return route.fulfill({ status: 404, body: "Unexpected NinjaURL API request" });
    });

    return { transactions, authorizationRequests, backendCallbacks, sessionRequests };
}

async function expectSessionCookie(context, sessionRequests) {
    await expect.poll(() =>
        sessionRequests.some((cookie) => cookie.includes("ninja_session=e2e-session"))
    ).toBe(true);

    const cookies = await context.cookies(API_ORIGIN);
    const sessionCookie = cookies.find((cookie) => cookie.name === "ninja_session");
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie.domain).toBe("api.ninjaurl.test");
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.secure).toBe(true);
    expect(sessionCookie.sameSite).toBe("Strict");
}

test("desktop browser completes the popup bridge and reads the HttpOnly app session", async ({ page, context }) => {
    const flow = await installOAuthRoutes(context);
    await page.goto(APP_URL);
    await expect.poll(() => page.evaluate(() => window.__session?.authenticated)).toBe(false);

    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Sign in" }).click();
    const popup = await popupPromise;

    await expect.poll(() => page.evaluate(() => window.__loginStatus)).not.toBe("pending");
    const loginOutcome = await page.evaluate(() => ({
        status: window.__loginStatus,
        error: window.__loginError
    }));
    expect(loginOutcome.status, `SDK login failed: ${loginOutcome.error ?? "unknown error"}`).toBe("resolved");
    await expect.poll(() => popup.isClosed()).toBe(true);
    expect(await page.evaluate(() => window.__loginUser.id)).toBe("e2e-user");

    expect(flow.transactions).toHaveLength(1);
    expect(flow.transactions[0].client_id).toBe("ninja-auth-e2e-client");
    expect(flow.transactions[0].redirect_uri).toBe(APP_CALLBACK);
    expect(flow.transactions[0].code_verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(flow.authorizationRequests).toHaveLength(1);
    expect(flow.backendCallbacks[0].code).toBe("simulated-ninja-connect-app-code");
    await expectSessionCookie(context, flow.sessionRequests);
});

async function runMobileSameTab(browser, contextOptions, prepareContext) {
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        ...contextOptions
    });
    try {
        if (prepareContext) await prepareContext(context);
        const flow = await installOAuthRoutes(context);
        const page = await context.newPage();
        let popupOpened = false;
        page.on("popup", () => { popupOpened = true; });

        await page.goto(APP_URL);
        await expect.poll(() => page.evaluate(() => window.__session?.authenticated)).toBe(false);
        const returnedToApp = page.waitForEvent(
            "framenavigated",
            (frame) => frame === page.mainFrame() && frame.url() === APP_URL
        );
        await page.getByRole("button", { name: "Sign in" }).click();
        await returnedToApp;

        await expect.poll(() => flow.authorizationRequests.length).toBe(1);
        await expect(page).toHaveURL(APP_URL);
        await expect.poll(() => page.evaluate(() => window.__session?.authenticated)).toBe(true);

        expect(popupOpened).toBe(false);
        expect(await page.evaluate(() => window.__bridgeHadOpener)).toBe("false");
        expect(flow.transactions).toHaveLength(1);
        expect(flow.transactions[0].redirect_uri).toBe(APP_CALLBACK);
        expect(flow.backendCallbacks[0].code).toBe("simulated-ninja-connect-app-code");
        await expectSessionCookie(context, flow.sessionRequests);
    } finally {
        await context.close();
    }
}

test("iPhone browser uses same-tab navigation and restores the app session", async ({ browser }) => {
    await runMobileSameTab(browser, {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
    });
});

test("Android browser uses same-tab navigation and restores the app session", async ({ browser }) => {
    await runMobileSameTab(browser, {
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
    });
});

test("iPadOS Safari desktop mode uses same-tab navigation", async ({ browser }) => {
    await runMobileSameTab(
        browser,
        {
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
            viewport: { width: 1024, height: 768 },
            deviceScaleFactor: 2,
            isMobile: false,
            hasTouch: true
        },
        (context) => context.addInitScript(() => {
            Object.defineProperty(navigator, "platform", { configurable: true, get: () => "MacIntel" });
            Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 5 });
        })
    );
});
