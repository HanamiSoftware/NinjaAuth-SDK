// src/config.ts
var NINJA_CONNECT = {
  AUTHORIZATION_ENDPOINT: "https://auth.ninjaconnect.io",
  API_BASE_URLS: {
    development: "http://127.0.0.1:8787/v1",
    production: "https://auth.ninjaconnect.io/v1"
  },
  API_PATHS: {
    EXCHANGE: "/exchange",
    SESSION: "/session",
    LOGOUT: "/logout"
  },
  DEFAULT_SCOPE: "openid profile email offline_access"
};
function getNinjaConnectEndpoints(environment) {
  const baseUrl = NINJA_CONNECT.API_BASE_URLS[environment];
  return {
    exchange: `${baseUrl}${NINJA_CONNECT.API_PATHS.EXCHANGE}`,
    session: `${baseUrl}${NINJA_CONNECT.API_PATHS.SESSION}`,
    logout: `${baseUrl}${NINJA_CONNECT.API_PATHS.LOGOUT}`
  };
}

// src/errors/NinjaAuthError.ts
var NinjaAuthInternalError = class _NinjaAuthInternalError extends Error {
  constructor(code, message, originalError) {
    super(message);
    this.name = "NinjaAuthInternalError";
    this.code = code;
    this.originalError = originalError;
    Object.setPrototypeOf(
      this,
      _NinjaAuthInternalError.prototype
    );
  }
};

// src/errors/ErrorHandler.ts
function NinjaAuthErrorException(code, message, error) {
  if (error instanceof NinjaAuthInternalError) {
    return error;
  }
  return new NinjaAuthInternalError(
    code,
    message,
    error
  );
}

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
  let url;
  try {
    url = new URL(responseUrl);
  } catch (error2) {
    throw NinjaAuthErrorException(
      "INVALID_CALLBACK",
      "L'indirizzo di risposta dell'autorizzazione non \xE8 valido.",
      error2
    );
  }
  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description");
    if (error === "access_denied") {
      throw NinjaAuthErrorException(
        "OAUTH_DENIED",
        "L'autorizzazione \xE8 stata negata.",
        error
      );
    }
    throw NinjaAuthErrorException(
      "OAUTH_PROVIDER_ERROR",
      description ? `Il provider di autenticazione ha restituito un errore: ${description}` : `Il provider di autenticazione ha restituito un errore: ${error}`
    );
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    throw NinjaAuthErrorException(
      "INVALID_CALLBACK",
      "Il codice di autorizzazione non \xE8 presente nella risposta.",
      error
    );
  }
  if (!state) {
    throw NinjaAuthErrorException(
      "INVALID_CALLBACK",
      "Lo state non \xE8 presente nella risposta di autorizzazione.",
      error
    );
  }
  return {
    code,
    state
  };
}

// src/oauth/state.ts
function generateState() {
  return crypto.randomUUID();
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
  async launchAuthorization(url) {
    try {
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url,
        interactive: true
      });
      if (!responseUrl) {
        throw NinjaAuthErrorException(
          "AUTHORIZATION_FAILED",
          "Chrome non ha restituito l'indirizzo di risposta."
        );
      }
      return responseUrl;
    } catch (error) {
      throw NinjaAuthErrorException(
        "AUTHORIZATION_FAILED",
        "Non \uFFFD stato possibile completare l'autorizzazione.",
        error
      );
    }
  }
};

