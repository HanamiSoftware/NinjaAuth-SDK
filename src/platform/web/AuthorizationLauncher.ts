import type {
    AuthorizationLauncher
} from "../../oauth/authorization";

import {
    NinjaAuthErrorException
} from "../../errors/ErrorHandler";

const CALLBACK_MESSAGE_TYPE = "NINJA_AUTH_WEB_CALLBACK";

interface WebCallbackMessage {
    type: typeof CALLBACK_MESSAGE_TYPE;
    state: string;
    success?: boolean;
    error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class WebAuthorizationLauncher implements AuthorizationLauncher {
    /**
     * Open the blank popup synchronously while the caller still has the
     * browser's user-activation context. The authorization URL is assigned
     * only after the asynchronous PKCE challenge and server transaction setup.
     */
    public prepareAuthorization(): WindowProxy {
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
            typeof (prepared as WindowProxy).close === "function"
        ) {
            try {
                (prepared as WindowProxy).close();
            } catch {
                // Closing a popup is best-effort cleanup.
            }
        }
    }

    public async launchAuthorization(
        authorizationUrl: string,
        prepared?: unknown
    ): Promise<string> {
        const popup = prepared as WindowProxy | undefined;

        if (!popup || popup.closed) {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: la finestra di autenticazione non è disponibile."
            );
        }

        let authorizeUrl: URL;
        let redirectUri: URL;
        let expectedState: string;

        try {
            authorizeUrl = new URL(authorizationUrl);
            const redirect = authorizeUrl.searchParams.get("redirect_uri");
            expectedState = authorizeUrl.searchParams.get("state") ?? "";
            if (!redirect || !expectedState) {
                throw new Error("Missing redirect_uri or state");
            }
            redirectUri = new URL(redirect);
            if (
                redirectUri.protocol !== "https:" &&
                redirectUri.hostname !== "localhost" &&
                redirectUri.hostname !== "127.0.0.1"
            ) {
                throw new Error("OAuth callback must use HTTPS");
            }
        } catch (error) {
            throw NinjaAuthErrorException(
                "INVALID_CALLBACK",
                "NinjaAuth: redirect URI o state non validi.",
                error
            );
        }

        if (typeof window === "undefined") {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: il popup di autenticazione non è disponibile in questo contesto."
            );
        }

        // The backend callback sets the application cookie, then redirects the
        // popup to a tiny bridge page on the opener's origin. Only that bridge
        // may message the opener; OAuth code and PKCE verifier never cross it.
        const bridgeOrigin = window.location.origin;

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
                    event.origin !== bridgeOrigin ||
                    !isRecord(event.data) ||
                    event.data.type !== CALLBACK_MESSAGE_TYPE
                ) {
                    return;
                }

                if (event.data.state !== expectedState) {
                    finish(() => reject(NinjaAuthErrorException(
                        "STATE_MISMATCH",
                        "La verifica di sicurezza dell'autorizzazione non è riuscita."
                    )));
                    this.cancelAuthorization(popup);
                    return;
                }

                const hasSuccess = event.data.success === true;
                const hasError = typeof event.data.error === "string" && event.data.error.length > 0;
                if (!hasSuccess && !hasError) return;

                const responseUrl = new URL(redirectUri.toString());
                responseUrl.searchParams.set("state", expectedState);
                if (hasSuccess) {
                    responseUrl.searchParams.set("success", "true");
                } else if (hasError) {
                    responseUrl.searchParams.set("error", event.data.error as string);
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
 * Completes the same-origin bridge after the backend callback has exchanged
 * the authorization code and established the application's HttpOnly session.
 * The bridge forwards only state and the outcome; never code, tokens or cookies.
 */
export function completeWebAuthCallback(): void {
    if (typeof window === "undefined" || !window.opener) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "NinjaAuth: questa pagina di callback non è stata aperta dal popup di login."
        );
    }

    const callbackUrl = new URL(window.location.href);
    const state = callbackUrl.searchParams.get("state");
    const result = callbackUrl.searchParams.get("result");
    const error = callbackUrl.searchParams.get("error");

    if (
        !state ||
        !/^[0-9a-f-]{36}$/i.test(state) ||
        (result !== "success" && result !== "error")
    ) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "NinjaAuth: il callback backend non contiene uno state o un risultato valido."
        );
    }

    const message: WebCallbackMessage = {
        type: CALLBACK_MESSAGE_TYPE,
        state,
        ...(result === "success"
            ? { success: true }
            : { error: error || "authentication_failed" })
    };

    for (const key of ["code", "code_verifier", "access_token", "id_token", "refresh_token", "state", "result", "error"]) {
        callbackUrl.searchParams.delete(key);
    }
    window.history.replaceState(null, "", callbackUrl.toString());

    window.opener.postMessage(message, window.location.origin);
    window.close();
}
