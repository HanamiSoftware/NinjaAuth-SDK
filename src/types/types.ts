/**
 * NinjaAuthConfig defines the configuration options for initializing the NinjaAuth instance.
 * @param {string} clientId - The client ID for the application.
 * @param {string} redirectUri - The redirect URI for the application.
 * @param {("extension" | "web")} [platform] - The platform type, either "extension" or "web". Defaults to "extension".
 * 
 */
export interface NinjaAuthConfig {
    clientId: string;
    redirectUri: string;
    platform?: "extension" | "web";
    environment?: "development" | "production";
		scopes?: string[];
}

/**
 * NinjaUser represents the authenticated user's information.
 * @param {string} id - The unique identifier of the user.
 * @param {string | null} email - The email address of the user, or null if not available.
 * @param {string | null} name - The name of the user, or null if not available.
 * @param {string | null} pictureUrl - The URL of the user's profile picture, or null if not available.
 */
export interface NinjaUser {
    id: string;
    email: string | null;
    name: string | null;
    pictureUrl: string | null;
}

export interface NinjaSessionInfo {
    expiresAt: string;
    absoluteExpiresAt: string;
}

/**
 * NinjaSession represents the current session state of the user.
 * @param {boolean} authenticated - Indicates whether the user is authenticated.
 * @param {NinjaUser | null} user - The authenticated user's information, or null if not authenticated.
 * @param {NinjaSessionInfo | null} session - The session information, or null if not authenticated.
 */
export interface NinjaSession {
    authenticated: boolean;
    user: NinjaUser | null;
    session: NinjaSessionInfo | null;
}

export interface NinjaSharedIdentity {
    id: string;
    email: string | null;
    name: string | null;
    pictureUrl: string | null;
}

export interface NinjaSharedSession {
    authenticated: boolean;
    identity: NinjaSharedIdentity | null;
    session: NinjaSessionInfo | null;
}

export interface NinjaAppAdapter<TProfile> {
    readonly applicationId: string;

    enrich(
        identity: NinjaSharedIdentity,
        assertion: string
    ): Promise<TProfile>;
}

export interface NinjaAppContext<TProfile> {
    identity: NinjaSharedIdentity;
    application: {
        id: string;
        profile: TProfile;
    };
    session: NinjaSessionInfo;
}


export interface OAuthTransaction {
    verifier: string;
    redirectUri: string;
    createdAt: number;
}

export interface OAuthTransactionStorage {
    save(
        state: string,
        transaction: OAuthTransaction
    ): Promise<void>;

    get(
        state: string
    ): Promise<OAuthTransaction | null>;

    remove(
        state: string
    ): Promise<void>;
}
