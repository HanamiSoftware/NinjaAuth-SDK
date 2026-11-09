/**
 *  
 */
import {
    buildAuthorizationUrl,
    parseAuthorizationCallback
} from "./oauth/authorization";

import { generateState } from "./oauth/state";

import type {
    NinjaAuthConfig,
    NinjaSession,
    NinjaUser,
    OAuthTransactionStorage
} from "./types/types";

import { generatePKCE } from "./utils/pkce";

import type { AuthorizationLauncher } from "./oauth/authorization";
import { ChromeOAuthTransactionStorage } from "./platform/chrome/TransactionStorage";
import { ChromeAuthorizationLauncher } from "./platform/chrome/AuthorizationLauncher";
import { WebAuthorizationLauncher } from "./platform/web/AuthorizationLauncher";
import { NinjaAuthErrorException } from "./errors/ErrorHandler";
import {
    NINJA_CONNECT,
    getNinjaConnectEndpoints
} from "./config";


const VERSION = "0.1.0";


function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isNinjaUser(
    value: unknown
): value is NinjaUser {

    return (
        isRecord(value) &&
        typeof value.id === "string" &&
        (typeof value.email === "string" || value.email === null) &&
        (typeof value.name === "string" || value.name === null) &&
        (
            typeof value.pictureUrl === "string" ||
            value.pictureUrl === null
        )
    );
}

function isNinjaSessionInfo(
    value: unknown
): value is NonNullable<NinjaSession["session"]> {
    return (
        isRecord(value) &&
        typeof value.expiresAt === "string" &&
        Number.isFinite(Date.parse(value.expiresAt)) &&
        typeof value.absoluteExpiresAt === "string" &&
        Number.isFinite(Date.parse(value.absoluteExpiresAt))
    );
}

function isNinjaSession(
    value: unknown
): value is NinjaSession {
    if (!isRecord(value) || typeof value.authenticated !== "boolean") {
        return false;
    }

    if (value.authenticated) {
        return (
            isNinjaUser(value.user) &&
            isNinjaSessionInfo(value.session)
        );
    }

    return value.user === null && value.session === null;
}

/**
 * NinjaAuth is a singleton class that provides methods for user authentication and session management.
 * @method init - Initializes the NinjaAuth instance with the provided configuration.
 * @method login - Initiates the authentication flow for the user.
 * @method logout - Terminates the user's session.
 */
export class NinjaAuth {

    private config: NinjaAuthConfig | null = null;

    public readonly version = VERSION;
    private static instance: NinjaAuth | null = null;

    public constructor() {
    if (NinjaAuth.instance) {
      return NinjaAuth.instance;
    }
    NinjaAuth.instance = this;
  }
				
