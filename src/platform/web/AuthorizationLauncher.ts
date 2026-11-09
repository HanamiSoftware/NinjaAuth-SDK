import type {
    AuthorizationLauncher
} from "../../oauth/authorization";

import {
    NinjaAuthErrorException
} from "../../errors/ErrorHandler";

const CALLBACK_MESSAGE_TYPE = "NINJA_AUTH_WEB_CALLBACK";

interface WebCallbackMessage {
    type: typeof CALLBACK_MESSAGE_TYPE;
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class WebAuthorizationLauncher implements AuthorizationLauncher {
    /**
     * Open the blank popup synchronously while the caller still has the
     * browser's user-activation context. The authorization URL is assigned
     * only after the asynchronous PKCE challenge has been generated.
     */
    public prepareAuthorization(): Window {
        if (typeof window === "undefined" || typeof window.open !== "function") {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: il popup di autenticazione non è disponibile in questo contesto."
            );
        }

        const popup = window.open(
            "about:blank",
            "ninja-auth-login",
            "popup=yes,width=520,height=720,resizable=yes,scrollbars=yes"
        );

        if (!popup) {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: il popup è stato bloccato dal browser. Consenti i popup e riprova."
            );
        }

        return popup;
    }

    public cancelAuthorization(prepared?: unknown): void {
        if (
            typeof prepared === "object" &&
            prepared !== null &&
            "close" in prepared &&
            typeof (prepared as Window).close === "function"
        ) {
            try {
                (prepared as Window).close();
            } catch {
                // Closing a popup is best-effort cleanup.
            }
        }
    }

    public async launchAuthorization(
        authorizationUrl: string,
        prepared?: unknown
    ): Promise<string> {
        const popup = prepared as Window | undefined;

        if (!popup || popup.closed) {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: la finestra di autenticazione non è disponibile."
            );
        }

        let authorizeUrl: URL;
        let redirectUri: URL;

        try {
            authorizeUrl = new URL(authorizationUrl);
            const redirect = authorizeUrl.searchParams.get("redirect_uri");
            if (!redirect) {
                throw new Error("Missing redirect_uri");
            }
            redirectUri = new URL(redirect);
        } catch (error) {
            throw NinjaAuthErrorException(
                "INVALID_CALLBACK",
                "NinjaAuth: redirect URI non valido.",
                error
            );
        }

        if (
            typeof window === "undefined" ||
            redirectUri.origin !== window.location.origin
        ) {
            throw NinjaAuthErrorException(
                "CONFIGURATION",
                "NinjaAuth Web richiede che redirectUri e pagina chiamante appartengano alla stessa origine."
            );
        }

        return new Promise<string>((resolve, reject) => {
            let settled = false;

            const cleanup = () => {
                window.removeEventListener("message", onMessage);
                window.clearInterval(closePoll);
                window.clearTimeout(timeout);
            };

            const finish = (callback: () => void) => {
                if (settled) return;
                settled = true;
                cleanup();
                callback();
            };

            const onMessage = (event: MessageEvent<unknown>) => {
                if (
                    event.source !== popup ||
                    event.origin !== redirectUri.origin ||
                    !isRecord(event.data) ||
                    event.data.type !== CALLBACK_MESSAGE_TYPE
                ) {
                    return;
                }

                const data = event.data;
                const hasCode = typeof data.code === "string" && data.code.length > 0;
                const hasError = typeof data.error === "string" && data.error.length > 0;

                if (!hasCode && !hasError) return;

                const responseUrl = new URL(redirectUri.toString());

                if (hasCode) responseUrl.searchParams.set("code", data.code as string);
                if (typeof data.state === "string") {
                    responseUrl.searchParams.set("state", data.state);
                }
                if (hasError) responseUrl.searchParams.set("error", data.error as string);
                if (typeof data.error_description === "string") {
                    responseUrl.searchParams.set(
                        "error_description",
                        data.error_description
                    );
                }

                finish(() => {
                    this.cancelAuthorization(popup);
                    resolve(responseUrl.toString());
                });
            };

            const closePoll = window.setInterval(() => {
                if (popup.closed) {
                    finish(() => reject(NinjaAuthErrorException(
                        "AUTHORIZATION_CANCELLED",
                        "NinjaAuth: autenticazione annullata."
                    )));
                }
            }, 250);

            const timeout = window.setTimeout(() => {
                finish(() => reject(NinjaAuthErrorException(
                    "AUTHORIZATION_FAILED",
                    "NinjaAuth: il popup di autenticazione è scaduto."
                )));
                this.cancelAuthorization(popup);
            }, 5 * 60 * 1000);

            window.addEventListener("message", onMessage);

            try {
                popup.location.replace(authorizeUrl.toString());
            } catch (error) {
                finish(() => reject(NinjaAuthErrorException(
                    "AUTHORIZATION_FAILED",
                    "NinjaAuth: impossibile avviare il popup di autenticazione.",
                    error
                )));
                this.cancelAuthorization(popup);
            }
        });
    }
}

/**
 * Call this function from the page configured as redirectUri.
 * It forwards only the authorization response to the opener; the PKCE
 * verifier and session credentials never enter the popup message.
 */
export function completeWebAuthCallback(): void {
    if (typeof window === "undefined" || !window.opener) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "NinjaAuth: questa pagina di callback non è stata aperta dal popup di login."
        );
    }

    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get("code");
    const state = callbackUrl.searchParams.get("state");
    const error = callbackUrl.searchParams.get("error");
    const errorDescription = callbackUrl.searchParams.get("error_description");

    if (!code && !error) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "NinjaAuth: la risposta OAuth non contiene né code né error."
        );
    }

    const message: WebCallbackMessage = {
        type: CALLBACK_MESSAGE_TYPE,
        ...(code ? { code } : {}),
        ...(state ? { state } : {}),
        ...(error ? { error } : {}),
        ...(errorDescription ? { error_description: errorDescription } : {})
    };

    window.opener.postMessage(message, window.location.origin);
    window.close();
}
