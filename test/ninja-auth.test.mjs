import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import { NinjaAuth } from "../dist/index.js";

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

function response(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function initialize(overrides = {}) {
    NinjaAuth.init({
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        environment: "development",
        ...overrides
    });
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

test("init rejects a missing clientId", () => {
    assert.throws(
        () => NinjaAuth.init({
            clientId: "",
            redirectUri: "https://example.com/callback"
        }),
        (error) => error.code === "CONFIGURATION"
    );
});

test("login explicitly rejects the not-yet-supported web platform", async () => {
    initialize({ platform: "web" });

    await assert.rejects(
        NinjaAuth.login(),
        (error) => error.code === "UNSUPPORTED_PLATFORM"
    );
});

test("getSession returns an authenticated session and includes cookies", async () => {
    initialize();

    globalThis.fetch = async (url, options) => {
        assert.equal(
            url,
            "http://127.0.0.1:8787/v1/session"
        );
        assert.equal(options.method, "GET");
        assert.equal(options.credentials, "include");
        return response({
            success: true,
            data: AUTHENTICATED_SESSION
        });
    };

    assert.deepEqual(
        await NinjaAuth.getSession(),
        AUTHENTICATED_SESSION
    );
});

test("getSession maps only INVALID_SESSION to an anonymous session", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "INVALID_SESSION" }
    }, 401);

    assert.deepEqual(
        await NinjaAuth.getSession(),
        {
            authenticated: false,
            user: null,
            session: null
        }
    );
});

test("getSession does not treat USER_NOT_FOUND as an anonymous session", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "USER_NOT_FOUND" }
    }, 401);

    await assert.rejects(
        NinjaAuth.getSession(),
        (error) => error.code === "SESSION_FAILED"
    );
});

test("getSession preserves temporary service failures as errors", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "SESSION_REFRESH_UNAVAILABLE" }
    }, 503);

    await assert.rejects(
        NinjaAuth.getSession(),
        (error) => error.code === "SESSION_FAILED"
    );
});

test("getSession classifies network failures", async () => {
    initialize();

    globalThis.fetch = async () => {
        throw new TypeError("Network unavailable");
    };

    await assert.rejects(
        NinjaAuth.getSession(),
        (error) =>
            error.code === "NETWORK" &&
            error.originalError instanceof TypeError
    );
});

test("logout confirms current-session logout and includes cookies", async () => {
    initialize();

    globalThis.fetch = async (url, options) => {
        assert.equal(
            url,
            "http://127.0.0.1:8787/v1/logout"
        );
        assert.equal(options.method, "POST");
        assert.equal(options.credentials, "include");
        return response({
            success: true,
            data: { loggedOut: true }
        });
    };

    await assert.doesNotReject(NinjaAuth.logout());
});

test("logout rejects an unconfirmed server response", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "LOGOUT_FAILED" }
    }, 500);

    await assert.rejects(
        NinjaAuth.logout(),
        (error) => error.code === "LOGOUT_FAILED"
    );
});

test("logout classifies network failures", async () => {
    initialize();

    globalThis.fetch = async () => {
        throw new TypeError("Network unavailable");
    };

    await assert.rejects(
        NinjaAuth.logout(),
        (error) =>
            error.code === "NETWORK" &&
            error.originalError instanceof TypeError
    );
});

test("login completes the PKCE authorization and exchange flow", async () => {
    initialize();

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
        assert.equal(
            url,
            "http://127.0.0.1:8787/v1/exchange"
        );
        assert.equal(options.method, "POST");
        assert.equal(options.credentials, "include");
        assert.equal(
            options.headers["Content-Type"],
            "application/json"
        );

        const body = JSON.parse(options.body);
        assert.equal(body.code, "authorization-code");
        assert.equal(body.client_id, "test-client");
        assert.equal(
            body.redirect_uri,
            "https://example.com/callback"
        );
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
        assert.ok(
            capturedAuthorizationUrl.searchParams.get("code_challenge")
        );
        assert.equal(
            capturedAuthorizationUrl.searchParams.get("client_id"),
            "test-client"
        );

        return response({
            success: true,
            data: { user: USER }
        });
    };

    assert.deepEqual(await NinjaAuth.login(), USER);
    assert.equal(chromeMock.transactions.size, 0);
});

test("login rejects a callback with a mismatched state and clears its transaction", async () => {
    initialize();

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
        NinjaAuth.login(),
        (error) => error.code === "STATE_MISMATCH"
    );
    assert.equal(chromeMock.transactions.size, 0);
});

test("login maps an OAuth access_denied callback to OAUTH_DENIED", async () => {
    initialize();

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
        NinjaAuth.login(),
        (error) => error.code === "OAUTH_DENIED"
    );
    assert.equal(chromeMock.transactions.size, 0);
});


test("getSession accepts the Worker 200 anonymous-session payload", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: {
            authenticated: false,
            user: null,
            session: null
        }
    });

    assert.deepEqual(
        await NinjaAuth.getSession(),
        {
            authenticated: false,
            user: null,
            session: null
        }
    );
});

test("getSession rejects non-JSON responses", async () => {
    initialize();

    globalThis.fetch = async () => new Response("not-json", {
        status: 200
    });

    await assert.rejects(
        NinjaAuth.getSession(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

test("getSession rejects malformed authenticated session data", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: {
            authenticated: true,
            user: USER,
            session: { expiresAt: "not-a-date" }
        }
    });

    await assert.rejects(
        NinjaAuth.getSession(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

test("logout rejects a success envelope without loggedOut confirmation", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: true,
        data: { loggedOut: false }
    });

    await assert.rejects(
        NinjaAuth.logout(),
        (error) => error.code === "INVALID_RESPONSE"
    );
});

test("login rejects a failed exchange and still clears the transaction", async () => {
    initialize();

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "INVALID_GRANT" }
    }, 400);

    await assert.rejects(
        NinjaAuth.login(),
        (error) => error.code === "EXCHANGE_FAILED"
    );
    assert.equal(chromeMock.transactions.size, 0);
});


test("login preserves the exchange error when transaction cleanup also fails", async () => {
    initialize();

    chromeMock.storage.session.remove = async () => {
        throw new Error("Storage cleanup unavailable");
    };

    globalThis.fetch = async () => response({
        success: false,
        error: { code: "INVALID_GRANT" }
    }, 400);

    await assert.rejects(
        NinjaAuth.login(),
        (error) => error.code === "EXCHANGE_FAILED"
    );
});

test("login reports transaction cleanup failure after a successful exchange", async () => {
    initialize();

    chromeMock.storage.session.remove = async () => {
        throw new Error("Storage cleanup unavailable");
    };

    globalThis.fetch = async () => response({
        success: true,
        data: { user: USER }
    });

    await assert.rejects(
        NinjaAuth.login(),
        (error) =>
            error.code === "TRANSACTION_CLEANUP_FAILED" &&
            error.originalError?.message === "Storage cleanup unavailable"
    );
});
