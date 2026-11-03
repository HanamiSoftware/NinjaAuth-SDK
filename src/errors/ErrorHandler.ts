import {
    NinjaAuthInternalError
} from "./NinjaAuthError";

import type {
    InternalErrorCode
} from "./NinjaAuthError";


export function NinjaAuthErrorException(
    code: InternalErrorCode,
    message: string,
    error?: unknown
): NinjaAuthInternalError {

    // Se l'errore è già stato classificato,
    // manteniamo la classificazione originale.
    if (error instanceof NinjaAuthInternalError) {
        return error;
    }

    // Altrimenti creiamo un errore interno
    // con un messaggio comprensibile.
    return new NinjaAuthInternalError(
        code,
        message,
        error
    );
}


export function ThrowableError(
    error: unknown,
    code: InternalErrorCode,
    message: string
): never {

    throw NinjaAuthErrorException(
        code,
        message,
        error
    );
}