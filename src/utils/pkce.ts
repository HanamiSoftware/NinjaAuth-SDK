// utils/pkce.ts

export interface PKCEPair {
    verifier: string;
    challenge: string;
}

function base64UrlEncode(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export async function generatePKCE(): Promise<PKCEPair> {
    const array = new Uint8Array(32);

    crypto.getRandomValues(array);

    const verifier = base64UrlEncode(array);

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );

    const challenge = base64UrlEncode(
        new Uint8Array(digest)
    );

    return {
        verifier,
        challenge
    };
}