export function generateState(length: number = 32): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(length))).map(b => b.toString(16).padStart(2, '0')).join('');
}