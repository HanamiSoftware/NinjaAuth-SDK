
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
                    "AUTHORIZATION_FAILED",
                    "Chrome non ha restituito l'indirizzo di risposta."
                );
            }

            return responseUrl;

        } catch (error) {

            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "Non è stato possibile completare l'autorizzazione.",
                error
            );
        }
    }
}
