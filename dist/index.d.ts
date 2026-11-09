/**
 * NinjaAuthConfig defines the configuration options for initializing the NinjaAuth instance.
 * @param {string} clientId - The client ID for the application.
 * @param {string} redirectUri - The redirect URI for the application.
 * @param {("extension" | "web")} [platform] - The platform type, either "extension" or "web". Defaults to "extension".
 */
interface NinjaAuthConfig {
    clientId: string;
    redirectUri: string;
    platform?: "extension" | "web";
    environment?: "development" | "production";
    scopes?: string;
    resource?: string | undefined;
}
/**
 * NinjaUser represents the authenticated user's information.
 * @param {string} id - The unique identifier of the user.
 * @param {string | null} email - The email address of the user, or null if not available.
 * @param {string | null} name - The name of the user, or null if not available.
 * @param {string | null} pictureUrl - The URL of the user's profile picture, or null if not available.
 */
interface NinjaUser {
    id: string;
    email: string | null;
    name: string | null;
    pictureUrl: string | null;
}
interface NinjaSessionInfo {
    expiresAt: string;
    absoluteExpiresAt: string;
}
/**
 * NinjaSession represents the current session state of the user.
 * @param {boolean} authenticated - Indicates whether the user is authenticated.
 * @param {NinjaUser | null} user - The authenticated user's information, or null if not authenticated.
 * @param {NinjaSessionInfo | null} session - The session information, or null if not authenticated.
 */
interface NinjaSession {
    authenticated: boolean;
    user: NinjaUser | null;
    session: NinjaSessionInfo | null;
}

/**
 * NinjaAuth is a singleton class that provides methods for user authentication and session management.
 * @method init - Initializes the NinjaAuth instance with the provided configuration.
 * @method login - Initiates the authentication flow for the user.
 * @method logout - Terminates the user's session.
 */
declare class NinjaAuth {
    private config;
    readonly version = "0.1.0";
    private static instance;
    constructor();
    /**
     * initialize the NinjaAuth instance with the provided configuration.
     * @param config - The configuration object for initializing the NinjaAuth instance.
     * @param config.clientId - The client ID for the application.
     * @param config.redirectUri - The redirect URI for the application.
     * @param config.platform - The platform type, either "extension" or "web". Defaults to "extension".
     * @returns The initialized NinjaAuth instance.
     */
    init(config: NinjaAuthConfig): NinjaAuth;
    /**
     * login initiates the authentication flow for the user. It generates a PKCE challenge and state, constructs the authorization URL, and launches the authorization flow. Upon successful authentication, it exchanges the authorization code for an access token and retrieves the user's profile information.
     *
     * @returns {Promise<NinjaUser>} A promise that resolves to the authenticated user's profile information.
     */
    login(): Promise<NinjaUser>;
    private ensureInitialized;
    private createAuthFlow;
    private exchangeCodeForToken;
    /**
     * terminates the user's session by sending a logout request to the server. It ensures that the SDK is initialized before proceeding and handles network errors, invalid responses, and logout failures.
     * reurns {Promise<void>} A promise that resolves when the logout process is complete.
     */
    logout(): Promise<void>;
    /**
     *
     * @returns {Promise<NinjaSession>} A promise that resolves to the current session information, including authentication status, user profile, and session details.
     */
    getSession(): Promise<NinjaSession>;
}

export { NinjaAuth, type NinjaAuthConfig, type NinjaSession, type NinjaUser };
