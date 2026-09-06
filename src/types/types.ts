export interface NinjaAuthConfig {
    clientId: string;
    redirectUri: string;
    platform: "extension" | "web";
}

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

export interface NinjaSession {
    authenticated: boolean;
    user: NinjaUser | null;
    session: NinjaSessionInfo | null;
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