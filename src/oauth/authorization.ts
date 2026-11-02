import { NINJA_CONNECT } from "../config";
import { NinjaAuthErrorException } from "../errors/ErrorHandler";
export interface AuthorizationLauncher{
    launchAuthorization(authorizationUrl: string): Promise<string>;
}
export interface AuthorizationRequest {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope: string;
}

export interface AuthorizationCallback {
    code: string;
    state: string;
}

export function buildAuthorizationUrl(
    request: AuthorizationRequest
): URL {
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

export interface AuthorizationCallback {
    code: string;
    state: string;
}

export function parseAuthorizationCallback(
    responseUrl: string
): AuthorizationCallback {

    let url: URL;

    try {
        url = new URL(responseUrl);
    } catch (error) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "L'indirizzo di risposta dell'autorizzazione non è valido.",
            error
        );
    }

    const error = url.searchParams.get("error");

    if (error) {

        const description =
            url.searchParams.get("error_description");

        if (error === "access_denied") {
            throw NinjaAuthErrorException(
                "OAUTH_DENIED",
                "L'autorizzazione è stata negata.",
                error
            );
        }

        throw NinjaAuthErrorException(
            "OAUTH_PROVIDER_ERROR",
            description
                ? `Il provider di autenticazione ha restituito un errore: ${description}`
                : `Il provider di autenticazione ha restituito un errore: ${error}`
        );
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "Il codice di autorizzazione non è presente nella risposta.",
            error
        );
    }

    if (!state) {
        throw NinjaAuthErrorException(
            "INVALID_CALLBACK",
            "Lo state non è presente nella risposta di autorizzazione.",
            error
        );
    }

    return {
        code,
        state
    };
}