import type { AuthorizationLauncher } from "../../oauth/authorization";

export class ChromeAuthorizationLauncher
    implements AuthorizationLauncher {

    public launchAuthorization(url: string): Promise<string> {
        return new Promise((resolve, reject) => {

            chrome.identity.launchWebAuthFlow(
                {
                    url,
                    interactive: true
                },
                (responseUrl) => {

                    const error =
                        chrome.runtime.lastError;

                    if (error) {
                        reject(
                            new Error(
                                error.message ||
                                "NinjaAuth: authorization failed."
                            )
                        );
                        return;
                    }

                    if (!responseUrl) {
                        reject(
                            new Error(
                                "NinjaAuth: authorization failed: no callback URL."
                            )
                        );
                        return;
                    }

                    resolve(responseUrl);
                }
            );
        });
    }
}