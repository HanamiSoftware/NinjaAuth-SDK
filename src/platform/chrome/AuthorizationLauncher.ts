
import type {
    AuthorizationLauncher
} from "../../oauth/authorization";

import {
    NinjaAuthErrorException
} from "../../errors/ErrorHandler";


export class ChromeAuthorizationLauncher
    implements AuthorizationLauncher {

    public async launchAuthorization(
        url: string
    ): Promise<string> {

        try {
            const responseUrl =
                await chrome.identity.launchWebAuthFlow({
                    url,
                    interactive: true
                });

            if (!responseUrl) {
                throw NinjaAuthErrorException(
                    undefined,
                    "AUTHORIZATION_FAILED",
                    "Chrome non ha restituito l'indirizzo di risposta."
                );
            }

            return responseUrl;

        } catch (error) {

            throw NinjaAuthErrorException(
                error,
                "AUTHORIZATION_FAILED",
                "Non è stato possibile completare l'autorizzazione."
            );
        }
    }
}
