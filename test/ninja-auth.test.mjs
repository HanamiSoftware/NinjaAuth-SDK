import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;

const USER = {
    id: "user-123",
    email: "user@example.com",
    name: "Test User",
    pictureUrl: null
};

const AUTHENTICATED_SESSION = {
    authenticated: true,
    user: USER,
    session: {
        expiresAt: "2026-11-02T12:00:00.000Z",
        absoluteExpiresAt: "2026-11-09T12:00:00.000Z"
    }
};

let originalFetch;
let originalChrome;
let originalWindow;
let chromeMock;
let moduleSequence = 0;

function response(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

// Each test gets a fresh bundled module/runtime, so the singleton state from
// one test cannot leak into another test.
async function createClient() {
    const sdk = await import(
        "../dist/index.js?test=" + (++moduleSequence)
    );

    return {
        NinjaAuth: sdk.NinjaAuth,
        completeWebAuthCallback: sdk.completeWebAuthCallback,
        auth: new sdk.NinjaAuth()
    };
}

async function initialize(overrides = {}) {
    const client = await createClient();

    const result = client.auth.init({
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        environment: "development",
        ...overrides
    });

    assert.strictEqual(result, client.auth);
    return client;
}

function createChromeMock() {
    const transactions = new Map();

    return {
        transactions,
        identity: {
            launchWebAuthFlow: async ({ url }) => {
                const authorizationUrl = new URL(url);
                const callbackUrl = new URL(
                    authorizationUrl.searchParams.get("redirect_uri")
                );

                callbackUrl.searchParams.set("code", "authorization-code");
                callbackUrl.searchParams.set(
                    "state",
                    authorizationUrl.searchParams.get("state")
                );

                return callbackUrl.toString();
            }
        },
        storage: {
            session: {
                set: async (items) => {
                    for (const [key, value] of Object.entries(items)) {
                        transactions.set(key, value);
                    }
                },
                get: async (key) => ({
                    [key]: transactions.get(key)
                }),
                remove: async (key) => {
                    transactions.delete(key);
                }
            }
        }
    };
}

test.beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalChrome = globalThis.chrome;
    originalWindow = globalThis.window;
    chromeMock = createChromeMock();
    globalThis.chrome = chromeMock;
});

test.afterEach(() => {
    globalThis.fetch = originalFetch;

    if (originalChrome === undefined) {
        delete globalThis.chrome;
    } else {
        globalThis.chrome = originalChrome;
    }

    if (originalWindow === undefined) {
        delete globalThis.window;
    } else {
        globalThis.window = originalWindow;
    }
});

// Singleton and initialization contract

test("exports the NinjaAuth class and does not expose the old static init API", async () => {
    const { NinjaAuth } = await createClient();

    assert.equal(typeof NinjaAuth, "function");
    assert.equal(typeof NinjaAuth.init, "undefined");
    assert.equal(typeof NinjaAuth.prototype.init, "function");
    assert.equal(typeof NinjaAuth.prototype.login, "function");
    assert.equal(typeof NinjaAuth.prototype.getSession, "function");
    assert.equal(typeof NinjaAuth.prototype.logout, "function");
});

test("the public constructor returns the same singleton instance", async () => {
    const { NinjaAuth, auth } = await createClient();
    const second = new NinjaAuth();

    assert.strictEqual(second, auth);
    assert.ok(second instanceof NinjaAuth);
});

test("init returns this singleton instance", async () => {
    const { NinjaAuth, auth } = await createClient();

    const initialized = auth.init({
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        environment: "development"
    });

    assert.strictEqual(initialized, auth);
    assert.ok(initialized instanceof NinjaAuth);
});

test("init rejects a second initialization", async () => {
    const { auth } = await initialize();

    assert.throws(
        () => auth.init({
            clientId: "another-client",
            redirectUri: "https://example.com/another-callback"
        }),
        (error) => error.code === "INITIALIZATION"
    );
});

test("init rejects a missing clientId", async () => {
    const { auth } = await createClient();

    assert.throws(
        () => auth.init({
            clientId: "",
            redirectUri: "https://example.com/callback"
        }),
        (error) => error.code === "CONFIGURATION"
    );
});

test("init rejects a missing redirectUri", async () => {
    const { auth } = await createClient();

    assert.throws(
        () => auth.init({
            clientId: "test-client",
            redirectUri: ""
        }),
        (error) => error.code === "CONFIGURATION"
    );
});

