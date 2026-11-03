export type InternalErrorCode =
    | "INITIALIZATION"
    | "INITIALIZATION_FAILED"
    | "CONFIGURATION"
    | "UNSUPPORTED_PLATFORM"
    | "AUTHORIZATION_CANCELLED"
    | "AUTHORIZATION_FAILED"
    | "OAUTH_DENIED"
    | "OAUTH_PROVIDER_ERROR"
    | "INVALID_CALLBACK"
    | "STATE_MISMATCH"
    | "TRANSACTION_NOT_FOUND"
    | "TRANSACTION_EXPIRED"
    | "TRANSACTION_CLEANUP_FAILED"
    | "NETWORK"
    | "EXCHANGE_FAILED"
    | "SESSION_FAILED"
    | "LOGOUT_FAILED"
    | "INVALID_RESPONSE"
    | "UNKNOWN";

export class NinjaAuthInternalError extends Error {

    public readonly code: InternalErrorCode;
    public readonly originalError?: unknown;

    constructor(
        code: InternalErrorCode,
        message: string,
        originalError?: unknown
    ) {
        super(message);

        this.name = "NinjaAuthInternalError";
        this.code = code;
        this.originalError = originalError;

        Object.setPrototypeOf(
            this,
            NinjaAuthInternalError.prototype
        );
    }
}