	/**
	 * initialize the NinjaAuth instance with the provided configuration.
	 * @param config - The configuration object for initializing the NinjaAuth instance.
	 * @param config.clientId - The client ID for the application; optional for Web when callback lookup is unambiguous.
	 * @param config.redirectUri - The redirect URI for the application.
	 * @param config.platform - The platform type, either "extension" or "web". Defaults to "extension".
	 * @param config.environment - The environment type, either "development" or "production". Defaults to "production".
	 * @param config.scopes - An optional array of scopes for the authentication request.
	 * @returns The initialized NinjaAuth instance.
	 */
    public init(config: NinjaAuthConfig): NinjaAuth {

    if (this.config !== null) {
        throw NinjaAuthErrorException(
            "INITIALIZATION",
            "NinjaAuth: SDK has already been initialized."
        );
    }

    const supportedPlatforms = config.platform ?? "extension";

    if (
        supportedPlatforms !== "extension" &&
        supportedPlatforms !== "web"
    ) {
        throw NinjaAuthErrorException(
            "CONFIGURATION",
            "NinjaAuth: platform must be 'extension' or 'web'."
        );
    }

    if (!config.clientId && supportedPlatforms !== "web") {
        throw NinjaAuthErrorException(
            "CONFIGURATION",
            "NinjaAuth: clientId is required for the Extension platform."
        );
    }

    if (!config.redirectUri) {
        throw NinjaAuthErrorException(
            "CONFIGURATION",
            "NinjaAuth: redirectUri is required."
        );
    }

    const environment = config.environment ?? "production";

    if (
        environment !== "development" &&
        environment !== "production"
    ) {
        throw NinjaAuthErrorException(
            "CONFIGURATION",
            "NinjaAuth: environment must be 'development' or 'production'."
        );
    }

			const defaultScopes = NINJA_CONNECT.DEFAULT_SCOPE.split(" ");
			const scopes = config.scopes ?? defaultScopes;
			const mergedScopes = Array.from(new Set([...defaultScopes, ...scopes]));

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
    public async login(): Promise<NinjaUser> {

        if (!this.ensureInitialized()) {
            throw NinjaAuthErrorException(
                "INITIALIZATION_FAILED",
                "NinjaAuth: call init() before login()."
            );
        }
        if (this.config!.platform === "web") {
            const authorize = new WebAuthorizationLauncher();

            // Must happen before the first await to preserve browser user activation.
            const prepared = authorize.prepareAuthorization();

            try {
                const { verifier, challenge } = await generatePKCE();
                const state = generateState();

                const registeredClientId = await this.registerWebTransaction(state, verifier);

                const authorizationUrl = buildAuthorizationUrl({
                    clientId: registeredClientId,
                    redirectUri: this.config!.redirectUri,
                    codeChallenge: challenge,
                    state,
                    scope: this.config!.scopes!.join(" ")
                });

                const responseUrl = await authorize.launchAuthorization(
                    authorizationUrl.toString(),
                    prepared
                );
                const callbackUrl = new URL(responseUrl);

                if (callbackUrl.searchParams.get("state") !== state) {
                    throw NinjaAuthErrorException(
                        "STATE_MISMATCH",
                        "La verifica di sicurezza dell'autorizzazione non è riuscita."
                    );
                }

                const callbackError = callbackUrl.searchParams.get("error");
                if (callbackError) {
                    throw NinjaAuthErrorException(
                        callbackError === "access_denied" ? "OAUTH_DENIED" : "OAUTH_PROVIDER_ERROR",
                        callbackError === "access_denied"
                            ? "L'autorizzazione è stata negata."
                            : "Il provider di autenticazione ha restituito un errore."
                    );
                }

                if (callbackUrl.searchParams.get("success") !== "true") {
                    throw NinjaAuthErrorException(
                        "INVALID_CALLBACK",
                        "Il callback backend non ha confermato il completamento dell'autenticazione."
                    );
                }

                const session = await this.getSession();
                if (!session.authenticated || !session.user) {
                    throw NinjaAuthErrorException(
                        "SESSION_NOT_ESTABLISHED",
                        "Il backend non ha confermato una sessione NinjaURL attiva."
                    );
                }

                return session.user;
            } catch (error) {
                authorize.cancelAuthorization(prepared);
                throw error;
            }
        }

        const { verifier, challenge } = await generatePKCE();
        const state = generateState();

        return this.createAuthFlow(
            new ChromeOAuthTransactionStorage(),
            new ChromeAuthorizationLauncher(),
            verifier,
            challenge,
            state
        );
    }


    private getApplicationEndpoint(path: "session" | "logout"): string {
        if (!this.config?.redirectUri) {
            throw NinjaAuthErrorException(
                "CONFIGURATION",
                "NinjaAuth: redirectUri is required for the Web application session."
            );
        }

        let callbackUrl: URL;
        try {
            callbackUrl = new URL(this.config.redirectUri);
        } catch (error) {
            throw NinjaAuthErrorException(
                "CONFIGURATION",
                "NinjaAuth: redirectUri is invalid.",
                error
            );
        }

        return `${callbackUrl.origin}/v1/${path}`;
    }

    private async registerWebTransaction(state: string, verifier: string): Promise<string> {
        let response: Response;
        try {
            response = await fetch(
                getNinjaConnectEndpoints(this.config!.environment ?? "production").state,
                {
                    method: "POST",
                    credentials: "omit",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        state,
                        ...(this.config!.clientId ? { client_id: this.config!.clientId } : {}),
                        code_verifier: verifier,
                        redirect_uri: this.config!.redirectUri
                    })
                }
            );
        } catch (error) {
            throw NinjaAuthErrorException(
                "NETWORK",
                "Impossibile registrare la transazione OAuth con Ninja Connect.",
                error
            );
        }

        let result: unknown;
        try {
            result = await response.json();
        } catch (error) {
            throw NinjaAuthErrorException(
                "INVALID_RESPONSE",
                "Ninja Connect ha restituito una risposta non valida per la transazione OAuth.",
                error
            );
        }

        if (
            !isRecord(result) ||
            !response.ok ||
            result.success !== true ||
            !isRecord(result.data) ||
            typeof result.data.clientId !== "string" ||
            result.data.clientId.length === 0
        ) {
            throw NinjaAuthErrorException(
                "OAUTH_STATE_FAILED",
                "Ninja Connect non ha potuto registrare la transazione OAuth.",
                result
            );
        }

        if (this.config!.clientId && result.data.clientId !== this.config!.clientId) {
            throw NinjaAuthErrorException(
                "OAUTH_CLIENT_MISMATCH",
                "Ninja Connect ha risolto un client ID diverso da quello configurato."
            );
        }