test("init rejects an unsupported platform", async () => {
    const { auth } = await createClient();

    assert.throws(
        () => auth.init({
            clientId: "test-client",
            redirectUri: "https://example.com/callback",
            platform: "mobile"
        }),
        (error) => error.code === "CONFIGURATION"
    );
});

test("init rejects an unsupported environment", async () => {
    const { auth } = await createClient();

    assert.throws(
        () => auth.init({
            clientId: "test-client",
            redirectUri: "https://example.com/callback",
            environment: "staging"
        }),
        (error) => error.code === "CONFIGURATION"
    );
});

test("init defaults the environment to production", async () => {
    const { auth } = await createClient();

    auth.init({
        clientId: "test-client",
        redirectUri: "https://example.com/callback"
    });

    globalThis.fetch = async (url) => {
        assert.equal(url, "https://auth.ninjaconnect.io/v1/session");
        return response({
            success: true,
            data: {
                authenticated: false,
                user: null,
                session: null
            }
        });
    };

    await auth.getSession();
});

test("lifecycle methods reject calls before initialization", async () => {
    const { auth } = await createClient();

    await assert.rejects(
        auth.login(),
        (error) => error.code === "INITIALIZATION_FAILED"
    );
    await assert.rejects(
        auth.getSession(),
        (error) => error.code === "INITIALIZATION_FAILED"
    );
    await assert.rejects(
        auth.logout(),
        (error) => error.code === "INITIALIZATION_FAILED"
    );
});

test("web platform initialization and callback helper are supported", async () => {
    const { auth, completeWebAuthCallback } = await initialize({ platform: "web" });

    assert.equal(typeof auth.login, "function");
    assert.equal(typeof completeWebAuthCallback, "function");
});

test("a failed init validation leaves the singleton available for a valid init", async () => {
    const { auth } = await createClient();

    assert.throws(
        () => auth.init({
            clientId: "",
            redirectUri: "https://example.com/callback"
        }),
        (error) => error.code === "CONFIGURATION"
    );

    assert.strictEqual(
        auth.init({
            clientId: "test-client",
            redirectUri: "https://example.com/callback"
        }),
        auth
    );
});

test("platform defaults to extension", async () => {
    const { auth } = await createClient();
    let authorizationLaunches = 0;

    auth.init({
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        environment: "development"
    });

    chromeMock.identity.launchWebAuthFlow = async ({ url }) => {
        authorizationLaunches += 1;
        const authorizationUrl = new URL(url);
        const callbackUrl = new URL(
            authorizationUrl.searchParams.get("redirect_uri")
        );
        callbackUrl.searchParams.set("code", "authorization-code");
        callbackUrl.searchParams.set(
            "state",
            authorizationUrl.searchParams.get("state")
        );
        return callbackUrl.toString();
    };

    globalThis.fetch = async () => response({
        success: true,
        data: { user: USER }
    });

    assert.deepEqual(await auth.login(), USER);
    assert.equal(authorizationLaunches, 1);
});

// Session lookup contract

test("getSession returns an authenticated session and includes cookies", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async (url, options) => {
        assert.equal(url, "http://127.0.0.1:8787/v1/session");
        assert.equal(options.method, "GET");
        assert.equal(options.credentials, "include");

        return response({
            success: true,
            data: AUTHENTICATED_SESSION
        });
    };

    assert.deepEqual(await auth.getSession(), AUTHENTICATED_SESSION);
});

test("getSession accepts a valid anonymous 200 response", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: {
            authenticated: false,
            user: null,
            session: null
        }
    });

    assert.deepEqual(await auth.getSession(), {
        authenticated: false,
        user: null,
        session: null
    });
});

test("getSession maps explicit 401 INVALID_SESSION to anonymous", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "INVALID_SESSION" }
    }, 401);

    assert.deepEqual(await auth.getSession(), {
        authenticated: false,
        user: null,
        session: null
    });
});

test("getSession does not treat USER_NOT_FOUND as anonymous", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "USER_NOT_FOUND" }
    }, 401);

    await assert.rejects(
        auth.getSession(),
        (error) => error.code === "SESSION_FAILED"
    );
});

test("getSession preserves temporary service failures as errors", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "SESSION_REFRESH_UNAVAILABLE" }
    }, 503);

    await assert.rejects(
        auth.getSession(),
        (error) => error.code === "SESSION_FAILED"
    );
});

