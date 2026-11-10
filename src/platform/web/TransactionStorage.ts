import type {
    OAuthTransaction,
    OAuthTransactionStorage
} from "../../types/types";

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

/**
 * Web transactions stay in the calling page's JavaScript memory.
 * The parent page remains alive while the popup is active, so persistent
 * browser storage is unnecessary and would expose the PKCE verifier to
 * other same-origin scripts.
 */
export class WebOAuthTransactionStorage implements OAuthTransactionStorage {
    private readonly transactions = new Map<string, OAuthTransaction>();

    public async save(
        state: string,
        transaction: OAuthTransaction
    ): Promise<void> {
        this.transactions.set(state, transaction);
    }

    public async get(state: string): Promise<OAuthTransaction | null> {
        const transaction = this.transactions.get(state) ?? null;

        if (!transaction || !isOAuthTransaction(transaction)) {
            this.transactions.delete(state);
            return null;
        }

        const age = Date.now() - transaction.createdAt;
        if (age < 0 || age > MAX_TRANSACTION_AGE_MS) {
            this.transactions.delete(state);
            return null;
        }

        return transaction;
    }

    public async remove(state: string): Promise<void> {
        this.transactions.delete(state);
    }
}
