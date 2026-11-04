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
    const { NinjaAuth } = await import(
        "../dist/index.js?test=" + (++moduleSequence)
    );

    return {
        NinjaAuth,
        auth: new NinjaAuth()
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

test("init returns the singleton instance", async () => {
    const { auth } = await initialize();

    assert.strictEqual(auth.init, auth.init);
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

test("init defaults platform to extension and environment to production", async () => {
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

test("login explicitly rejects the not-yet-supported web platform", async () => {
    const { auth } = await initialize({ platform: "web" });

    await assert.rejects(
        auth.login(),
        (error) => error.code === "UNSUPPORTED_PLATFORM"
    );
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
