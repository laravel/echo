let enableDeprecationWarnings = true;

export function setDeprecationWarnings(enabled: boolean) {
    enableDeprecationWarnings = enabled;
}

export function deprecationWarning(msg: string) {
    if (!enableDeprecationWarnings) {
        return;
    }

    console.warn('[DEPRECATION] Laravel Echo: ' + msg);
}
