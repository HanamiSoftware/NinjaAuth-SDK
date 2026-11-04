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

    if (
        environment !== "development" &&
        environment !== "production"
    ) {
        throw NinjaAuthErrorException(
            "CONFIGURATION",
            "NinjaAuth: environment must be 'development' or 'production'."
        );
    }

    this.config = {
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        platform: supportedPlatforms,
        environment
    };

    return this;
}


    public async login(): Promise<NinjaUser> {

        if (!this.ensureInitialized()) {
            throw NinjaAuthErrorException(
                "INITIALIZATION_FAILED",
                "NinjaAuth: call init() before login()."
            );
        }
        const { verifier, challenge } = await generatePKCE();
        const state = generateState();
        switch (this.config!.platform) {
            case "extension":
                return this.createAuthFlow(new ChromeOAuthTransactionStorage, new ChromeAuthorizationLauncher, verifier, challenge, state);

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
        state: string
    ): Promise<NinjaUser> {

        const authorizationUrl = buildAuthorizationUrl({
            clientId: this.config!.clientId,
            redirectUri: this.config!.redirectUri,
            codeChallenge: challenge,
            state,
            scope: NINJA_CONNECT.DEFAULT_SCOPE
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
                    authorizationUrl.toString()
                );

            const callback =
                parseAuthorizationCallback(responseUrl);

            // Verify that the returned state matches
            // the state generated by NinjaAuth.
            if (callback.state !== state) {
                throw NinjaAuthErrorException(
                    "STATE_MISMATCH",
                    "La verifica di sicurezza dell'autorizzazione non è riuscita."
                );
            }

            const returnedTransaction =
                await storage.get(state);

            if (!returnedTransaction) {
                throw NinjaAuthErrorException(
                    "TRANSACTION_NOT_FOUND",
                    "La transazione di autorizzazione non è più disponibile."
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
                        "Non è stato possibile eliminare la transazione OAuth.",
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

        // Response parsing
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
                "Il formato della risposta del servizio di autenticazione non è valido.",
                result
            );
        }

        // Exchange failure
        if (!response.ok || result.success !== true) {

            throw NinjaAuthErrorException(
                "EXCHANGE_FAILED",
                "Non è stato possibile completare l'autenticazione. Riprova.",
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
                getNinjaConnectEndpoints(
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
            getNinjaConnectEndpoints(
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

    // Only INVALID_SESSION means anonymous.
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
