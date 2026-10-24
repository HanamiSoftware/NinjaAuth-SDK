interface NinjaAuthConfig {
    clientId: string;
    redirectUri: string;
    platform: "extension" | "web";
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
    init(config: NinjaAuthConfig): void;
    login(): Promise<NinjaUser>;
    private ensureInitialized;
    private createAuthFlow;
    private exchangeCodeForToken;
    logout(): Promise<void>;
    getSession(): Promise<NinjaSession>;
}
declare const NinjaAuth: NinjaAuthClient;

export { NinjaAuth, type NinjaAuthConfig, type NinjaUser };
