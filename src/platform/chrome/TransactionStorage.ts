import type {
    OAuthTransaction,
    OAuthTransactionStorage
} from "../../types/types";

const PREFIX = "oauth_";

export class ChromeOAuthTransactionStorage
    implements OAuthTransactionStorage {

    async save(
        state: string,
        transaction: OAuthTransaction
    ): Promise<void> {

        await chrome.storage.session.set({
            [`${PREFIX}${state}`]: transaction
        });
    }

    async get(
        state: string
    ): Promise<OAuthTransaction | null> {

        const key = `${PREFIX}${state}`;

        const result =
            await chrome.storage.session.get(key);

        return result[key] ?? null;
    }

    async remove(
        state: string
    ): Promise<void> {

        await chrome.storage.session.remove(
            `${PREFIX}${state}`
        );
    }
}