// src/NinjaAuth.ts
var VERSION = "0.1.0";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNinjaUser(value) {
  return isRecord(value) && typeof value.id === "string" && (typeof value.email === "string" || value.email === null) && (typeof value.name === "string" || value.name === null) && (typeof value.pictureUrl === "string" || value.pictureUrl === null);
}
function isNinjaSessionInfo(value) {
  return isRecord(value) && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt)) && typeof value.absoluteExpiresAt === "string" && Number.isFinite(Date.parse(value.absoluteExpiresAt));
}
function isNinjaSession(value) {
  if (!isRecord(value) || typeof value.authenticated !== "boolean") {
    return false;
  }
  if (value.authenticated) {
    return isNinjaUser(value.user) && isNinjaSessionInfo(value.session);
  }
  return value.user === null && value.session === null;
}
var _NinjaAuth = class _NinjaAuth {
  constructor() {
    this.config = null;
    this.version = VERSION;
    if (_NinjaAuth.instance) {
      return _NinjaAuth.instance;
    }
    _NinjaAuth.instance = this;
  }
  /**
   * initialize the NinjaAuth instance with the provided configuration.
   * @param config - The configuration object for initializing the NinjaAuth instance.
   * @param config.clientId - The client ID for the application.
   * @param config.redirectUri - The redirect URI for the application.
   * @param config.platform - The platform type, either "extension" or "web". Defaults to "extension".
   * @param config.environment - The environment type, either "development" or "production". Defaults to "production".
   * @param config.scopes - An optional array of scopes for the authentication request.
   * @returns The initialized NinjaAuth instance.
   */
  init(config) {
    if (this.config !== null) {
      throw NinjaAuthErrorException(
        "INITIALIZATION",
        "NinjaAuth: SDK has already been initialized."
      );
    }
    const supportedPlatforms = config.platform ?? "extension";
    if (supportedPlatforms !== "extension" && supportedPlatforms !== "web") {
      throw NinjaAuthErrorException(
        "CONFIGURATION",
        "NinjaAuth: platform must be 'extension' or 'web'."
      );
    }
    if (!config.clientId) {
      throw NinjaAuthErrorException(
        "CONFIGURATION",
        "NinjaAuth: clientId is required."
      );
    }
    if (!config.redirectUri) {
      throw NinjaAuthErrorException(
        "CONFIGURATION",
        "NinjaAuth: redirectUri is required."
      );
    }
    const environment = config.environment ?? "production";
    if (environment !== "development" && environment !== "production") {
      throw NinjaAuthErrorException(
        "CONFIGURATION",
        "NinjaAuth: environment must be 'development' or 'production'."
      );
    }
    const defaultScopes = NINJA_CONNECT.DEFAULT_SCOPE.split(" ");
    const scopes = config.scopes ?? defaultScopes;
    const mergedScopes = Array.from(/* @__PURE__ */ new Set([...defaultScopes, ...scopes]));
    this.config = {
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      platform: supportedPlatforms,
      environment,
      scopes: mergedScopes
    };
    return this;
  }
  /**
   * login initiates the authentication flow for the user. It generates a PKCE challenge and state, constructs the authorization URL, and launches the authorization flow. Upon successful authentication, it exchanges the authorization code for an access token and retrieves the user's profile information.
   * 
   * @returns {Promise<NinjaUser>} A promise that resolves to the authenticated user's profile information.
   */
  async login() {
    if (!this.ensureInitialized()) {
      throw NinjaAuthErrorException(
        "INITIALIZATION_FAILED",
        "NinjaAuth: call init() before login()."
      );
    }
    const { verifier, challenge } = await generatePKCE();
    const state = generateState();
    switch (this.config.platform) {
      case "extension":
        return this.createAuthFlow(new ChromeOAuthTransactionStorage(), new ChromeAuthorizationLauncher(), verifier, challenge, state);
      case "web":
        throw NinjaAuthErrorException(
          "UNSUPPORTED_PLATFORM",
          "NinjaAuth: the web authentication flow is not implemented yet."
        );
    }
    return Promise.reject(
      NinjaAuthErrorException(
        "UNSUPPORTED_PLATFORM",
        "NinjaAuth: the web authentication flow is not implemented yet."
      )
    );
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
      scope: this.config.scopes.join(" ")
    });
    const transaction = {
      verifier,
      redirectUri: this.config.redirectUri,
      createdAt: Date.now()
    };
    await storage.save(state, transaction);
    let hasPrimaryError = false;
    try {
      const responseUrl = await authorize.launchAuthorization(
        authorizationUrl.toString()
      );
      const callback = parseAuthorizationCallback(responseUrl);
      if (callback.state !== state) {
        throw NinjaAuthErrorException(
          "STATE_MISMATCH",
          "La verifica di sicurezza dell'autorizzazione non \xC3\u0192\xC2\xA8 riuscita."
        );
      }
      const returnedTransaction = await storage.get(state);
      if (!returnedTransaction) {
        throw NinjaAuthErrorException(
          "TRANSACTION_NOT_FOUND",
          "La transazione di autorizzazione non \xC3\u0192\xC2\xA8 pi\xC3\u0192\xC2\xB9 disponibile."
        );
      }
      return await this.exchangeCodeForToken(
        callback.code,
        returnedTransaction.verifier,
        state,
        returnedTransaction.redirectUri
      );
    } catch (error) {
      hasPrimaryError = true;
      throw error;
    } finally {
      try {
        await storage.remove(state);
      } catch (cleanupError) {
        if (!hasPrimaryError) {
          throw NinjaAuthErrorException(
            "TRANSACTION_CLEANUP_FAILED",
            "Non \xC3\u0192\xC2\xA8 stato possibile eliminare la transazione OAuth.",
            cleanupError
          );
        }
      }
    }
  }
  async exchangeCodeForToken(code, verifier, state, redirectUri) {
    let response;
    try {
      response = await fetch(
        getNinjaConnectEndpoints(this.config.environment ?? "production").exchange,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            state,
            code,
            client_id: this.config.clientId,
            code_verifier: verifier,
            redirect_uri: redirectUri
          })
        }
      );
    } catch (error) {
      throw NinjaAuthErrorException(
        "NETWORK",
        "Impossibile raggiungere il servizio di autenticazione. Verifica la connessione e riprova.",
        error
      );
    }
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "Il servizio di autenticazione ha restituito una risposta non valida.",
        error
      );
    }
    if (!isRecord(result)) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "Il formato della risposta del servizio di autenticazione non \xC3\u0192\xC2\xA8 valido.",
        result
      );
    }
    if (!response.ok || result.success !== true) {
      throw NinjaAuthErrorException(
        "EXCHANGE_FAILED",
        "Non \xC3\u0192\xC2\xA8 stato possibile completare l'autenticazione. Riprova.",
        result
      );
    }
    if (!isRecord(result.data) || !isNinjaUser(result.data.user)) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "Il servizio di autenticazione non ha restituito un profilo utente valido.",
        result.data
      );
    }
    return result.data.user;
  }
  /**
   * terminates the user's session by sending a logout request to the server. It ensures that the SDK is initialized before proceeding and handles network errors, invalid responses, and logout failures.
   * reurns {Promise<void>} A promise that resolves when the logout process is complete.
   */
  async logout() {
    if (!this.ensureInitialized()) {
      throw NinjaAuthErrorException(
        "INITIALIZATION_FAILED",
        "NinjaAuth: call init() before logout()."
      );
    }
    let response;
    try {
      response = await fetch(
        getNinjaConnectEndpoints(
          this.config.environment ?? "production"
        ).logout,
        {
          method: "POST",
          credentials: "include"
        }
      );
    } catch (error) {
      throw NinjaAuthErrorException(
        "NETWORK",
        "NinjaAuth: unable to complete logout.",
        error
      );
    }
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "NinjaAuth: the logout service returned an invalid response.",
        error
      );
    }
    if (!isRecord(result)) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "NinjaAuth: the logout service returned an invalid response envelope.",
        result
      );
    }
    if (!response.ok || result.success !== true) {
      throw NinjaAuthErrorException(
        "LOGOUT_FAILED",
        "NinjaAuth: the server could not confirm logout.",
        result
      );
    }
    if (!isRecord(result.data) || result.data.loggedOut !== true) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "NinjaAuth: the logout service returned an invalid confirmation.",
        result.data
      );
    }
  }
  /**
   * 
   * @returns {Promise<NinjaSession>} A promise that resolves to the current session information, including authentication status, user profile, and session details.
   */
  async getSession() {
    if (!this.ensureInitialized()) {
      throw NinjaAuthErrorException(
        "INITIALIZATION_FAILED",
        "NinjaAuth: call init() before getSession()."
      );
    }
    let response;
    try {
      response = await fetch(
        getNinjaConnectEndpoints(
          this.config.environment ?? "development"
        ).session,
        {
          method: "GET",
          credentials: "include"
        }
      );
    } catch (error) {
      throw NinjaAuthErrorException(
        "NETWORK",
        "NinjaAuth: unable to retrieve the current session.",
        error
      );
    }
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "NinjaAuth: the session service returned an invalid response.",
        error
      );
    }
    if (!isRecord(result)) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "NinjaAuth: the session service returned an invalid response envelope.",
        result
      );
    }
    if (response.status === 401 && result.success === false && isRecord(result.error) && result.error.code === "INVALID_SESSION") {
      return {
        authenticated: false,
        user: null,
        session: null
      };
    }
    if (!response.ok || result.success !== true) {
      throw NinjaAuthErrorException(
        "SESSION_FAILED",
        "NinjaAuth: failed to retrieve the current session.",
        result
      );
    }
    if (!isNinjaSession(result.data)) {
      throw NinjaAuthErrorException(
        "INVALID_RESPONSE",
        "NinjaAuth: the session service returned an invalid session payload.",
        result.data
      );
    }
    return result.data;
  }
};
_NinjaAuth.instance = null;
var NinjaAuth = _NinjaAuth;
export {
  NinjaAuth
};
//# sourceMappingURL=index.js.map