// src/config.ts
var NINJA_CONNECT = {
  AUTHORIZATION_ENDPOINT: "https://auth.ninjaconnect.io",
  EXCHANGE_ENDPOINT: "https://auth.ninjaconnect.io/v1/exchange",
  DEFAULT_SCOPE: "openid profile email offline_access"
};

// src/oauth/authorization.ts
function buildAuthorizationUrl(request) {
  const url = new URL(
    "/oauth2/authorize",
    NINJA_CONNECT.AUTHORIZATION_ENDPOINT
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", request.clientId);
  url.searchParams.set("redirect_uri", request.redirectUri);
  url.searchParams.set("scope", request.scope);
  url.searchParams.set(
    "code_challenge",
    request.codeChallenge
  );
  url.searchParams.set(
    "code_challenge_method",
    "S256"
  );
  url.searchParams.set("state", request.state);
  return url;
}
function parseAuthorizationCallback(responseUrl) {
  const url = new URL(responseUrl);
  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description");
    throw new Error(
      description ? `NinjaAuth: ${error}: ${description}` : `NinjaAuth: ${error}`
    );
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    throw new Error(
      "NinjaAuth: authorization code is missing."
    );
  }
  if (!state) {
    throw new Error(
      "NinjaAuth: authorization state is missing."
    );
  }
  return {
    code,
    state
  };
}

// src/oauth/state.ts
function generateState(length = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/utils/pkce.ts
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...buffer)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = base64UrlEncode(
    new Uint8Array(digest)
  );
  return {
    verifier,
    challenge
  };
}

// src/platform/chrome/TransactionStorage.ts
var PREFIX = "oauth_";
var ChromeOAuthTransactionStorage = class {
  async save(state, transaction) {
    await chrome.storage.session.set({
      [`${PREFIX}${state}`]: transaction
    });
  }
  async get(state) {
    const key = `${PREFIX}${state}`;
    const result = await chrome.storage.session.get(key);
    return result[key] ?? null;
  }
  async remove(state) {
    await chrome.storage.session.remove(
      `${PREFIX}${state}`
    );
  }
};

// src/platform/chrome/AuthorizationLauncher.ts
var ChromeAuthorizationLauncher = class {
  launchAuthorization(url) {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url,
          interactive: true
        },
        (responseUrl) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(
              new Error(
                error.message || "NinjaAuth: authorization failed."
              )
            );
            return;
          }
          if (!responseUrl) {
            reject(
              new Error(
                "NinjaAuth: authorization failed: no callback URL."
              )
            );
            return;
          }
          resolve(responseUrl);
        }
      );
    });
  }
};

// src/NinjaAuth.ts
var VERSION = "0.1.0";
var BASE_URL = "http://127.0.0.1:8787/v1";
var NinjaAuthClient = class {
  constructor() {
    this.config = null;
    this.version = VERSION;
  }
  init(config) {
    const supportedPlatforms = config?.platform ?? "web";
    if (!config.clientId) {
      throw new Error(
        "NinjaAuth: clientId is required."
      );
    }
    if (!config.redirectUri) {
      throw new Error(
        "NinjaAuth: redirectUri is required."
      );
    }
    this.config = {
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      platform: supportedPlatforms
    };
  }
  async login() {
    if (!this.ensureInitialized()) {
      throw new Error(
        "NinjaAuth: call init() before login()."
      );
    }
    const { verifier, challenge } = await generatePKCE();
    const state = generateState();
    switch (this.config.platform) {
      case "extension":
        return this.createAuthFlow(new ChromeOAuthTransactionStorage(), new ChromeAuthorizationLauncher(), verifier, challenge, state);
      case "web":
        break;
    }
    return new Promise((resolve, reject) => {
    });
  }
  ensureInitialized() {
    if (!this.config) {
      return false;
    }
    return true;
  }
  async createAuthFlow(storage, authorize, verifier, challenge, state) {
    const authorizationUrl = buildAuthorizationUrl({
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      codeChallenge: challenge,
      state,
      scope: "openid profile email offline_access"
    });
    const transaction = {
      verifier,
      redirectUri: this.config.redirectUri,
      createdAt: Date.now()
    };
    await storage.save(state, transaction);
    const responseUrl = await authorize.launchAuthorization(authorizationUrl.toString());
    const callback = parseAuthorizationCallback(responseUrl);
    const returnedTransaction = await storage.get(callback.state);
    if (!returnedTransaction) {
      await storage.remove(callback.state);
      throw new Error(
        "NinjaAuth: no transaction found for state."
      );
    }
    try {
      const user = await this.exchangeCodeForToken(callback.code, returnedTransaction.verifier);
      return user;
    } finally {
      await storage.remove(callback.state);
    }
  }
  async exchangeCodeForToken(code, verifier) {
    const response = await fetch(
      `${BASE_URL}/exchange`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          code_verifier: verifier
        })
      }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "NinjaAuth: authentication exchange failed."
      );
    }
    return result.data.user;
  }
  async logout() {
  }
  async getSession() {
    if (!this.ensureInitialized()) {
      throw new Error(
        "NinjaAuth: call init() before getSession()."
      );
    }
    const response = await fetch(
      `${BASE_URL}/session`,
      {
        method: "GET",
        credentials: "include"
      }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "NinjaAuth: failed to retrieve session."
      );
    }
    return result.data;
  }
};
var NinjaAuth = new NinjaAuthClient();
export {
  NinjaAuth
};
//# sourceMappingURL=index.js.map