        return result.data.clientId;
    }


    private ensureInitialized(): boolean {
        if (!this.config) {
            return false;
        }
        return true;
    }


    private async createAuthFlow(
        storage: OAuthTransactionStorage,
        authorize: AuthorizationLauncher,
        verifier: string,
        challenge: string,
        state: string,
        preparedAuthorization?: unknown
    ): Promise<NinjaUser> {

        const authorizationUrl = buildAuthorizationUrl({
            clientId: this.config!.clientId!,
            redirectUri: this.config!.redirectUri,
            codeChallenge: challenge,
            state,
						scope: this.config!.scopes!.join(" ")
        });

        const transaction = {
            verifier,
            redirectUri: this.config!.redirectUri,
            createdAt: Date.now()
        };

        await storage.save(state, transaction);

        let hasPrimaryError = false;

        try {

            const responseUrl =
                await authorize.launchAuthorization(
                    authorizationUrl.toString(),
                    preparedAuthorization
                );

            const callback =
                parseAuthorizationCallback(responseUrl);

            // Verify that the returned state matches
            // the state generated by NinjaAuth.
            if (callback.state !== state) {
                throw NinjaAuthErrorException(
                    "STATE_MISMATCH",
                    "La verifica di sicurezza dell'autorizzazione non ÃƒÂ¨ riuscita."
                );
            }

            const returnedTransaction =
                await storage.get(state);

            if (!returnedTransaction) {
                throw NinjaAuthErrorException(
                    "TRANSACTION_NOT_FOUND",
                    "La transazione di autorizzazione non ÃƒÂ¨ piÃƒÂ¹ disponibile."
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
                // Cleanup must never replace the original authorization
                // or exchange error. If the flow otherwise succeeded,
                // report the failed cleanup explicitly.
                if (!hasPrimaryError) {
                    throw NinjaAuthErrorException(
                        "TRANSACTION_CLEANUP_FAILED",
                        "Non ÃƒÂ¨ stato possibile eliminare la transazione OAuth.",
                        cleanupError
                    );
                }
            }

        }
    }



    private async exchangeCodeForToken(
        code: string,
        verifier: string,
        state: string,
        redirectUri: string
    ): Promise<NinjaUser> {

        let response: Response;

        // Network request
        try {

            response = await fetch(
                getNinjaConnectEndpoints(this.config!.environment ?? "production").exchange,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        state,
                        code,
                        client_id: this.config!.clientId,
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

        
        let result: unknown;

        try {

            result = await response.json();

        } catch (error) {

            throw NinjaAuthErrorException(
                "INVALID_RESPONSE",
                "Il servizio di autenticazione ha restituito una risposta non valida.",
                error
            );
        }

        // Response envelope validation
        if (!isRecord(result)) {

            throw NinjaAuthErrorException(
                "INVALID_RESPONSE",
                "Il formato della risposta del servizio di autenticazione non ÃƒÂ¨ valido.",
                result
            );
        }

        // Exchange failure
        if (!response.ok || result.success !== true) {

            throw NinjaAuthErrorException(
                "EXCHANGE_FAILED",
                "Non ÃƒÂ¨ stato possibile completare l'autenticazione. Riprova.",
                result
            );
        }

        // Response data validation
        if (
            !isRecord(result.data) ||
            !isNinjaUser(result.data.user)
        ) {

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

    public async logout(): Promise<void> {

        if (!this.ensureInitialized()) {
            throw NinjaAuthErrorException(
                "INITIALIZATION_FAILED",
                "NinjaAuth: call init() before logout()."
            );
        }

        let response: Response;

        try {
            response = await fetch(
                this.config!.platform === "web"
                    ? this.getApplicationEndpoint("logout")
                    : getNinjaConnectEndpoints(
                        this.config!.environment ?? "production"
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

        let result: unknown;

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

        if (
            !response.ok ||
            result.success !== true
        ) {
            throw NinjaAuthErrorException(
                "LOGOUT_FAILED",
                "NinjaAuth: the server could not confirm logout.",
                result
            );
        }

        if (
            !isRecord(result.data) ||
            result.data.loggedOut !== true
        ) {
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
   public async getSession(): Promise<NinjaSession> {

    if (!this.ensureInitialized()) {
        throw NinjaAuthErrorException(
            "INITIALIZATION_FAILED",
            "NinjaAuth: call init() before getSession()."
        );
    }

    let response: Response;

    try {
        response = await fetch(
            this.config!.platform === "web"
                ? this.getApplicationEndpoint("session")
                : getNinjaConnectEndpoints(
                    this.config!.environment ?? "production"
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

    let result: unknown;

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

    if (
        response.status === 401 &&
        result.success === false &&
        isRecord(result.error) &&
        result.error.code === "INVALID_SESSION"
    ) {
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
}

export default NinjaAuth;
