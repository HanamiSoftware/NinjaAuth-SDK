import {
    buildAuthorizationUrl,
    parseAuthorizationCallback
} from "./oauth/authorization";

import { generateState } from "./oauth/state";

import type {
    NinjaAuthConfig,
    NinjaSession,
    NinjaUser,
    OAuthTransactionStorage
} from "./types/types";

import { generatePKCE } from "./utils/pkce";

import type { AuthorizationLauncher } from "./oauth/authorization";
import { ChromeOAuthTransactionStorage } from "./platform/chrome/TransactionStorage";
import { ChromeAuthorizationLauncher } from "./platform/chrome/AuthorizationLauncher";


const VERSION = "0.1.0";


class NinjaAuthClient {

    private config: NinjaAuthConfig | null = null;

    public readonly version = VERSION;


    public init(config: NinjaAuthConfig): void {

        const supportedPlatforms = config?.platform ?? "web";

        if (!config.clientId) {
            throw new Error(
                "NinjaAuth: clientId is required."
            );
        }

        if (!config.redirectUri) {
            throw new Error(
                "NinjaAuth: redirectUri is required."
            );
        }
        if (!config.platform) {
            config.platform = "web";
        }

        this.config = {
            clientId: config.clientId,
            redirectUri: config.redirectUri,
            platform: supportedPlatforms
        };
    }


    public async login(): Promise<NinjaUser> {

        if (!this.ensureInitialized()) {
            throw new Error(
                "NinjaAuth: call init() before login()."
            );
        }
        const { verifier, challenge } = await generatePKCE();
        const state = generateState();
        switch (this.config!.platform) {
            case "extension":
                return this.createAuthFlow(new ChromeOAuthTransactionStorage, new ChromeAuthorizationLauncher, verifier, challenge, state);

            case "web":
                // Handle web-specific authentication flow
                break;
        }
            
        
       
        return new Promise<NinjaUser>((resolve, reject) => { })
    }


    private ensureInitialized(): boolean {
        if (!this.config) {
            return false;
        }
        return true;
    }

    private async createAuthFlow(storage: OAuthTransactionStorage, authorize: AuthorizationLauncher, verifier: string, challenge: string, state: string): Promise<NinjaUser> {
        const authorizationUrl = buildAuthorizationUrl({
            clientId: this.config!.clientId,
            redirectUri: this.config!.redirectUri,
            codeChallenge: challenge,
            state: state,
            scope: "openid profile email offline_access"
        });
        const transaction = {
            verifier: verifier,
            redirectUri: this.config!.redirectUri,
            createdAt: Date.now()
        };
        await storage.save(state, transaction);
        const responseUrl = await authorize.launchAuthorization(authorizationUrl.toString());
        const callback = parseAuthorizationCallback(responseUrl);
        const returnedTransaction = await storage.get(callback.state);
        if (!returnedTransaction) {
            await storage.remove(callback.state);
            throw new Error(
                "NinjaAuth: no transaction found for state."
            );

        }
        try {
            const user = await this.exchangeCodeForToken(callback.code, returnedTransaction.verifier);
            await storage.remove(callback.state);
            return user;
        } finally {

            await storage.remove(callback.state);
        }
    }

    private async exchangeCodeForToken(
        code: string,
        verifier: string
    ): Promise<NinjaUser> {

        const response = await fetch(
            "https://auth.ninjaconnect.io/v1/exchange",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri:
                        this.config!.redirectUri,
                    client_id:
                        this.config!.clientId,
                    code_verifier: verifier
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "NinjaAuth: authentication exchange failed."
            );
        }

        return result.data.user as NinjaUser;
    }

        


    public async logout(): Promise<void> {

        // TODO
    }


    public async getSession(): Promise<NinjaSession> {

        // TODO

        throw new Error(
            "NinjaAuth: getSession() is not implemented yet."
        );
    }
}


export const NinjaAuth =
    new NinjaAuthClient();