test("getSession classifies network failures", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => {
        throw new TypeError("Network unavailable");
    };

    await assert.rejects(
        auth.getSession(),
        (error) =>
            error.code === "NETWORK" &&
            error.originalError instanceof TypeError
    );
});

test("getSession rejects non-JSON responses", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => new Response("not-json", {
        status: 200
    });

    await assert.rejects(
        auth.getSession(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

test("getSession rejects malformed authenticated session data", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: {
            authenticated: true,
            user: USER,
            session: { expiresAt: "not-a-date" }
        }
    });

    await assert.rejects(
        auth.getSession(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

test("getSession rejects a malformed user profile", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: {
            authenticated: true,
            user: { id: 123, email: "bad" },
            session: AUTHENTICATED_SESSION.session
        }
    });

    await assert.rejects(
        auth.getSession(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

// Logout contract

test("logout confirms current-session logout and includes cookies", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async (url, options) => {
        assert.equal(url, "http://127.0.0.1:8787/v1/logout");
        assert.equal(options.method, "POST");
        assert.equal(options.credentials, "include");

        return response({
            success: true,
            data: { loggedOut: true }
        });
    };

    await assert.doesNotReject(auth.logout());
});

test("logout rejects an unconfirmed server response", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "LOGOUT_FAILED" }
    }, 500);

    await assert.rejects(
        auth.logout(),
        (error) => error.code === "LOGOUT_FAILED"
    );
});

test("logout rejects a success envelope without loggedOut confirmation", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: { loggedOut: false }
    });

    await assert.rejects(
        auth.logout(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

test("logout classifies network failures", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => {
        throw new TypeError("Network unavailable");
    };

    await assert.rejects(
        auth.logout(),
        (error) =>
            error.code === "NETWORK" &&
            error.originalError instanceof TypeError
    );
});

test("logout rejects non-JSON responses", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => new Response("not-json", {
        status: 200
    });

    await assert.rejects(
        auth.logout(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

// Authorization Code + PKCE flow

test("login completes PKCE authorization and exchanges the code", async () => {
    const { auth } = await initialize();

    let capturedAuthorizationUrl;

    chromeMock.identity.launchWebAuthFlow = async ({ url }) => {
        capturedAuthorizationUrl = new URL(url);
        const callbackUrl = new URL(
            capturedAuthorizationUrl.searchParams.get("redirect_uri")
        );

        callbackUrl.searchParams.set("code", "authorization-code");
        callbackUrl.searchParams.set(
            "state",
            capturedAuthorizationUrl.searchParams.get("state")
        );

        return callbackUrl.toString();
    };

    globalThis.fetch = async (url, options) => {
        assert.equal(url, "http://127.0.0.1:8787/v1/exchange");
        assert.equal(options.method, "POST");
        assert.equal(options.credentials, "include");
        assert.equal(options.headers["Content-Type"], "application/json");

        const body = JSON.parse(options.body);

        assert.equal(body.code, "authorization-code");
        assert.equal(body.client_id, "test-client");
        assert.equal(body.redirect_uri, "https://example.com/callback");
        assert.equal(
            body.state,
            capturedAuthorizationUrl.searchParams.get("state")
        );
        assert.match(body.state, /^[0-9a-f-]{36}$/i);
        assert.match(body.code_verifier, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(
            capturedAuthorizationUrl.searchParams.get("code_challenge_method"),
            "S256"
        );
        assert.ok(capturedAuthorizationUrl.searchParams.get("code_challenge"));
        assert.equal(
            capturedAuthorizationUrl.searchParams.get("client_id"),
            "test-client"
        );
        assert.equal(
            capturedAuthorizationUrl.searchParams.get("scope"),
            "openid profile email offline_access"
        );

        return response({
            success: true,
            data: { user: USER }
        });
    };

    assert.deepEqual(await auth.login(), USER);
    assert.equal(chromeMock.transactions.size, 0);
});

test("login rejects a callback with mismatched state and clears the transaction", async () => {
    const { auth } = await initialize();

    chromeMock.identity.launchWebAuthFlow = async ({ url }) => {
        const authorizationUrl = new URL(url);
        const callbackUrl = new URL(
            authorizationUrl.searchParams.get("redirect_uri")
        );

        callbackUrl.searchParams.set("code", "authorization-code");
        callbackUrl.searchParams.set("state", "attacker-controlled-state");

        return callbackUrl.toString();
    };

    globalThis.fetch = async () => {
        assert.fail("Exchange must not run after a state mismatch");
    };

    await assert.rejects(
        auth.login(),
        (error) => error.code === "STATE_MISMATCH"
    );
    assert.equal(chromeMock.transactions.size, 0);
});

test("login maps OAuth access_denied to OAUTH_DENIED and clears the transaction", async () => {
    const { auth } = await initialize();

    chromeMock.identity.launchWebAuthFlow = async ({ url }) => {
        const authorizationUrl = new URL(url);
        const callbackUrl = new URL(
            authorizationUrl.searchParams.get("redirect_uri")
        );

        callbackUrl.searchParams.set("error", "access_denied");
        callbackUrl.searchParams.set(
            "state",
            authorizationUrl.searchParams.get("state")
        );

        return callbackUrl.toString();
    };

    await assert.rejects(
        auth.login(),
        (error) => error.code === "OAUTH_DENIED"
    );
    assert.equal(chromeMock.transactions.size, 0);
});

test("login classifies authorization launcher failures", async () => {
    const { auth } = await initialize();

    chromeMock.identity.launchWebAuthFlow = async () => {
        throw new Error("User closed the authorization window");
    };

    await assert.rejects(
        auth.login(),
        (error) => error.code === "AUTHORIZATION_FAILED"
    );
    assert.equal(chromeMock.transactions.size, 0);
});

test("login rejects failed code exchange and still clears the transaction", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "INVALID_GRANT" }
    }, 400);

    await assert.rejects(
        auth.login(),
        (error) => error.code === "EXCHANGE_FAILED"
    );
    assert.equal(chromeMock.transactions.size, 0);
});

test("login classifies exchange network failures and clears the transaction", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => {
        throw new TypeError("Network unavailable");
    };

    await assert.rejects(
        auth.login(),
        (error) =>
            error.code === "NETWORK" &&
            error.originalError instanceof TypeError
    );
    assert.equal(chromeMock.transactions.size, 0);
});

