interface NinjaAuthConfig {
    clientId: string;
    redirectUri: string;
    platform?: "extension" | "web";
    environment?: "development" | "production";
}
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
interface NinjaSession {
    authenticated: boolean;
    user: NinjaUser | null;
    session: NinjaSessionInfo | null;
}

declare class NinjaAuthClient {
    private config;
    readonly version = "0.1.0";
    private static instance;
    private constructor();
    static init(config: NinjaAuthConfig): NinjaAuthClient;
    login(): Promise<NinjaUser>;
    private ensureInitialized;
    private createAuthFlow;
    private exchangeCodeForToken;
    logout(): Promise<void>;
    getSession(): Promise<NinjaSession>;
}

export { NinjaAuthClient as NinjaAuth, type NinjaAuthConfig, type NinjaUser };
