export type NinjaAuthEnvironment =
    | "development"
    | "production";

export const NINJA_CONNECT = {
    AUTHORIZATION_ENDPOINT:
        "https://auth.ninjaconnect.io",

    API_BASE_URLS: {
        development:
            "http://127.0.0.1:8787/v1",

        production:
            "https://auth.ninjaconnect.io/v1"
    },

    API_PATHS: {
        EXCHANGE: "/exchange",
        SESSION: "/session",
        LOGOUT: "/logout"
    },

    DEFAULT_SCOPE:
        "openid profile email offline_access"
} as const;

export function getNinjaConnectEndpoints(
    environment: NinjaAuthEnvironment
) {
    const baseUrl =
        NINJA_CONNECT.API_BASE_URLS[environment];

    return {
        exchange: `${baseUrl}${NINJA_CONNECT.API_PATHS.EXCHANGE}`,
        session: `${baseUrl}${NINJA_CONNECT.API_PATHS.SESSION}`,
        logout: `${baseUrl}${NINJA_CONNECT.API_PATHS.LOGOUT}`
    };
}