test("login preserves the primary exchange error when transaction cleanup also fails", async () => {
    const { auth } = await initialize();

    chromeMock.storage.session.remove = async () => {
        throw new Error("Storage cleanup unavailable");
    };

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "INVALID_GRANT" }
    }, 400);

    await assert.rejects(
        auth.login(),
        (error) => error.code === "EXCHANGE_FAILED"
    );
});

test("login reports transaction cleanup failure after a successful exchange", async () => {
    const { auth } = await initialize();

    chromeMock.storage.session.remove = async () => {
        throw new Error("Storage cleanup unavailable");
    };

    globalThis.fetch = async () => response({
        success: true,
        data: { user: USER }
    });

    await assert.rejects(
        auth.login(),
        (error) =>
            error.code === "TRANSACTION_CLEANUP_FAILED" &&
            error.originalError?.message === "Storage cleanup unavailable"
    );
});

test("login rejects an exchange response with an invalid user profile", async () => {
    const { auth } = await initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: {
            user: {
                id: 123,
                email: "not-a-valid-profile"
            }
        }
    });

    await assert.rejects(
        auth.login(),
        (error) => error.code === "INVALID_RESPONSE"
    );
    assert.equal(chromeMock.transactions.size, 0);
});

// End-to-end SDK lifecycle using mocked Chrome and Worker boundaries

test("login, live session lookup, and logout complete in sequence", async () => {
    const { auth } = await initialize();
    const requests = [];

    globalThis.fetch = async (url, options) => {
        requests.push({ url, options });

        if (url.endsWith("/exchange")) {
            return response({
                success: true,
                data: { user: USER }
            });
        }

        if (url.endsWith("/session")) {
            return response({
                success: true,
                data: AUTHENTICATED_SESSION
            });
        }

        if (url.endsWith("/logout")) {
            return response({
                success: true,
                data: { loggedOut: true }
            });
        }

        assert.fail("Unexpected SDK request: " + url);
    };

    assert.deepEqual(await auth.login(), USER);
    assert.deepEqual(await auth.getSession(), AUTHENTICATED_SESSION);
    await auth.logout();

    assert.deepEqual(
        requests.map((request) => new URL(request.url).pathname),
        ["/v1/exchange", "/v1/session", "/v1/logout"]
    );
    assert.ok(requests.every(
        (request) => request.options.credentials === "include"
    ));
    assert.equal(chromeMock.transactions.size, 0);
});


