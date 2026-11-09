import type {
    OAuthTransaction,
    OAuthTransactionStorage
} from "../../types/types";

import {
    NinjaAuthErrorException
} from "../../errors/ErrorHandler";

const PREFIX = "ninja_auth_oauth_";
const MAX_TRANSACTION_AGE_MS = 10 * 60 * 1000;

function isOAuthTransaction(value: unknown): value is OAuthTransaction {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }

    const transaction = value as Record<string, unknown>;

    return (
        typeof transaction.verifier === "string" &&
        transaction.verifier.length >= 43 &&
        transaction.verifier.length <= 128 &&
        typeof transaction.redirectUri === "string" &&
        Number.isFinite(transaction.createdAt)
    );
}

export class WebOAuthTransactionStorage implements OAuthTransactionStorage {
    private get storage(): Storage {
        if (typeof window === "undefined" || !window.sessionStorage) {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: sessionStorage non è disponibile. Verifica le impostazioni privacy del browser."
            );
        }

        return window.sessionStorage;
    }

    public async save(
        state: string,
        transaction: OAuthTransaction
    ): Promise<void> {
        try {
            this.storage.setItem(
                `${PREFIX}${state}`,
                JSON.stringify(transaction)
            );
        } catch (error) {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: impossibile salvare temporaneamente la transazione OAuth.",
                error
            );
        }
    }

    public async get(state: string): Promise<OAuthTransaction | null> {
        const key = `${PREFIX}${state}`;
        let serialized: string | null;

        try {
            serialized = this.storage.getItem(key);
        } catch (error) {
            throw NinjaAuthErrorException(
                "AUTHORIZATION_FAILED",
                "NinjaAuth: impossibile leggere la transazione OAuth.",
                error
            );
        }

        if (!serialized) return null;

        let parsed: unknown;
        try {
            parsed = JSON.parse(serialized);
        } catch {
            await this.remove(state);
            return null;
        }

        if (!isOAuthTransaction(parsed)) {
            await this.remove(state);
            return null;
        }

        const age = Date.now() - parsed.createdAt;
        if (age < 0 || age > MAX_TRANSACTION_AGE_MS) {
            await this.remove(state);
            return null;
        }

        return parsed;
    }

    public async remove(state: string): Promise<void> {
        try {
            this.storage.removeItem(`${PREFIX}${state}`);
        } catch (error) {
            throw NinjaAuthErrorException(
                "TRANSACTION_CLEANUP_FAILED",
                "NinjaAuth: impossibile eliminare la transazione OAuth.",
                error
            );
        }
    }
}
