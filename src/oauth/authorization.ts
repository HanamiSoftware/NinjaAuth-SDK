import { NINJA_CONNECT } from "../config";
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

    const url = new URL(responseUrl);

    const error =
        url.searchParams.get("error");

    if (error) {
        const description =
            url.searchParams.get("error_description");

        throw new Error(
            description
                ? `NinjaAuth: ${error}: ${description}`
                : `NinjaAuth: ${error}`
        );
    }

    const code =
        url.searchParams.get("code");

    const state =
        url.searchParams.get("state");

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