function brokerAuthorizationUrl(state) {
    const url = new URL("https://auth.ninjaconnect.io/oauth2/authorize");
    url.searchParams.set("client_id", "shared-authgear-client");
    url.searchParams.set("redirect_uri", "https://auth.ninjaconnect.io/call");
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email offline_access");
    url.searchParams.set("code_challenge", "test-challenge");
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
}

function createWebWindowMock(options = {}) {
    const listeners = new Set();
    let lastAuthorizationUrl;
    const values = new Map();
    let openCount = 0;

    const windowMock = {
        location: {
            origin: "https://example.com",
            href: "https://example.com/"
        },
        sessionStorage: {
            setItem(key, value) { values.set(key, value); },
            getItem(key) { return values.get(key) ?? null; },
            removeItem(key) { values.delete(key); }
        },
        open() {
            openCount += 1;
            return options.blockPopup ? null : popup;
        },
        addEventListener(type, listener) {
            if (type === "message") listeners.add(listener);
        },
        removeEventListener(type, listener) {
            if (type === "message") listeners.delete(listener);
        },
        setInterval: globalThis.setInterval.bind(globalThis),
        clearInterval: globalThis.clearInterval.bind(globalThis),
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis)
    };

    const popup = {
        closed: false,
        location: {
            replace(url) {
                lastAuthorizationUrl = url;
                const authorizationUrl = new URL(url);
                const state = options.stateTransform
                    ? options.stateTransform(authorizationUrl.searchParams.get("state"))
                    : authorizationUrl.searchParams.get("state");

                queueMicrotask(() => {
                    for (const listener of listeners) {
                        listener({
                            source: popup,
                            origin: windowMock.location.origin,
                            data: {
                                type: "NINJA_AUTH_WEB_CALLBACK",
                                state,
                                success: options.callbackError ? false : true,
                                ...(options.callbackError ? { error: options.callbackError } : {})
                            }
                        });
                    }
                });
            }
        },
        close() { popup.closed = true; }
    };

    return {
        window: windowMock,
        popup,
        values,
        get openCount() { return openCount; },
        get authorizationUrl() { return lastAuthorizationUrl; }
    };
}

test("web login opens a popup synchronously and completes through the backend callback", async () => {
    const { auth } = await initialize({
        platform: "web",
        redirectUri: "https://api.example.com/v1/auth/callback"
    });
    const browser = createWebWindowMock();
    globalThis.window = browser.window;

    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({ url, options });
        if (url === "http://127.0.0.1:8787/v1/state") {
            const body = JSON.parse(options.body);
            assert.equal(options.method, "POST");
            assert.equal(options.credentials, "omit");
            assert.equal(body.client_id, "test-client");
            assert.equal(body.redirect_uri, "https://api.example.com/v1/auth/callback");
            assert.equal(body.scope, "openid profile email offline_access");
            assert.match(body.state, /^[0-9a-f-]{36}$/i);
            assert.match(body.code_verifier, /^[A-Za-z0-9_-]{43}$/);
            return response({
                success: true,
                data: {
                    clientId: "test-client",
                    authorizationUrl: brokerAuthorizationUrl(body.state),
                    expiresAt: Date.now() + 300000
                }
            });
        }
        if (url === "https://api.example.com/v1/session") {
            assert.equal(options.method, "GET");
            assert.equal(options.credentials, "include");
            return response({ success: true, data: AUTHENTICATED_SESSION });
        }
        assert.fail("Unexpected SDK request: " + url);
    };

    const loginPromise = auth.login();
    assert.equal(browser.openCount, 1);
    assert.deepEqual(await loginPromise, USER);
    assert.deepEqual(requests.map((item) => item.url), [
        "http://127.0.0.1:8787/v1/state",
        "https://api.example.com/v1/session"
    ]);
    const launchedUrl = new URL(browser.authorizationUrl);
    assert.equal(launchedUrl.origin, "https://auth.ninjaconnect.io");
    assert.equal(launchedUrl.pathname, "/oauth2/authorize");
    assert.equal(launchedUrl.searchParams.get("client_id"), "shared-authgear-client");
    assert.equal(launchedUrl.searchParams.get("redirect_uri"), "https://auth.ninjaconnect.io/call");
    assert.equal(browser.popup.closed, true);
    assert.equal(browser.values.size, 0);
});

test("web login resolves its client ID from the exact registered callback when omitted", async () => {
    const { auth } = await initialize({
        clientId: undefined,
        platform: "web",
        redirectUri: "https://api.example.com/v1/auth/callback"
    });
    const browser = createWebWindowMock();
    globalThis.window = browser.window;
    let stateBody;

    globalThis.fetch = async (url, options) => {
        if (url === "http://127.0.0.1:8787/v1/state") {
            stateBody = JSON.parse(options.body);
            return response({
                success: true,
                data: {
                    clientId: "resolved-client",
                    authorizationUrl: brokerAuthorizationUrl(stateBody.state)
                }
            });
        }
        if (url === "https://api.example.com/v1/session") {
            return response({ success: true, data: AUTHENTICATED_SESSION });
        }
        assert.fail("Unexpected SDK request: " + url);
    };

    assert.deepEqual(await auth.login(), USER);
    assert.equal(Object.hasOwn(stateBody, "client_id"), false);
    assert.equal(browser.popup.closed, true);
});

test("web login rejects callback state mismatch after registering the server transaction", async () => {
    const { auth } = await initialize({
        platform: "web",
        redirectUri: "https://api.example.com/v1/auth/callback"
    });
    const browser = createWebWindowMock({
        stateTransform: () => "attacker-controlled-state"
    });
    globalThis.window = browser.window;
    let stateRequests = 0;

    globalThis.fetch = async (url) => {
        stateRequests += 1;
        assert.equal(url, "http://127.0.0.1:8787/v1/state");
        const body = JSON.parse(arguments[1].body);
        return response({
            success: true,
            data: {
                clientId: "test-client",
                authorizationUrl: brokerAuthorizationUrl(body.state)
            }
        });
    };

    await assert.rejects(
        auth.login(),
        (error) => error.code === "STATE_MISMATCH"
    );

    assert.equal(stateRequests, 1);
    assert.equal(browser.popup.closed, true);
    assert.equal(browser.values.size, 0);
});

test("web login reports a blocked popup", async () => {
    const { auth } = await initialize({ platform: "web" });
    const browser = createWebWindowMock({ blockPopup: true });
    globalThis.window = browser.window;

    await assert.rejects(
        auth.login(),
        (error) => error.code === "AUTHORIZATION_FAILED"
    );

    assert.equal(browser.openCount, 1);
    assert.equal(browser.values.size, 0);
});

test("web callback bridge posts only state and outcome, never code or tokens", async () => {
    const { completeWebAuthCallback } = await createClient();
    let postedMessage;
    let targetOrigin;
    let replacedUrl;
    let closed = false;

    globalThis.window = {
        location: {
            origin: "https://example.com",
            href: "https://example.com/auth-callback.html?state=123e4567-e89b-12d3-a456-426614174000&result=success&code=must-not-be-forwarded"
        },
        history: {
            replaceState(_state, _title, url) {
                replacedUrl = url;
            }
        },
        opener: {
            postMessage(message, origin) {
                postedMessage = message;
                targetOrigin = origin;
            }
        },
        close() {
            closed = true;
        }
    };

    completeWebAuthCallback();

    assert.deepEqual(postedMessage, {
        type: "NINJA_AUTH_WEB_CALLBACK",
        state: "123e4567-e89b-12d3-a456-426614174000",
        success: true
    });
    assert.equal(targetOrigin, "https://example.com");
    for (const key of ["code", "state", "result", "error"]) {
        assert.equal(new URL(replacedUrl).searchParams.has(key), false);
    }
    assert.equal(closed, true);
});

test("web callback bridge forwards a generic error without forwarding provider details", async () => {
    const { completeWebAuthCallback } = await createClient();
    let postedMessage;

    globalThis.window = {
        location: {
            origin: "https://example.com",
            href: "https://example.com/auth-callback.html?state=123e4567-e89b-12d3-a456-426614174000&result=error&error=access_denied"
        },
        history: {
            replaceState() {}
        },
        opener: {
            postMessage(message) {
                postedMessage = message;
            }
        },
        close() {}
    };

    completeWebAuthCallback();

    assert.deepEqual(postedMessage, {
        type: "NINJA_AUTH_WEB_CALLBACK",
        state: "123e4567-e89b-12d3-a456-426614174000",
        error: "access_denied"
    });
});
